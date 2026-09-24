// systemd ExecStartPre: if a Founder-approved feature was just merged and the bot keeps failing to come up,
// put main back on the last good commit. bot.mjs deletes data/deploy.json once it is ONLINE.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const file = new URL("./data/deploy.json", import.meta.url);
if (existsSync(file)) {
  const d = JSON.parse(readFileSync(file, "utf8")); d.tries = (d.tries || 0) + 1;
  if (d.tries > 3) {
    execFileSync("git", ["reset", "--hard", d.prev], { cwd: new URL(".", import.meta.url) });
    rmSync(file); writeFileSync(new URL("./data/rollback.json", import.meta.url), JSON.stringify({ ...d, at: Date.now() }));
    console.log(`guard: 새 버전이 시작되지 않아 ${d.prev.slice(0, 7)}로 되돌렸어요 (card ${d.card})`);
  } else writeFileSync(file, JSON.stringify(d));
}
