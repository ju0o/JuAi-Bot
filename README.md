# JuAi Bot

JuAi 디스코드 서버를 운영하는 봇 4개(Claude·Codex·OpenCode·CommandCode)를 한 프로세스로 돌립니다.

```
npm install
cp .env.example .env        # 봇 토큰 4개
node setup.mjs invite       # 초대 링크 4개
node setup.mjs              # 채널·역할·포럼 태그·입장 질문 생성 (여러 번 실행해도 안전)
node check.mjs              # 로직 점검
node bot.mjs                # 실행 (상시 실행은 juai-bot.service)
```

- 설계: `layout.mjs`(서버 구조), `bot.mjs`(기능), `ai.mjs`(AI CLI 실행·격리), `lib.mjs`(사용량 제한 등 순수 로직)
- 멤버가 쓴 글이 들어가는 AI는 격리 실행: Claude는 도구 끔, OpenCode/Codex는 bwrap 임시 홈.
- 멤버 AI 대화는 무료 모델(OpenCode)만, 1인 기본 하루 5회 · 다른 사람 글에 30자 이상 피드백을 달면 하루 최대 3회 보너스 · 30초 간격 · 서버 전체 하루 300회. `!도움말`에서 안내를 보고 `!남은횟수`로 확인할 수 있어요.
