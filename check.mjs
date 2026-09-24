// Self-check for the pure logic: node check.mjs
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { matchSubs, bestFaq, similarity, grantBonus, peekQuota, takeQuota, quotaMessage, quotaDay, kstDate, kstMidnight, redact, chunk, extractJson, validateAdminPlan, pruneState, LIMITS } from "./lib.mjs";
import { SCHEMA } from "./db.mjs";
import { HELP_TEXT } from "./layout.mjs";

const help = HELP_TEXT((k) => `#${k}`);
assert.ok(help.length < 1900);
assert.ok(help.includes("!남은횟수"));

const db = new DatabaseSync(":memory:"); db.exec(SCHEMA);
const t0 = Date.parse("2026-09-24T03:00:00Z"); // 12:00 KST
assert.deepEqual(peekQuota(db, "new-user", { now: t0 }), { used: 0, total: LIMITS.daily, left: LIMITS.daily, bonus: 0 });
assert.equal(takeQuota(db, "u1", { now: t0 }).left, LIMITS.daily - 1);
const gap = takeQuota(db, "u1", { now: t0 + 1000 });
assert.equal(gap.reason, "gap");
assert.match(quotaMessage(gap), new RegExp(`${gap.waitSec}초`));
for (let i = 1; i < LIMITS.daily; i++) assert.ok(takeQuota(db, "u1", { now: t0 + i * LIMITS.gapMs }).ok);
const daily = takeQuota(db, "u1", { now: t0 + 99 * LIMITS.gapMs });
assert.equal(daily.reason, "daily");
assert.match(quotaMessage(daily), new RegExp(`${daily.total}개`));
assert.match(quotaMessage(daily), new RegExp(`${LIMITS.bonusMax}회`));
assert.ok(takeQuota(db, "u1", { now: t0 + 99 * LIMITS.gapMs, staff: true }).ok, "staff is unlimited");
assert.ok(takeQuota(db, "u1", { now: Date.parse("2026-09-25T00:00:01Z") }).ok, "refills at 09:00 KST");
assert.ok(grantBonus(db, "u1", { now: t0 }) && grantBonus(db, "u1", { now: t0 }) && grantBonus(db, "u1", { now: t0 }));
assert.equal(grantBonus(db, "u1", { now: t0 }), false, "bonus capped");
db.exec("DELETE FROM usage WHERE user_id='u1' AND day='2026-09-24'"); db.exec("INSERT INTO usage VALUES('u1','2026-09-24',5,0)");
assert.equal(takeQuota(db, "u1", { now: t0 + 999 * LIMITS.gapMs }).left, 2, "5 used of 5+3 → 2 left after this one");
assert.deepEqual(peekQuota(db, "u1", { now: t0 }), { used: 6, total: 8, left: 2, bonus: 3 });
assert.equal(quotaDay(Date.parse("2026-09-24T23:59:59Z")), "2026-09-24");
db.exec("UPDATE usage SET count=999 WHERE user_id='*'");
assert.equal(takeQuota(db, "u2", { now: Date.parse("2026-09-25T00:10:00Z") }).reason, "global");
assert.match(quotaMessage({ reason: "global" }), /서버 전체/);

assert.equal(kstDate(Date.parse("2026-09-23T15:00:00Z")), "2026-09-24");
assert.equal(kstMidnight("2026-09-24"), Date.parse("2026-09-23T15:00:00Z"));

assert.equal(redact("key sk-abcdefghijklmnopqrstuvwxyz0123 ok"), "key [가림] ok");
assert.ok(!redact(["MTUzNjIxODM5MzMwMzMyMjY1NA", "GAbcde", "abcdefghijklmnopqrstuvwxyz0123456"].join(".") /* built at runtime so secret scanners skip this fake token */).includes("GAbcde"));
assert.equal(redact("mail user@example.com, phones 010-1234-5678 / 01012345678"), "mail [가림], phones [가림] / [가림]");

const parts = chunk("```\n" + "x\n".repeat(1500) + "```");
assert.ok(parts.length > 1 && parts.every((p) => p.length <= 1910 && (p.match(/```/g) || []).length % 2 === 0));

assert.deepEqual(extractJson('sure! ```json\n{"a":{"b":"}"}}\n```'), { a: { b: "}" } });
assert.equal(extractJson("no json"), null);

assert.equal(validateAdminPlan({ action: "rm -rf", params: {} }), null);
assert.equal(validateAdminPlan({ action: "timeout", params: {} }), null);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: 99999 } }).params.minutes, 7 * 24 * 60);
assert.equal(validateAdminPlan({ action: "answer", params: { text: "hi" } }).action, "answer");

const pruneNow = Date.parse("2026-09-25T00:00:00Z");
for (const prefix of ["subsent:", "mentor:", "done:", "tries:", "boot:", "topics:", "summary:"]) {
  db.prepare("INSERT INTO kv(key,value) VALUES(?,?)").run(`${prefix}2026-08-01`, "1");
  db.prepare("INSERT INTO kv(key,value) VALUES(?,?)").run(`${prefix}2026-09-01`, "1");
}
db.exec("INSERT INTO kv(key,value) VALUES ('other:2026-08-01','1'), ('summary:undated','1')");
db.exec("INSERT INTO usage VALUES ('old','2026-07-01',1,0), ('recent','2026-09-01',1,0), ('undated','not-a-date',1,0)");
pruneState(db, pruneNow);
for (const prefix of ["subsent:", "mentor:", "done:", "tries:", "boot:", "topics:", "summary:"]) {
  assert.equal(db.prepare("SELECT count(*) n FROM kv WHERE key=?").get(`${prefix}2026-08-01`).n, 0);
}
assert.equal(db.prepare("SELECT count(*) n FROM kv WHERE key LIKE '%2026-09-01'").get().n, 7);
assert.equal(db.prepare("SELECT count(*) n FROM kv WHERE key IN ('other:2026-08-01','summary:undated')").get().n, 2);
assert.equal(db.prepare("SELECT count(*) n FROM usage WHERE day='2026-07-01'").get().n, 0);
assert.equal(db.prepare("SELECT count(*) n FROM usage WHERE day IN ('2026-09-01','not-a-date')").get().n, 2);

const faqRows = [{ id: 1, question: "Next.js 앱을 Vercel이랑 Railway 중 어디에 배포하는 게 나아?" }, { id: 2, question: "파이썬 리스트 뒤집는 방법" }];
assert.equal(bestFaq(faqRows, "넥스트 앱 Vercel Railway 중에 어디 배포하는게 나아요?")?.id, 1);
assert.equal(bestFaq(faqRows, "디스코드 봇 토큰은 어디서 받아?"), null);
assert.ok(similarity("abc", "abc") === 1 && similarity("", "abc") === 0);

const hits = matchSubs([{ user_id: "a", keyword: "MCP" }, { user_id: "b", keyword: "mcp" }, { user_id: "c", keyword: "Next js" }], "새 mcp 서버를 NextJS로 만들었어요");
assert.deepEqual([...hits.keys()].sort(), ["MCP", "Next js", "mcp"]);

console.log("check ok");
