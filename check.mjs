// Self-check for the pure logic: node check.mjs
import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { PermissionFlagsBits } from "discord.js";
import { matchSubs, bestFaq, similarity, grantBonus, peekQuota, takeQuota, quotaMessage, quotaDay, kstDate, kstHour, kstDay, kstMidnight, redact, stripAnsi, quote, chunk, extractJson, validateAdminPlan, pruneState, LIMITS, SUB_DAILY, SUB_MAX, ADMIN_ACTIONS, DIRECT_ACTIONS, DAY_MS } from "./lib.mjs";
import { SCHEMA, kvGet, kvSet, openDb } from "./db.mjs";
import { CATEGORIES, CHANNELS, channelByKey, GUIDE, HELP_TEXT, ONBOARDING, ROLES, SOURCE_GUIDE, STAFF_GUIDE, SUMMARY_KEYS } from "./layout.mjs";

assert.equal(new Set(CHANNELS.map(({ key }) => key)).size, CHANNELS.length);
assert.equal(new Set(ROLES.map(({ key }) => key)).size, ROLES.length);
assert.ok(CATEGORIES.every(({ name }) => typeof name === "string" && name.trim()), "category names must be non-empty");
assert.equal(new Set(CATEGORIES.map(({ name }) => name)).size, CATEGORIES.length, "category names must be unique");
for (const category of CATEGORIES) {
  assert.ok(Array.isArray(category.channels) && category.channels.length > 0, `category has no channels: ${category.name}`);
  for (const { key } of category.channels) {
    assert.equal(CHANNELS.filter((channel) => channel.key === key).length, 1, `category channel must map exactly once: ${key}`);
  }
}
assert.ok(CHANNELS.every(({ name }) => typeof name === "string" && name.trim()), "channel names must be non-empty");
assert.equal(new Set(CHANNELS.map(({ name }) => name)).size, CHANNELS.length, "channel names must be unique");
assert.equal(new Set(ROLES.map(({ name }) => name)).size, ROLES.length, "role names must be unique");
for (const role of ROLES) assert.ok(Number.isInteger(role.color) && role.color >= 0 && role.color <= 0xFFFFFF, `role color must be an integer from 0 to 0xFFFFFF: ${role.key}`);
for (const role of ROLES) for (const perm of role.perms) {
  assert.ok(Object.hasOwn(PermissionFlagsBits, perm), `unknown role permission: ${role.key}/${perm}`);
}
const accessKinds = new Set(["open", "readonly", "botsonly", "private"]);
const channelTypes = new Set(["text", "forum", "voice"]);
for (const channel of CHANNELS) {
  assert.ok(accessKinds.has(channel.access), `unknown channel access: ${channel.key}`);
  assert.ok(channelTypes.has(channel.type), `unknown channel type: ${channel.key}`);
  const parent = CATEGORIES.find(({ channels }) => channels.some(({ key }) => key === channel.key));
  assert.ok(parent, `channel has no category: ${channel.key}`);
  assert.equal(channel.category, parent.name, `channel category mismatch: ${channel.key}`);
  if (channel.topic !== undefined) assert.ok(channel.topic.length <= 1024, `channel topic exceeds Discord limit: ${channel.key}`);
  if (channel.type === "voice") {
    assert.ok(!Object.hasOwn(channel, "topic"), `voice channel must not have a topic: ${channel.key}`);
    assert.ok(!Object.hasOwn(channel, "tags"), `voice channel must not have tags: ${channel.key}`);
  }
  if (channel.type === "forum") {
    assert.ok(Array.isArray(channel.tags) && channel.tags.length > 0, `forum has no tags: ${channel.key}`);
    assert.equal(new Set(channel.tags).size, channel.tags.length, `forum tags duplicate: ${channel.key}`);
    assert.ok(channel.tags.every((name) => name.length <= 20), `forum tag name exceeds Discord limit: ${channel.key}`);
  }
}
assert.ok(channelByKey.lab.topic.includes(String(LIMITS.daily)), "lab topic omits LIMITS.daily");
for (const key of SUMMARY_KEYS) {
  assert.ok(channelByKey[key]);
  assert.ok(!["private", "botsonly"].includes(channelByKey[key].access), `summary channel is inaccessible: ${key}`);
}
const roleKeys = new Set(ROLES.map(({ key }) => key));
assert.ok(channelByKey.chat, "setup.mjs sends role-less onboarding options to #chat");
for (const { title, single, required, options } of ONBOARDING) {
  assert.ok(title, "onboarding question needs a title");
  assert.ok(title.length <= 100, `onboarding question title exceeds Discord limit: ${title}`);
  assert.equal(typeof single, "boolean", `onboarding question single must be boolean: ${title}`);
  assert.equal(typeof required, "boolean", `onboarding question required must be boolean: ${title}`);
  assert.ok(options.length > 0, `onboarding question has no options: ${title}`);
  const optionTitles = new Set();
  for (const option of options) {
    const optionTitle = typeof option.title === "string" ? option.title.trim() : "";
    assert.ok(optionTitle, `onboarding option needs a title: ${title}`);
    assert.ok(option.title.length <= 50, `onboarding option title exceeds Discord limit: ${title} / ${optionTitle}`);
    if (option.description !== undefined) assert.ok(option.description.length <= 100, `onboarding option description exceeds Discord limit: ${title} / ${optionTitle}`);
    assert.ok(!optionTitles.has(optionTitle), `duplicate onboarding option title: ${title} / ${optionTitle}`);
    optionTitles.add(optionTitle);
    assert.ok(Array.isArray(option.roles), `onboarding option roles must be an array: ${title} / ${optionTitle}`);
    for (const key of option.roles) assert.ok(roleKeys.has(key), `unknown onboarding role key: ${key}`);
  }
}
const mention = (key) => {
  assert.ok(channelByKey[key], `unknown channel key: ${key}`);
  return `<#${"0".repeat(20)}>`;
};
assert.ok(GUIDE(mention).every((message) => message.length <= 2000));
assert.ok(GUIDE(mention).some((message) => message.includes(`질문 사이 ${LIMITS.gapMs / 1000}초`)), "guide omits LIMITS.gapMs");
assert.ok(GUIDE(mention).some((message) => message.includes("!구독 MCP") && message.includes(`최대 ${SUB_MAX}개`) && message.includes(`하루 매칭 알림 ${SUB_DAILY}회`)), "guide omits subscription caps");
assert.ok(GUIDE(mention).some((message) => message.includes("남의 글에 30자 이상 피드백") && message.includes(`하루 최대 ${LIMITS.bonusMax}회`)), "guide omits feedback bonus limit");

