// Runs the installed AI CLIs one at a time. Member text reaches these prompts, so:
// - Claude runs with every tool disabled.
// - OpenCode and Codex run inside bwrap with a throwaway home (no real files, no tokens).
// - The child env never contains the Discord tokens (they are parsed from .env, not put in process.env).
// - All output is passed through redact() before it can reach Discord.
import { spawn } from "node:child_process";
import { mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { redact, stripAnsi } from "./lib.mjs";

const HOME = homedir();
const SANDBOX = path.resolve("data/sandbox-home");
const CODEX_BIN = realpathSync(path.join(HOME, ".local/bin/codex")); // lives under ~/.codex, which the sandbox binds
const OPENCODE_MODEL = process.env.JUAI_OPENCODE_MODEL || "opencode/muse-spark-1.3-contributor-free";
const CHILD_ENV = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "LC_ALL", "TERM", "XDG_RUNTIME_DIR", "CLAUDE_CONFIG_DIR"].filter((k) => process.env[k]).map((k) => [k, process.env[k]]));

mkdirSync(SANDBOX, { recursive: true });
mkdirSync(path.resolve("data/claude-cwd"), { recursive: true });

const bwrap = (extra, cmd) => ["bwrap", ["--ro-bind", "/", "/", "--bind", SANDBOX, HOME, ...extra, "--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp",
  "--die-with-parent", "--unshare-pid", "--chdir", HOME, ...cmd]];

function command(engine, prompt, model, cwd) {
  // Founder-approved feature work only: edits the bot repo worktree it is given.
  if (engine === "claude-dev") return ["claude", ["-p", "--model", "sonnet", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(node check.mjs)", "--no-session-persistence", prompt], cwd];
  if (engine === "claude") return ["claude", ["-p", "--model", model || "haiku", "--tools", "", "--no-session-persistence", prompt], path.resolve("data/claude-cwd")];
  if (engine === "codex") return [...bwrap(["--bind", path.join(HOME, ".codex"), path.join(HOME, ".codex")],
    [CODEX_BIN, "exec", "--skip-git-repo-check", "-s", "read-only", "--ephemeral", "--color", "never", prompt]), undefined];
  if (engine === "opencode") return [...bwrap([], ["opencode", "run", "-m", model || OPENCODE_MODEL, prompt]), undefined];
  throw new Error(`unknown engine ${engine}`);
}

function run(engine, prompt, { model, cwd: workdir, timeoutMs = 180_000 } = {}) {
  const [bin, args, cwd] = command(engine, prompt, model, workdir);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env: CHILD_ENV, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => { out += d; }); child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      let text = stripAnsi(out);
      if (engine === "opencode") text = text.split("\n").filter((l) => !/^> \S+ · /.test(l)).join("\n");
      text = text.trim();
      if (code !== 0 || !text) return reject(new Error(`${engine} exit ${code}: ${stripAnsi(err).trim().split("\n").slice(-2).join(" ").slice(0, 300)}`));
      resolve(redact(text));
    });
  });
}

// ponytail: one global queue keeps ASUS light; per-engine queues if members wait too long.
let queue = Promise.resolve();
export let pending = 0;
export function ai(engine, prompt, opts) {
  pending++;
  const job = queue.then(() => run(engine, prompt, opts)).finally(() => { pending--; });
  queue = job.catch(() => {});
  return job;
}

/** Tiny debug hook: node ai.mjs opencode "질문" */
if (import.meta.url === `file://${process.argv[1]}`) {
  const [engine, ...rest] = process.argv.slice(2);
  ai(engine, rest.join(" ")).then(console.log, (e) => { console.error(e.message); process.exit(1); });
}
