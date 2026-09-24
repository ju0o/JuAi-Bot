// Pure helpers shared by bot.mjs and setup.mjs. No Discord or process state here, so check.mjs can test them.

export const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

/** KST calendar date (YYYY-MM-DD). */
export const kstDate = (now = Date.now()) => new Date(now + KST_MS).toISOString().slice(0, 10);
export const kstHour = (now = Date.now()) => new Date(now + KST_MS).getUTCHours();
export const kstDay = (now = Date.now()) => new Date(now + KST_MS).getUTCDay(); // 0 = Sunday
/** Epoch ms of 00:00 KST on the given KST date. */
export const kstMidnight = (date) => Date.parse(`${date}T00:00:00Z`) - KST_MS;
/** Quota day rolls over at 09:00 KST, which is exactly 00:00 UTC. */
export const quotaDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

const dateInKey = /(\d{4}-\d{2}-\d{2})/;
const olderThan = (date, now, days) => {
  const at = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(at) && at < now - days * DAY_MS;
};

/** Remove dated transient state and usage rows beyond their retention windows. */
export function pruneState(db, now = Date.now()) {
  const prefixes = ["subsent:", "mentor:", "done:", "tries:", "boot:", "topics:", "summary:"];
  for (const { key } of db.prepare("SELECT key FROM kv").all()) {
    const date = dateInKey.exec(key)?.[1];
    if (date && prefixes.some((prefix) => key.startsWith(prefix)) && olderThan(date, now, 45)) {
      db.prepare("DELETE FROM kv WHERE key=?").run(key);
    }
  }
  for (const { day } of db.prepare("SELECT day FROM usage").all()) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && olderThan(day, now, 60)) {
      db.prepare("DELETE FROM usage WHERE day=?").run(day);
    }
  }
}

export const LIMITS = { daily: 5, gapMs: 30_000, globalDaily: 300, bonusMax: 3 };

/** +1 question for giving feedback on someone else's post, at most bonusMax per quota day. Stored as usage rows "bonus:<id>". */
export function grantBonus(db, userId, { now = Date.now(), limits = LIMITS } = {}) {
  const day = quotaDay(now), key = `bonus:${userId}`;
  if ((db.prepare("SELECT count FROM usage WHERE user_id=? AND day=?").get(key, day)?.count ?? 0) >= limits.bonusMax) return false;
  db.prepare(`INSERT INTO usage(user_id,day,count,last_at) VALUES(?,?,1,?) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1,last_at=excluded.last_at`).run(key, day, now);
  return true;
}

/** Per-member AI chat quota. Records the use only when allowed. */
export function takeQuota(db, userId, { staff = false, now = Date.now(), limits = LIMITS } = {}) {
  const day = quotaDay(now);
  const global = db.prepare("SELECT count FROM usage WHERE user_id='*' AND day=?").get(day)?.count ?? 0;
  if (global >= limits.globalDaily) return { ok: false, reason: "global" };
  const row = db.prepare("SELECT count,last_at FROM usage WHERE user_id=? AND day=?").get(userId, day);
  const total = limits.daily + (db.prepare("SELECT count FROM usage WHERE user_id=? AND day=?").get(`bonus:${userId}`, day)?.count ?? 0);
  if (!staff) {
    if (row && now - row.last_at < limits.gapMs) return { ok: false, reason: "gap", waitSec: Math.ceil((limits.gapMs - (now - row.last_at)) / 1000) };
    if (row && row.count >= total) {
      db.prepare(`INSERT INTO usage(user_id,day,count,last_at) VALUES('reject:*',?,1,?) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1`).run(day, now);
      return { ok: false, reason: "daily", total };
    }
  }
  const bump = db.prepare(`INSERT INTO usage(user_id,day,count,last_at) VALUES(?,?,1,?)
    ON CONFLICT(user_id,day) DO UPDATE SET count=count+1,last_at=excluded.last_at`);
  bump.run(userId, day, now); bump.run("*", day, now);
  const used = (row?.count ?? 0) + 1;
  return { ok: true, left: staff ? Infinity : total - used, total };
}

/** Read-only view of today's quota (for "!남은횟수"). */
export function peekQuota(db, userId, { now = Date.now(), limits = LIMITS } = {}) {
  const day = quotaDay(now), get = (id) => db.prepare("SELECT count FROM usage WHERE user_id=? AND day=?").get(id, day)?.count ?? 0;
  const total = limits.daily + get(`bonus:${userId}`), used = get(userId);
  return { used, total, left: Math.max(0, total - used), bonus: total - limits.daily };
}