const help = HELP_TEXT(mention);
assert.ok(help.length <= 2000);
for (const command of ["!익명", "!봇수다", "리뷰해줘"]) assert.ok(help.includes(command));
assert.ok(help.includes("!남은횟수"));
for (const command of ["!구독", "!구독목록", "!구독취소"]) assert.ok(help.includes(command));
assert.ok(help.includes(`최대 ${SUB_MAX}개`) && help.includes(`하루 매칭 알림 ${SUB_DAILY}회`), "help omits subscription caps");
assert.ok(STAFF_GUIDE(mention).length <= 2000);
assert.ok(SOURCE_GUIDE.length <= 2000);
for (const placeholder of ["<#QA>", "<#SUGGEST>"]) assert.ok(SOURCE_GUIDE.includes(placeholder), `setup.mjs replaces ${placeholder}`);
assert.ok(channelByKey.qa && channelByKey.suggest, "setup.mjs fills SOURCE_GUIDE with #qa and #suggest");

assert.deepEqual([...DIRECT_ACTIONS].sort(), ["answer", "set_topic"]);
for (const action of DIRECT_ACTIONS) assert.ok(ADMIN_ACTIONS.includes(action));
for (const action of ["delete_messages", "timeout", "create_channel", "delete_channel", "implement_feature"]) {
  assert.ok(!DIRECT_ACTIONS.has(action));
}

