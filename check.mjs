// Self-check for the pure logic: node check.mjs
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { grantBonus, takeQuota, quotaDay, kstDate, kstMidnight, redact, chunk, extractJson, validateAdminPlan, LIMITS } from "./lib.mjs";
import { SCHEMA } from "./db.mjs";

const db = new DatabaseSync(":memory:"); db.exec(SCHEMA);
const t0 = Date.parse("2026-09-24T03:00:00Z"); // 12:00 KST
assert.equal(takeQuota(db, "u1", { now: t0 }).left, LIMITS.daily - 1);
assert.equal(takeQuota(db, "u1", { now: t0 + 1000 }).reason, "gap");
for (let i = 1; i < LIMITS.daily; i++) assert.ok(takeQuota(db, "u1", { now: t0 + i * LIMITS.gapMs }).ok);
assert.equal(takeQuota(db, "u1", { now: t0 + 99 * LIMITS.gapMs }).reason, "daily");
assert.ok(takeQuota(db, "u1", { now: t0 + 99 * LIMITS.gapMs, staff: true }).ok, "staff is unlimited");
assert.ok(takeQuota(db, "u1", { now: Date.parse("2026-09-25T00:00:01Z") }).ok, "refills at 09:00 KST");
assert.ok(grantBonus(db, "u1", { now: t0 }) && grantBonus(db, "u1", { now: t0 }) && grantBonus(db, "u1", { now: t0 }));
assert.equal(grantBonus(db, "u1", { now: t0 }), false, "bonus capped");
db.exec("DELETE FROM usage WHERE user_id='u1' AND day='2026-09-24'"); db.exec("INSERT INTO usage VALUES('u1','2026-09-24',5,0)");
assert.equal(takeQuota(db, "u1", { now: t0 + 999 * LIMITS.gapMs }).left, 2, "5 used of 5+3 → 2 left after this one");
assert.equal(quotaDay(Date.parse("2026-09-24T23:59:59Z")), "2026-09-24");
db.exec("UPDATE usage SET count=999 WHERE user_id='*'");
assert.equal(takeQuota(db, "u2", { now: Date.parse("2026-09-25T00:10:00Z") }).reason, "global");

assert.equal(kstDate(Date.parse("2026-09-23T15:00:00Z")), "2026-09-24");
assert.equal(kstMidnight("2026-09-24"), Date.parse("2026-09-23T15:00:00Z"));

assert.equal(redact("key sk-abcdefghijklmnopqrstuvwxyz0123 ok"), "key [가림] ok");
assert.ok(!redact(["MTUzNjIxODM5MzMwMzMyMjY1NA", "GAbcde", "abcdefghijklmnopqrstuvwxyz0123456"].join(".") /* built at runtime so secret scanners skip this fake token */).includes("GAbcde"));

const parts = chunk("```\n" + "x\n".repeat(1500) + "```");
assert.ok(parts.length > 1 && parts.every((p) => p.length <= 1910 && (p.match(/```/g) || []).length % 2 === 0));

assert.deepEqual(extractJson('sure! ```json\n{"a":{"b":"}"}}\n```'), { a: { b: "}" } });
assert.equal(extractJson("no json"), null);

assert.equal(validateAdminPlan({ action: "rm -rf", params: {} }), null);
assert.equal(validateAdminPlan({ action: "timeout", params: {} }), null);
assert.equal(validateAdminPlan({ action: "timeout", params: { user_id: "1", minutes: 99999 } }).params.minutes, 7 * 24 * 60);
assert.equal(validateAdminPlan({ action: "answer", params: { text: "hi" } }).action, "answer");

console.log("check ok");
