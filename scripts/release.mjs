// node scripts/release.mjs [vX.Y.Z]
// Tag → push → GitHub release → release notes in #봇-소스코드. Runs only after the Founder approves a release card.
import { execFileSync } from "node:child_process";
process.chdir(new URL("..", import.meta.url).pathname);
const { env } = await import("../setup.mjs");
const { openDb, kvGet } = await import("../db.mjs");
const { ai } = await import("../ai.mjs");
const { chunk } = await import("../lib.mjs");

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const REPO = "ju0o/JuAi-Bot";
const last = sh("git", ["tag", "--list", "v*", "--sort=-v:refname"]).split("\n").filter(Boolean)[0];
const bump = (v) => { const [a, b] = v.slice(1).split(".").map(Number); return `v${a}.${b + 1}.0`; };
const version = process.argv[2] || (last ? bump(last) : "v1.0.0");
const subjects = sh("git", ["log", "--format=%s", last ? `${last}..HEAD` : "HEAD"]).split("\n").filter(Boolean);
if (!subjects.length) { console.log("NO_CHANGES"); process.exit(0); }

const notes = (await ai("claude", `JuAi 디스코드 봇의 새 버전 ${version} 릴리즈 노트를 한국어로 써줘. 아래 커밋 제목을 디스코드 멤버가 이해할 수 있는 말로 바꿔서 "### 새 기능", "### 개선", "### 고친 것" 제목 아래 • 목록으로 정리해 (항목당 한 줄, 기술 용어는 최소화, 비슷한 건 합치기, 최대 12줄). 해당 없는 제목은 빼. 마크다운만 출력.
${subjects.map((s) => `- ${s}`).join("\n")}`)).trim();

sh("git", ["tag", "-a", version, "-m", `JuAi Bot ${version}`]);
sh("git", ["push", "origin", "main"]);
sh("git", ["push", "origin", version]);
const url = `https://github.com/${REPO}/releases/tag/${version}`;
sh("gh", ["release", "create", version, "--repo", REPO, "--title", `JuAi Bot ${version}`, "--notes", `${notes}\n\n---\nMIT License · JuAi 디스코드: https://discord.gg/2zMkuxWzBr`]);

const channel = (kvGet(openDb(), "channels") || {}).source;
if (channel) {
  for (const content of chunk(`📦 **JuAi Bot ${version}** 릴리즈\n\n${notes}\n\n🔗 ${url}\n-# MIT 라이선스 · 누구나 가져다 써도 돼요`)) {
    const r = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, { method: "POST",
      headers: { Authorization: `Bot ${env.DISCORD_CLAUDE_BOT_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
    if (!r.ok) throw new Error(`디스코드 게시 실패 ${r.status}`);
  }
}
console.log(`RELEASED ${version} ${url}`);