const db = new DatabaseSync(":memory:"); db.exec(SCHEMA);
assert.deepEqual(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({ name }) => name),
  ["answers", "cards", "faq", "kv", "picks", "profiles", "subs", "talk_requests", "usage", "votes"]
);
const kvDb = new DatabaseSync(":memory:"); kvDb.exec(SCHEMA);
assert.equal(kvGet(kvDb, "missing"), undefined);
for (const [key, value] of [["string", "hello"], ["empty", ""], ["zero", 0], ["false", false], ["null", null], ["array", [1, "two"]], ["number", 42], ["boolean", true], ["object", { nested: [1, "two"] }]]) {
  kvSet(kvDb, key, value);
  assert.deepEqual(kvGet(kvDb, key), value);
}
const specialKey = "quote'\";--";
kvSet(kvDb, specialKey, { roundTrip: true });
assert.deepEqual(kvGet(kvDb, specialKey), { roundTrip: true });
assert.throws(() => kvSet(kvDb, "undefined", undefined));
kvSet(kvDb, "replace", 1);
kvSet(kvDb, "replace", { replaced: true });
assert.deepEqual(kvGet(kvDb, "replace"), { replaced: true });
assert.equal(kvDb.prepare("SELECT count(*) AS count FROM kv WHERE key=?").get("replace").count, 1);
const dbDir = fs.mkdtempSync(`${os.tmpdir()}/`);
try {
  const diskDb = openDb(dbDir);
  assert.ok(fs.existsSync(`${dbDir}/juai.db`));
  assert.equal(diskDb.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
  kvSet(diskDb, "persisted", { value: true });
  diskDb.close();
  let reopened;
  assert.doesNotThrow(() => { reopened = openDb(dbDir); });
  assert.deepEqual(kvGet(reopened, "persisted"), { value: true });
  assert.ok(reopened.prepare("PRAGMA table_info(picks)").all().some(({ name }) => name === "msg_id"));
  reopened.close();
} finally {
  fs.rmSync(dbDir, { recursive: true, force: true });
}
const t0 = Date.parse("2026-09-24T03:00:00Z"); // 12:00 KST
assert.deepEqual(peekQuota(db, "new-user", { now: t0 }), { used: 0, total: LIMITS.daily, left: LIMITS.daily, bonus: 0 });
assert.equal(takeQuota(db, "u1", { now: t0 }).left, LIMITS.daily - 1);
const gap = takeQuota(db, "u1", { now: t0 + 1000 });
assert.equal(gap.reason, "gap");
assert.match(quotaMessage(gap), new RegExp(`${gap.waitSec}초`));
const gapDb = new DatabaseSync(":memory:"); gapDb.exec(SCHEMA);
const gapDay = "2026-09-24";
const gapCount = () => gapDb.prepare("SELECT count FROM usage WHERE user_id='*' AND day=?").get(gapDay)?.count ?? 0;
assert.equal(takeQuota(gapDb, "gap-member", { now: t0 }).ok, true);
assert.equal(gapCount(), 1);
const earlyGap = takeQuota(gapDb, "gap-member", { now: t0 + LIMITS.gapMs - 1 });
assert.equal(earlyGap.reason, "gap");
assert.equal(earlyGap.waitSec, 1);
assert.equal(gapCount(), 1);
assert.equal(takeQuota(gapDb, "gap-member", { now: t0 + LIMITS.gapMs }).ok, true);
assert.equal(gapCount(), 2);
assert.equal(takeQuota(gapDb, "gap-staff", { now: t0, staff: true }).ok, true);
assert.equal(takeQuota(gapDb, "gap-staff", { now: t0 + LIMITS.gapMs - 1, staff: true }).ok, true);
assert.equal(gapCount(), 4);
for (let i = 1; i < LIMITS.daily; i++) assert.ok(takeQuota(db, "u1", { now: t0 + i * LIMITS.gapMs }).ok);
const daily = takeQuota(db, "u1", { now: t0 + 99 * LIMITS.gapMs });
assert.equal(daily.reason, "daily");
assert.match(quotaMessage(daily), new RegExp(`${daily.total}개`));
assert.match(quotaMessage(daily), new RegExp(`${LIMITS.bonusMax}회`));
assert.equal(db.prepare("SELECT count FROM usage WHERE user_id='reject:*' AND day='2026-09-24'").get().count, 1);
assert.equal(takeQuota(db, "u1", { now: t0 + 99 * LIMITS.gapMs, staff: true }).left, Infinity);
assert.ok(takeQuota(db, "u1", { now: Date.parse("2026-09-25T00:00:01Z") }).ok, "refills at 09:00 KST");
assert.ok(grantBonus(db, "u1", { now: t0 }) && grantBonus(db, "u1", { now: t0 }) && grantBonus(db, "u1", { now: t0 }));
assert.equal(grantBonus(db, "u1", { now: t0 }), false, "bonus capped");
db.exec("DELETE FROM usage WHERE user_id='u1' AND day='2026-09-24'"); db.exec("INSERT INTO usage VALUES('u1','2026-09-24',5,0)");
assert.equal(takeQuota(db, "u1", { now: t0 + 999 * LIMITS.gapMs }).left, 2, "5 used of 5+3 → 2 left after this one");
assert.deepEqual(peekQuota(db, "u1", { now: t0 }), { used: 6, total: 8, left: 2, bonus: 3 });
assert.equal(quotaDay(Date.parse("2026-09-24T23:59:59Z")), "2026-09-24");
assert.equal(quotaDay(Date.parse("2026-09-25T00:00:00Z")), "2026-09-25");
db.exec("UPDATE usage SET count=999 WHERE user_id='*'");
assert.equal(takeQuota(db, "u2", { now: Date.parse("2026-09-25T00:10:00Z") }).reason, "global");
assert.match(quotaMessage({ reason: "global" }), /서버 전체/);

const quotaDb = new DatabaseSync(":memory:"); quotaDb.exec(SCHEMA);
const customLimits = { ...LIMITS, daily: 1, bonusMax: 1 };
const zeroBonusLimits = { ...LIMITS, bonusMax: 0 };
const quotaNow = Date.parse("2026-09-26T03:00:00Z");
const rejectDb = new DatabaseSync(":memory:"); rejectDb.exec(SCHEMA);
assert.equal(takeQuota(rejectDb, "reject-member", { now: quotaNow, limits: customLimits }).ok, true);
const customDaily = takeQuota(rejectDb, "reject-member", { now: quotaNow + customLimits.gapMs, limits: customLimits });
assert.equal(customDaily.reason, "daily");
assert.match(quotaMessage(customDaily), new RegExp(`${LIMITS.bonusMax}회`));
assert.equal(takeQuota(rejectDb, "reject-member", { now: quotaNow + 2 * customLimits.gapMs, limits: customLimits }).reason, "daily");
assert.equal(rejectDb.prepare("SELECT count FROM usage WHERE user_id='reject-member' AND day='2026-09-26'").get().count, 1);
assert.equal(rejectDb.prepare("SELECT count FROM usage WHERE user_id='*' AND day='2026-09-26'").get().count, 1);
assert.equal(rejectDb.prepare("SELECT count FROM usage WHERE user_id='reject:*' AND day='2026-09-26'").get().count, 2);
assert.equal(takeQuota(quotaDb, "staff", { now: quotaNow, limits: customLimits }).ok, true);
assert.equal(takeQuota(quotaDb, "staff", { now: quotaNow + 1000, staff: true, limits: customLimits }).ok, true);
assert.deepEqual(peekQuota(quotaDb, "staff", { now: quotaNow, limits: customLimits }), { used: 2, total: 1, left: 0, bonus: 0 });
assert.equal(quotaMessage({ reason: "unknown" }), undefined);
assert.deepEqual(peekQuota(quotaDb, "custom", { now: quotaNow, limits: customLimits }), { used: 0, total: 1, left: 1, bonus: 0 });
assert.equal(grantBonus(quotaDb, "custom", { now: quotaNow, limits: customLimits }), true);
assert.equal(grantBonus(quotaDb, "custom", { now: quotaNow, limits: customLimits }), false);
assert.deepEqual(peekQuota(quotaDb, "custom", { now: quotaNow, limits: customLimits }), { used: 0, total: 2, left: 2, bonus: 1 });
assert.equal(takeQuota(quotaDb, "custom", { now: quotaNow, limits: customLimits }).left, 1);
assert.equal(grantBonus(quotaDb, "zero-bonus", { now: quotaNow, limits: zeroBonusLimits }), false);
const bonusDb = new DatabaseSync(":memory:"); bonusDb.exec(SCHEMA);
const bonusNow = Date.parse("2026-09-26T00:00:00Z");
assert.equal(grantBonus(bonusDb, "capped", { now: bonusNow, limits: customLimits }), true);
assert.equal(grantBonus(bonusDb, "capped", { now: bonusNow, limits: customLimits }), false);
assert.equal(grantBonus(bonusDb, "other", { now: bonusNow, limits: customLimits }), true);
const nextBonusDay = Date.parse("2026-09-27T00:00:00Z");
assert.deepEqual(peekQuota(bonusDb, "capped", { now: nextBonusDay, limits: customLimits }), { used: 0, total: 1, left: 1, bonus: 0 });
assert.equal(grantBonus(bonusDb, "capped", { now: nextBonusDay, limits: customLimits }), true);
const globalDb = new DatabaseSync(":memory:"); globalDb.exec(SCHEMA);
globalDb.prepare("INSERT INTO usage VALUES('*','2026-09-26',?,?)").run(customLimits.globalDaily, quotaNow);
assert.equal(takeQuota(globalDb, "staff-global", { now: quotaNow, staff: true, limits: customLimits }).reason, "global");

assert.equal(kstDate(Date.parse("2026-09-23T15:00:00Z")), "2026-09-24");
assert.equal(kstHour(Date.parse("2026-09-23T14:59:59Z")), 23);
assert.equal(kstHour(Date.parse("2026-09-23T15:00:00Z")), 0);
assert.equal(kstDay(Date.parse("2026-09-23T14:59:59Z")), 3);
assert.equal(kstDay(Date.parse("2026-09-23T15:00:00Z")), 4);
assert.equal(kstMidnight("2026-09-24"), Date.parse("2026-09-23T15:00:00Z"));
for (const [d, prev] of [["2026-09-24", "2026-09-23"], ["2026-09-30", "2026-09-29"], ["2026-12-31", "2026-12-30"], ["2026-10-01", "2026-09-30"], ["2027-01-01", "2026-12-31"]]) {
  assert.equal(kstDate(kstMidnight(d)), d);
  assert.equal(kstHour(kstMidnight(d)), 0);
  assert.equal(kstDate(kstMidnight(d) - 1), prev);
  assert.equal(quotaDay(kstMidnight(d) + 9 * 3_600_000), d); // quota rolls over at 09:00 KST
}

let b = Date.now(), defaultDate = kstDate(), a = Date.now();
assert.ok(defaultDate === kstDate(b) || defaultDate === kstDate(a), "kstDate() default now mismatch");
b = Date.now(); const defaultHour = kstHour(); a = Date.now();
assert.ok(defaultHour >= 0 && defaultHour <= 23, "kstHour() out of range");
assert.ok(defaultHour === kstHour(b) || defaultHour === kstHour(a), "kstHour() default now mismatch");
b = Date.now(); const defaultDay = kstDay(); a = Date.now();
assert.ok(defaultDay >= 0 && defaultDay <= 6, "kstDay() out of range");
assert.ok(defaultDay === kstDay(b) || defaultDay === kstDay(a), "kstDay() default now mismatch");
b = Date.now(); const defaultQuotaDay = quotaDay(); a = Date.now();
assert.ok(defaultQuotaDay === quotaDay(b) || defaultQuotaDay === quotaDay(a), "quotaDay() default now mismatch");

assert.equal(redact("key sk-abcdefghijklmnopqrstuvwxyz0123 ok"), "key [가림] ok");
const discordToken = ["M" + "A".repeat(23), "abc123", "x".repeat(27)].join(".");
assert.equal(redact(`before ${discordToken} after`), "before [가림] after");
assert.ok(!redact(["MTUzNjIxODM5MzMwMzMyMjY1NA", "GAbcde", "abcdefghijklmnopqrstuvwxyz0123456"].join(".") /* built at runtime so secret scanners skip this fake token */).includes("GAbcde"));
assert.equal(redact(["eyJ" + "a".repeat(10), "b".repeat(10), "c".repeat(10)].join(".")), "[가림]");
assert.equal(redact("token gh" + "p_" + "a".repeat(30)), "token [가림]");
assert.equal(redact("key AKIA" + "A".repeat(16)), "key [가림]");
assert.equal(redact("key -----BEGIN " + "RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----"), "key [가림]");
assert.equal(redact("mail user@example.com, phones 010-1234-5678 / 01012345678"), "mail [가림], phones [가림] / [가림]");
assert.equal(redact("mail USER@Example.COM"), "mail [가림]");
assert.equal(redact("call 011-1234-5678 or 0101234567890"), "call 011-1234-5678 or 0101234567890");
assert.equal(redact("call 1010-1234-5678 or 101012345678"), "call 1010-1234-5678 or 101012345678");
assert.equal(redact("a 010-1111-2222 b 010-3333-4444"), "a [가림] b [가림]");
assert.equal(quote("  a \n b  "), JSON.stringify(" a b "));
assert.equal(quote("123456", 3), '"123"');
assert.equal(quote("x".repeat(301)), JSON.stringify("x".repeat(300)));
assert.equal(quote('"x"'), '"\\"x\\""');
assert.equal(stripAnsi("hello \x1b[31mred\x1b[0m!"), "hello red!");
assert.equal(stripAnsi("\x1b[1;32mok\x1b[0m"), "ok");
assert.equal(stripAnsi("a\x1b[2Kb"), "ab");
assert.equal(stripAnsi("[31m"), "[31m");

const parts = chunk("```\n" + "x\n".repeat(1500) + "```");
assert.ok(parts.length > 1 && parts.every((p) => p.length <= 1910 && (p.match(/```/g) || []).length % 2 === 0));
assert.deepEqual(chunk("abcdefghij", 3), ["abc", "def", "ghi", "j"]);
assert.deepEqual(chunk("aaa\nbbb\nccc", 7), ["aaa\nbbb", "ccc"]);
assert.deepEqual(chunk(""), []);
assert.deepEqual(chunk("abc", 3), ["abc"]);
assert.deepEqual(chunk("ab\ncd", 5), ["ab\ncd"]);
assert.deepEqual(chunk("```\naaaa\nbbbb\n```", 9), ["```\naaaa\n```", "```\nbbbb\n```"]);
assert.deepEqual(chunk("```\nabc"), ["```\nabc\n```"]);
const longCodeLineParts = chunk("```\n" + "x".repeat(25) + "\n```", 10);
assert.ok(longCodeLineParts.length > 1 && longCodeLineParts.every((p) => p.length <= 18 && (p.match(/```/g) || []).length % 2 === 0));

assert.deepEqual(extractJson('sure! ```json\n{"a":{"b":"}"}}\n```'), { a: { b: "}" } });
assert.equal(extractJson("no json"), null);
assert.equal(extractJson('{"a":1'), null);
assert.equal(extractJson('{a:1}'), null);
assert.deepEqual(extractJson('{"x":"q\\"}"}'), { x: 'q"}' });
assert.deepEqual(extractJson('{"a":1} {"b":2}'), { a: 1 });
assert.deepEqual(extractJson('x } {"a":1}'), { a: 1 });

assert.equal(validateAdminPlan({ action: "rm -rf", params: {} }), null);
assert.equal(validateAdminPlan(null), null);
assert.equal(validateAdminPlan("plan"), null);
assert.equal(validateAdminPlan({}), null);
assert.equal(validateAdminPlan({ action: "answer", params: "x" }), null);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: "30" } }).params.minutes, 30);
assert.equal(validateAdminPlan({ action: "answer", params: { text: "hi", count: 3 } }).params.count, 3);
assert.equal(validateAdminPlan({ action: "timeout", params: {} }), null);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: 99999 } }).params.minutes, 7 * 24 * 60);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: -1 } }).params.minutes, 1);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: "invalid" } }).params.minutes, 60);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: 0 } }).params.minutes, 60);
assert.equal(validateAdminPlan({ action: "delete_messages", params: { channel: "general", last: 0 } }).params.last, 20);
assert.equal(validateAdminPlan({ action: "delete_messages", params: { channel: "general", last: -1 } }).params.last, 1);
assert.equal(validateAdminPlan({ action: "delete_messages", params: { channel: "general", last: 999 } }).params.last, 100);
assert.equal(validateAdminPlan({ action: "delete_messages", params: { channel: "general", last: "invalid" } }).params.last, 20);
assert.equal(validateAdminPlan({ action: "create_channel", params: {} }), null);
assert.equal(validateAdminPlan({ action: "create_channel", params: { name: true } }), null);
assert.deepEqual(validateAdminPlan({ action: "create_channel", params: { name: "updates" } }), { action: "create_channel", params: { name: "updates" }, summary: "create_channel" });
assert.deepEqual(validateAdminPlan({ action: "create_channel", params: { name: 42 } }), { action: "create_channel", params: { name: 42 }, summary: "create_channel" });
assert.equal(validateAdminPlan({ action: "delete_channel", params: {} }), null);
assert.deepEqual(validateAdminPlan({ action: "delete_channel", params: { channel: "updates" } }), { action: "delete_channel", params: { channel: "updates" }, summary: "delete_channel" });
assert.equal(validateAdminPlan({ action: "implement_feature", params: {} }), null);
assert.deepEqual(validateAdminPlan({ action: "implement_feature", params: { description: "add a feature" } }), { action: "implement_feature", params: { description: "add a feature" }, summary: "implement_feature" });
assert.equal(validateAdminPlan({ action: "implement_feature", params: { description: "x".repeat(1900) } }).params.description.length, 1800);
assert.equal(validateAdminPlan({ action: "answer", params: {} }), null);
assert.equal(validateAdminPlan({ action: "answer", params: { text: "hi" } }).summary, "answer");
assert.equal(validateAdminPlan({ action: "answer", params: { text: "hi" } }).action, "answer");
assert.equal(validateAdminPlan({ action: "set_topic", params: { channel: "general" } }), null);
assert.equal(validateAdminPlan({ action: "set_topic", params: { channel: "general", topic: "   " } }), null);
assert.deepEqual(validateAdminPlan({ action: "set_topic", params: { channel: "  general  ", topic: "  hello  " } }), { action: "set_topic", params: { channel: "general", topic: "hello" }, summary: "set_topic" });
assert.equal(validateAdminPlan({ action: "post_notice", params: {} }), null);
assert.deepEqual(validateAdminPlan({ action: "post_notice", params: { text: "  notice  " } }), { action: "post_notice", params: { text: "notice" }, summary: "post_notice" });
assert.equal(validateAdminPlan({ action: "add_rule", params: {} }), null);
assert.deepEqual(validateAdminPlan({ action: "add_rule", params: { text: "  rule  " } }), { action: "add_rule", params: { text: "rule" }, summary: "add_rule" });
const longText = "x".repeat(1900);
const boundedPlan = validateAdminPlan({ action: "answer", params: { text: longText }, summary: "y".repeat(400) });
assert.equal(boundedPlan.params.text.length, 1800);
assert.equal(boundedPlan.summary.length, 300);
assert.equal(validateAdminPlan({ action: "set_topic", params: { channel: "general", topic: "hello" }, summary: "   " }).summary, "set_topic");

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

const boundaryDb = new DatabaseSync(":memory:"); boundaryDb.exec(SCHEMA);
const boundaryNow = Date.parse("2026-09-25T00:00:00Z");
boundaryDb.exec("INSERT INTO kv VALUES ('done:2026-08-11','1'), ('done:2026-08-10','1')");
boundaryDb.exec("INSERT INTO usage VALUES ('kept','2026-07-27',1,0), ('deleted','2026-07-26',1,0)");
pruneState(boundaryDb, boundaryNow);
assert.equal(boundaryDb.prepare("SELECT count(*) n FROM kv WHERE key='done:2026-08-11'").get().n, 1);
assert.equal(boundaryDb.prepare("SELECT count(*) n FROM kv WHERE key='done:2026-08-10'").get().n, 0);
assert.equal(boundaryDb.prepare("SELECT count(*) n FROM usage WHERE day='2026-07-27'").get().n, 1);
assert.equal(boundaryDb.prepare("SELECT count(*) n FROM usage WHERE day='2026-07-26'").get().n, 0);

const userKeyDb = new DatabaseSync(":memory:"); userKeyDb.exec(SCHEMA);
const userKeyNow = Date.parse("2026-09-25T00:00:00Z");
for (const prefix of ["mentor:", "subsent:"]) {
  userKeyDb.prepare("INSERT INTO kv VALUES (?, 'old')").run(`${prefix}user-1:2026-08-10`);
  userKeyDb.prepare("INSERT INTO kv VALUES (?, 'recent')").run(`${prefix}user-1:2026-08-11`);
}
pruneState(userKeyDb, userKeyNow);
for (const prefix of ["mentor:", "subsent:"]) {
  assert.equal(userKeyDb.prepare("SELECT count(*) n FROM kv WHERE key=?").get(`${prefix}user-1:2026-08-10`).n, 0);
  assert.equal(userKeyDb.prepare("SELECT value FROM kv WHERE key=?").get(`${prefix}user-1:2026-08-11`).value, "recent");
}
const userKeyAfterPrune = userKeyDb.prepare("SELECT key, value FROM kv ORDER BY key").all();
pruneState(userKeyDb, userKeyNow);
assert.deepEqual(userKeyDb.prepare("SELECT key, value FROM kv ORDER BY key").all(), userKeyAfterPrune);

const invalidDateDb = new DatabaseSync(":memory:"); invalidDateDb.exec(SCHEMA);
invalidDateDb.exec("INSERT INTO kv VALUES ('done:2026-13-45','1'), ('done:2026-01-01','1')");
invalidDateDb.exec("INSERT INTO usage VALUES ('invalid-day','2026-02-30',1,0)");
assert.doesNotThrow(() => pruneState(invalidDateDb, Date.parse("2026-04-30T00:00:00Z")));
assert.equal(invalidDateDb.prepare("SELECT count(*) n FROM kv WHERE key='done:2026-13-45'").get().n, 1);
assert.equal(invalidDateDb.prepare("SELECT count(*) n FROM kv WHERE key='done:2026-01-01'").get().n, 0);
assert.equal(invalidDateDb.prepare("SELECT count(*) n FROM usage WHERE day='2026-02-30'").get().n, 1);

const bonusPruneDb = new DatabaseSync(":memory:"); bonusPruneDb.exec(SCHEMA);
const bonusPruneNow = Date.parse("2026-09-25T00:00:00Z");
grantBonus(bonusPruneDb, "u1", { now: bonusPruneNow - 61 * DAY_MS });
grantBonus(bonusPruneDb, "u1", { now: bonusPruneNow - 10 * DAY_MS });
bonusPruneDb.exec("INSERT INTO usage VALUES ('u2','2026-07-01',1,0)");
pruneState(bonusPruneDb, bonusPruneNow);
assert.equal(bonusPruneDb.prepare("SELECT count(*) n FROM usage WHERE user_id='bonus:u1' AND day=?").get(quotaDay(bonusPruneNow - 61 * DAY_MS)).n, 0);
assert.equal(bonusPruneDb.prepare("SELECT count(*) n FROM usage WHERE user_id='bonus:u1' AND day=?").get(quotaDay(bonusPruneNow - 10 * DAY_MS)).n, 1);
assert.equal(bonusPruneDb.prepare("SELECT count(*) n FROM usage WHERE user_id='u2'").get().n, 0);

const faqRows = [{ id: 1, question: "Next.js 앱을 Vercel이랑 Railway 중 어디에 배포하는 게 나아?" }, { id: 2, question: "파이썬 리스트 뒤집는 방법" }];
assert.equal(bestFaq([], "anything"), null);
assert.equal(bestFaq(faqRows, "넥스트 앱 Vercel Railway 중에 어디 배포하는게 나아요?")?.id, 1);
assert.ok(bestFaq(faqRows, "넥스트 앱 Vercel Railway 중에 어디 배포하는게 나아요?").score >= 0.3);
assert.equal(bestFaq(faqRows, "디스코드 봇 토큰은 어디서 받아?"), null);
assert.equal(bestFaq(faqRows, "넥스트 앱 Vercel Railway 중에 어디 배포하는게 나아요?", 1), null);
assert.ok(similarity("abc", "abc") === 1 && similarity("", "abc") === 0);
assert.equal(similarity("Hello, World!", "hello world"), 1);
assert.equal(similarity("a", "a"), 0);
assert.equal(similarity("hello world", "hello worlds"), similarity("hello worlds", "hello world"));
const rankedFaq = bestFaq([{ id: 1, question: "hello worlds" }, { id: 2, question: "hello world" }], "hello world");
assert.ok(similarity("hello worlds", "hello world") >= 0.3);
assert.equal(rankedFaq?.id, 2);
assert.equal(rankedFaq?.score, similarity("hello world", "hello world"));
assert.equal(bestFaq([{ id: 1, question: "same question" }, { id: 2, question: "same question" }], "same question")?.id, 2);

const hits = matchSubs([{ user_id: "a", keyword: "MCP" }, { user_id: "b", keyword: "mcp" }, { user_id: "c", keyword: "Next js" }], "새 mcp 서버를 NextJS로 만들었어요");
assert.deepEqual(matchSubs([], "MCP 서버"), new Map());
assert.deepEqual(matchSubs([{ user_id: "a", keyword: "" }], "any text"), new Map([["", ["a"]]]));
assert.deepEqual([...hits.keys()].sort(), ["MCP", "Next js", "mcp"]);
assert.deepEqual(matchSubs([{ user_id: "a", keyword: "MCP" }, { user_id: "x", keyword: "MCP" }], "MCP 서버"), new Map([["MCP", ["a", "x"]]]));
assert.deepEqual(matchSubs([{ user_id: "a", keyword: "discord bot" }], "DiscordBot 만들기"), new Map([["discord bot", ["a"]]]));
assert.deepEqual(matchSubs([{ user_id: "a", keyword: "MCP" }], "discord"), new Map());

const subDb = new DatabaseSync(":memory:"); subDb.exec(SCHEMA);
const addSubscription = (userId, keyword) => {
  const mine = subDb.prepare("SELECT keyword FROM subs WHERE user_id=?").all(userId).map(({ keyword: value }) => value);
  if (mine.length >= SUB_MAX && !mine.includes(keyword)) return false;
  subDb.prepare("INSERT OR IGNORE INTO subs(user_id,keyword) VALUES(?,?)").run(userId, keyword);
  return true;
};
for (let i = 0; i < SUB_MAX; i++) assert.equal(addSubscription("subscriber", `word-${i}`), true);
assert.equal(addSubscription("subscriber", "word-new"), false, "subscription max must reject a new keyword");
assert.equal(addSubscription("subscriber", "word-0"), true, "subscription max must allow an existing keyword");
assert.equal(subDb.prepare("SELECT count(*) AS count FROM subs WHERE user_id=?").get("subscriber").count, SUB_MAX);

const subscriptionNotifications = (userId, authorId, sent) => {
  if (userId === authorId || sent >= SUB_DAILY) return false;
  subDb.prepare("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(`subsent:${userId}:2026-09-27`, String(sent + 1));
  return true;
};
for (let sent = 0; sent < SUB_DAILY; sent++) assert.equal(subscriptionNotifications("subscriber", "other", sent), true);
assert.equal(subscriptionNotifications("subscriber", "other", SUB_DAILY), false, "subscription notifications must stop at the daily limit");
assert.equal(kvGet(subDb, "subsent:subscriber:2026-09-27"), SUB_DAILY);

console.log("check ok");
