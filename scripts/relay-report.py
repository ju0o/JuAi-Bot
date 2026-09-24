#!/usr/bin/env python3
"""Write JuAI-Relay.md (JuAi lane in Agent Relay + bot health) and copy it to the MainPC Desktop.
Read-only on everything except the report file itself. Never touches power."""
import json, os, subprocess, datetime, pathlib, sys
HOME = pathlib.Path.home()
DATA = HOME / ".local/share/AgentRelay/data/portfolio-execution"
REPO = HOME / "Desktop/Projects/JuAi-Bot"
OUT = REPO / "data/JuAI-Relay.md"
def sh(*a, cwd=None):
    try: return subprocess.run(a, cwd=cwd, capture_output=True, text=True, timeout=60).stdout.strip()
    except Exception as e: return f"(실패: {e})"
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
lines = [f"# JuAi × Agent Relay 야간 보고", f"작성: {now} (ASUS 자동 작성)", ""]
try:
    st = json.load(open(DATA / "state.json"))
    tasks = [t for t in (st.get("tasks") or {}).values()] if isinstance(st.get("tasks"), dict) else (st.get("tasks") or [])
    juai = [t for t in tasks if str(t.get("taskId", t.get("id", ""))).startswith("JUAI-")]
except Exception as e:
    juai, st = [], None; lines += [f"⚠️ Agent Relay 상태 파일을 읽지 못함: {e}", ""]
KO = {"PROMOTED": "완료(통합 브랜치 반영)", "HOLD": "보류", "RUNNING": "작업 중", "QA": "QA 중", "QUEUED": "대기", "DONE": "완료"}
lines += ["## Agent Relay 작업 (PM → Worker → QA)", ""]
if not juai: lines += ["- JuAi 작업 기록이 없어요. Agent Relay가 JuAi 작업을 아직 시작하지 않았거나 멈춘 상태예요.", ""]
for t in juai:
    tid = t.get("taskId") or t.get("id"); state = t.get("state") or t.get("status")
    qa = (t.get("qa") or {}).get("verdict") if isinstance(t.get("qa"), dict) else t.get("qaVerdict")
    gate = (t.get("testGate") or {}).get("state") if isinstance(t.get("testGate"), dict) else None
    lines.append(f"- **{tid}** · {KO.get(str(state), state)} · QA: {qa or '-'} · 테스트: {gate or '-'} · Worker: {t.get('runtime') or t.get('workerRuntime') or '-'}")
lines.append("")
log = sh("git", "log", "--oneline", "main..agent-relay/integration", cwd=REPO)
lines += ["## 통합 브랜치에 쌓인 변경 (아직 실서버 미반영)", "", "```", log or "(없음)", "```",
          "반영하려면 아침에 확인 후: `git -C ~/Desktop/Projects/JuAi-Bot merge --ff-only agent-relay/integration` → 봇 재시작", ""]
bot = sh("systemctl", "--user", "is-active", "juai-bot")
lines += ["## JuAi 봇 상태", "", f"- 서비스: {bot}", f"- 최근 오류: {sh('bash', '-c', 'journalctl --user -u juai-bot --since -6h --no-pager | grep -ciE \"⚠|error\" || true')}건 (최근 6시간)", ""]
lines += ["## 참고", "- 00:00 야간 실행은 systemd-run 실행 방식 문제로 00:01에 멈췄고, Agent Relay 담당 세션이 다시 시작했어요.",
          "- 'AI 답변에서 이메일·전화번호 가리기' 작업은 Agent Relay가 보안 영역으로 분류해 자동 진행하지 않았어요 (필요하면 직접 요청)."]
OUT.parent.mkdir(exist_ok=True); OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
# send-to-mainpc routes JuAI-* into Desktop\AI_Reports\JuAi\ (Founder's report folder) and verifies SHA-256.
r = subprocess.run([str(HOME / ".agents/skills/send-to-mainpc/scripts/send-to-mainpc.sh"), str(OUT)], capture_output=True, text=True, timeout=120)
print("SENT" if r.returncode == 0 else f"SEND_FAILED {r.stderr[-200:]}")
sys.exit(r.returncode)
