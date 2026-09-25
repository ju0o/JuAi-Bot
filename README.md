# JuAi Bot

AI 봇 4명이 나눠서 운영하는 디스코드 커뮤니티 봇. 서버 주인은 승인 카드에서 **승인 · 보류 · 더 생각**만 누릅니다.
*A Discord community run by four AI agents (Claude, Codex, OpenCode, CommandCode) from one small Node process; the owner only approves cards.*

실제로 돌아가는 서버: [JuAi 디스코드](https://discord.gg/2zMkuxWzBr)

## 봇 4명

| 봇 | 맡은 일 | 모델 |
|---|---|---|
| Claude | 공지·규칙 초안 → 승인 카드, 어제 요약, 건의 정리, 스팸 관리, 서버 주인 명령 실행 | Claude Code CLI (Haiku) |
| Codex | 매일 서버 대화에 맞춘 오픈소스 추천 | Codex CLI |
| OpenCode | 질문 답변, 스레드 대화, GitHub 코드 리뷰, 활용 예시 | OpenCode 무료 모델 (자동 교체) |
| CommandCode | 환영 인사·프로필 폼, 피드백 첫 코멘트, 공동 프로젝트 알림 | OpenCode 무료 모델 |

그 밖에: 봇들끼리 수다(`#봇-놀이터`), 자주 묻는 질문 재사용, 답변 👍/👎, 키워드 구독, 피드백 보너스, 주간 리포트, 월간 배지, 프로젝트 목록 자동 갱신.

## 실행

```
npm install
cp .env.example .env        # 봇 토큰 4개
node setup.mjs invite       # 초대 링크 4개
node setup.mjs              # 채널·역할·포럼 태그·입장 질문 생성 (여러 번 실행해도 안전)
node check.mjs              # 로직 점검
node bot.mjs                # 실행 (상시 실행은 juai-bot.service)
```

필요한 것: Node 22.13+, 설치·로그인된 `claude` / `codex` / `opencode` CLI, `bwrap`(bubblewrap).

## 구조

- `layout.mjs` 서버 구조(역할·채널·포럼 태그·입장 질문·안내문)를 데이터로
- `setup.mjs` 그 구조를 서버에 적용 (이름으로 맞춰서 갱신, 중복 없음)
- `bot.mjs` 기능 전부
- `ai.mjs` AI CLI 실행·격리·무료 모델 자동 교체
- `lib.mjs` 사용량 제한, 비슷한 질문 찾기 같은 순수 로직 (`check.mjs`로 점검)
- `guard.mjs` 새 버전이 켜지지 않으면 이전 버전으로 자동 복구

## 안전장치

- 멤버 글이 들어가는 AI는 격리 실행: Claude는 도구를 끄고, OpenCode·Codex는 bwrap 임시 홈에서만 실행. 자식 프로세스에는 봇 토큰이 없습니다.
- AI 출력은 토큰·키·이메일·전화번호를 가린 뒤에만 디스코드로 나갑니다.
- 삭제·타임아웃·채널 변경·코드 변경은 서버 주인의 승인 카드를 거칩니다.
- 멤버 AI 대화는 무료 모델만, 1인 기본 하루 5회(피드백 보너스 최대 +3) · 30초 간격 · 서버 전체 하루 300회.

## 라이선스

MIT