export const quotaMessage = (q) => ({
  global: "오늘 서버 전체 AI 사용량이 다 찼어요. 내일 오전 9시에 다시 열려요.",
  daily: `오늘 질문 ${q.total}개를 다 쓰셨어요. 내일 오전 9시에 충전돼요.\n-# 다른 사람의 #피드백-요청·#쇼케이스 글에 피드백을 달면 하루 최대 ${LIMITS.bonusMax}회 더 받을 수 있어요.`,
  gap: `조금만 천천히요. ${q.waitSec}초 뒤에 다시 물어봐 주세요.`,
})[q.reason];

const SECRETS = [
  /[MN][A-Za-z\d_-]{23,27}\.[\w-]{6}\.[\w-]{27,}/g, // Discord bot token
  /sk-[A-Za-z0-9_-]{20,}/g, /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, // JWT
  /gh[pousr]_[A-Za-z0-9]{30,}/g, /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
];
const PII = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /(?<!\d)010(?:-\d{4}-\d{4}|\d{8})(?!\d)/g,
];
export const redact = (text) => [...SECRETS, ...PII].reduce((s, re) => s.replace(re, "[가림]"), String(text));

export const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

/** Split for Discord's 2000-char limit, preferring line breaks, never breaking a ``` block open. */
export function chunk(text, max = 1900) {
  const out = []; let cur = "";
  for (const line of String(text).split("\n")) {
    if ((cur + "\n" + line).length > max && cur) { out.push(cur); cur = ""; }
    cur = cur ? cur + "\n" + line : line;
    while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) out.push(cur);
  // Re-balance code fences across chunks.
  for (let i = 0; i < out.length; i++) {
    if ((out[i].match(/```/g) || []).length % 2 === 1) { out[i] += "\n```"; if (out[i + 1] !== undefined) out[i + 1] = "```\n" + out[i + 1]; }
  }
  return out;
}

/** First JSON object in model output (models like to wrap it in prose or fences). */
export function extractJson(text) {
  const s = String(text); const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}

/** Member-authored text goes into prompts as quoted data, never as instructions. */
export const quote = (s, max = 300) => JSON.stringify(String(s).replace(/\s+/g, " ").slice(0, max));

export const ADMIN_ACTIONS = ["answer", "set_topic", "post_notice", "add_rule", "delete_messages", "timeout", "create_channel", "delete_channel", "implement_feature"];
/** Actions that run without a card. Everything else needs the Founder's 승인. */
export const DIRECT_ACTIONS = new Set(["answer", "set_topic"]);

export function validateAdminPlan(plan) {
  if (!plan || typeof plan !== "object" || !ADMIN_ACTIONS.includes(plan.action)) return null;
  const p = plan.params && typeof plan.params === "object" ? plan.params : {};
  const str = (v, max) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
  const need = { answer: ["text"], set_topic: ["channel", "topic"], post_notice: ["text"], add_rule: ["text"], delete_messages: ["channel"],
    timeout: ["user_id", "minutes"], create_channel: ["name"], delete_channel: ["channel"], implement_feature: ["description"] }[plan.action];
  const params = {};
  for (const [k, v] of Object.entries(p)) params[k] = typeof v === "number" ? v : str(v, 1800);
  if (need.some((k) => params[k] === undefined)) return null;
  if (plan.action === "timeout") params.minutes = Math.min(Math.max(Number(params.minutes) || 60, 1), 7 * 24 * 60);
  if (plan.action === "delete_messages") params.last = Math.min(Math.max(Number(params.last) || 20, 1), 100);
  return { action: plan.action, params, summary: str(plan.summary, 300) ?? plan.action };
}

/** Character-bigram Jaccard: good enough to spot "the same question asked again" in Korean without embeddings. */
const grams = (s) => { const t = String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
export function similarity(a, b) {
  const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}
// ponytail: linear scan over the FAQ table; fine for thousands of rows, add an index/embeddings if it ever gets slow.
export function bestFaq(rows, question, min = 0.3) {
  let best = null, score = min;
  for (const r of rows) { const s = similarity(question, r.question); if (s >= score) { best = r; score = s; } }
  return best && { ...best, score };
}

/** Keywords from subs that appear in text (case-insensitive, spaces ignored). Returns Map keyword -> [user ids]. */
export function matchSubs(rows, text) {
  const hay = String(text).toLowerCase().replace(/\s+/g, ""), hits = new Map();
  for (const { user_id, keyword } of rows) if (hay.includes(keyword.toLowerCase().replace(/\s+/g, ""))) hits.set(keyword, [...(hits.get(keyword) || []), user_id]);
  return hits;
}
