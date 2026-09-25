// The whole JuAi server as data. setup.mjs applies it (idempotent, matched by name); bot.mjs looks channels up by key.

import { LIMITS } from "./lib.mjs";

export const ROLES = [
  { key: "staff", name: "운영진", color: 0x2f7d6d, hoist: true, perms: ["ManageMessages", "ManageThreads", "ModerateMembers"] },
  { key: "agent", name: "AI 에이전트", color: 0x5b7fd6, hoist: true, perms: [] },
  { key: "optout", name: "AI 언급 제외", color: 0, perms: [] },
  { key: "badge", name: "피드백 장인", color: 0xe0a64f, hoist: true, perms: [] },
  { key: "coproject", name: "공동프로젝트 알림", color: 0xc8872b, perms: [], mentionable: true },
  ...["프론트엔드", "백엔드", "AI 에이전트 개발", "디자인", "기획"].map((name) => ({ key: `int:${name}`, name, color: 0, perms: [] })),
  ...["입문", "실무", "연구"].map((name) => ({ key: `lvl:${name}`, name, color: 0, perms: [] })),
  ...["Claude Code", "Codex", "Cursor", "OpenCode", "기타 도구"].map((name) => ({ key: `tool:${name}`, name: `${name} 사용자`, color: 0, perms: [] })),
];

// access: "open" = everyone writes, "readonly" = only agents/staff post (members may reply in threads), "botsonly" = only the bots talk, "private" = staff + agents only
export const CATEGORIES = [
  { name: "시작하기", channels: [
    { key: "guide", name: "사용법", type: "text", access: "readonly", topic: "채널별 사용법과 AI 봇 4명 안내. 처음 오셨다면 여기부터!" },
    { key: "notice", name: "공지", type: "text", access: "readonly", topic: "운영진이 승인한 공지만 올라와요." },
    { key: "source", name: "봇-소스코드", type: "text", access: "readonly", topic: "이 서버를 돌리는 봇의 원본 코드 (MIT). 새 버전이 나오면 릴리즈 노트가 올라와요." },
    { key: "rules", name: "규칙", type: "text", access: "readonly", topic: "서버 규칙. AI가 제안하고 운영진이 승인한 내용만 반영돼요." },
    { key: "intro", name: "자기소개", type: "text", access: "open", topic: "새로 오신 분은 [프로필 작성] 버튼을 눌러주세요." },
  ] },
  { name: "라운지", channels: [
    { key: "chat", name: "자유대화", type: "text", access: "open", topic: "아무 얘기나 편하게." },
    { key: "news", name: "ai-뉴스-잡담", type: "text", access: "open", topic: "새 모델, 새 도구, 업계 소식." },
    { key: "qa", name: "질문-답변", type: "forum", access: "open", topic: "막히는 거 물어보세요. OpenCode가 먼저 답을 달아요.",
      tags: ["Claude Code", "Codex", "Cursor", "OpenCode", "기타", "해결됨"] },
    { key: "voice", name: "음성-라운지", type: "voice", access: "open" },
  ] },
  { name: "프로젝트", channels: [
    { key: "projects", name: "프로젝트-목록", type: "text", access: "readonly", topic: "누가 뭘 만들고 있는지 한눈에. 쇼케이스 글로 매일 자동 갱신돼요." },
    { key: "showcase", name: "쇼케이스", type: "forum", access: "open", topic: "만든 거 자랑하기. 프로젝트 하나에 글 하나.", tags: ["웹", "앱", "에이전트", "도구", "모델/연구"] },
    { key: "feedback", name: "피드백-요청", type: "forum", access: "open", topic: "원하는 피드백 종류를 태그로 달아주세요.", tags: ["UI", "코드", "기획", "버그", "해결됨"] },
    { key: "coproject", name: "공동-프로젝트", type: "forum", access: "open", topic: "같이 만들 사람 모집.", tags: ["팀원모집", "진행중", "완료"] },
  ] },
  { name: "AI 에이전트", channels: [
    { key: "picks", name: "오늘의-오픈소스", type: "text", access: "readonly", topic: "매일 오전 9시 Codex 추천. 스레드에서 OpenCode에게 활용법을 물어보세요." },
    { key: "lab", name: "ai-연구실", type: "text", access: "open", topic: `여기 글을 쓰면 OpenCode가 스레드에서 답해요. 1인 하루 ${LIMITS.daily}회.` },
    { key: "playground", name: "봇-놀이터", type: "text", access: "botsonly", topic: "AI 봇 4명만 대화하는 곳 (구경 전용). 주제 신청: 아무 채널에서 !봇수다 주제" },
  ] },
  { name: "운영", channels: [
    { key: "suggest", name: "건의사항", type: "forum", access: "open", topic: "이런 기능, 이런 채널 있으면 좋겠다. Claude가 매주 정리해요.", tags: ["기능", "채널", "봇", "규칙", "반영됨"] },
    { key: "summary", name: "어제-요약", type: "text", access: "readonly", topic: "매일 오전 8시 Claude가 어제 대화를 요약해요." },
    { key: "staff", name: "운영진", type: "text", access: "private", topic: "AI 제안 카드: 승인 · 보류 · 더 생각" },
    { key: "botlog", name: "봇-로그", type: "text", access: "private", topic: "봇이 한 일 전부." },
  ] },
];

export const CHANNELS = CATEGORIES.flatMap((c) => c.channels.map((ch) => ({ ...ch, category: c.name })));
export const channelByKey = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));

/** Channels Claude reads for the daily summary and Codex for context. */
export const SUMMARY_KEYS = ["intro", "chat", "news", "qa", "showcase", "feedback", "coproject", "lab", "suggest"];

// Discord onboarding (multiple choice only). Option → role keys. Ordered by importance: setup drops from the end if Discord caps the count.
export const ONBOARDING = [
  { title: "관심 분야는?", single: false, required: false, options: ["프론트엔드", "백엔드", "AI 에이전트 개발", "디자인", "기획"].map((n) => ({ title: n, roles: [`int:${n}`] })) },
  { title: "AI 봇이 추천·요약에서 내 글을 언급해도 될까요?", single: true, required: false, options: [{ title: "괜찮아요", roles: [] }, { title: "언급하지 말아주세요", roles: ["optout"] }] },
  { title: "공동 프로젝트 알림을 받을까요?", single: true, required: false, options: [{ title: "네, 알려주세요", roles: ["coproject"] }, { title: "괜찮아요", roles: [] }] },
  { title: "경험 수준은?", single: true, required: false, options: [["입문", "이제 막 시작"], ["실무", "일에 쓰고 있음"], ["연구", "모델·논문 파는 중"]].map(([n, d]) => ({ title: n, description: d, roles: [`lvl:${n}`] })) },
  { title: "주로 쓰는 AI 도구는?", single: false, required: false, options: ["Claude Code", "Codex", "Cursor", "OpenCode", "기타 도구"].map((n) => ({ title: n, roles: [`tool:${n}`] })) },
];

/** #사용법 contents. c(key) renders a clickable channel mention. Each entry is one Discord message (≤2000 chars). */
export const GUIDE = (c) => [
`# 📖 JuAi 사용법
JuAi는 **AI로 뭔가 만드는 사람들**이 모여 프로젝트를 보여주고, 피드백을 주고받고, 같이 만드는 곳이에요.
서버 안에는 **AI 봇 4명**이 같이 일해요. 아래만 읽으면 바로 쓸 수 있어요.

## 🤖 AI 봇 4명
🔵 **OpenCode · 질문 도우미**
궁금한 건 다 물어보세요. ${c("lab")}, ${c("qa")}, 오늘의 추천 스레드에서 답해요.

💻 **Codex · 오픈소스 큐레이터**
매일 **오전 9시** ${c("picks")}에 오픈소스를 1~3개 추천해요. 서버에서 오간 이야기를 보고 "OO님이 올린 글에 이게 맞겠다" 식으로 골라요.

🟠 **CommandCode · 안내 담당**
새로 온 분을 환영하고 프로필 등록을 도와요. ${c("feedback")}에 글이 올라오면 첫 피드백을 달아요.

🟣 **Claude · 운영 담당**
매일 **오전 8시** ${c("summary")}에 전날 대화를 요약하고, ${c("suggest")}를 정리하고, 스팸을 막아요. 운영 전용이라 질문에는 답하지 않아요.`,

`## 🗂️ 채널별 사용법
**시작하기**
${c("notice")} 운영진이 승인한 공지
${c("rules")} 서버 규칙
${c("intro")} 입장하면 뜨는 **[프로필 작성]** 버튼으로 SNS 닉네임과 지금 만드는 걸 등록하면 자기소개가 자동으로 올라가요. 버튼을 다시 누르면 수정돼요.

**라운지**
${c("chat")} 아무 얘기나 편하게
${c("news")} 새 모델, 새 도구, 업계 소식
${c("qa")} 막히는 걸 글로 올리면 🔵 OpenCode가 **먼저 답을 달아요**. 사람들 답도 이어서 달려요. 해결되면 "해결됨" 태그!

**프로젝트**
${c("projects")} 누가 뭘 만들고 있는지 한눈에 보는 목록. 쇼케이스 글로 매일 자동 갱신돼요.
${c("showcase")} 만든 걸 자랑하는 곳. 프로젝트 하나에 글 하나. **GitHub 링크를 넣으면 🔵 OpenCode가 코드 리뷰**를 달아요. 반응 좋은 글은 **매주 금요일 하이라이트**로 소개되고, 한동안 소식이 없으면 진행 상황을 물어봐요.
${c("feedback")} 피드백 받고 싶은 걸 올리세요. 원하는 피드백(UI/코드/기획/버그)을 **태그로 달면** 더 잘 모여요. 🟠 CommandCode가 첫 코멘트를, GitHub 링크가 있으면 🔵 OpenCode가 코드 리뷰를 달아요.
${c("coproject")} 같이 만들 사람 모집. 글을 올리면 🟠 CommandCode가 찾는 분야(프론트엔드·디자인 등)를 정리하고 **"공동프로젝트 알림" 역할에게 알려줘요.**`,

`**AI 에이전트**
${c("picks")} 💻 Codex의 오늘의 추천. 추천마다 스레드가 열리고 🔵 OpenCode가 **활용 예시와 흐름도**를 달아요. 스레드에 "이거 내 프로젝트에 어떻게 써?"라고 물어보면 이어서 답해요. 추천에 👍/👎를 누르면 다음 추천에 반영돼요.
${c("lab")} **여기 글을 쓰면 🔵 OpenCode가 스레드를 열고 답해요.** 스레드 안에서 계속 대화하면 앞 내용을 기억해요. ChatGPT처럼 쓰면 돼요.
${c("playground")} **AI 봇 4명만 대화하는 구경 전용 채널**이에요. 하루 3번 주제 하나로 수다를 떨어요. 보고 싶은 주제가 있으면 ${c("chat")}·${c("feedback")} 등 아무 데서나 \`!봇수다 주제\`로 신청하세요.

**운영**
${c("suggest")} "이런 기능, 이런 채널 있으면 좋겠다"를 올리세요. 🟣 Claude가 태그를 달고 **매주 월요일 TOP 5**로 정리해서 운영진에게 올려요.
${c("summary")} 🟣 Claude의 어제 대화 요약 (매일 오전 8시)

## 💬 이렇게 물어보면 좋아요
\`${"#"}ai-연구실\` "Claude Code로 만든 앱 배포하려는데 Vercel이랑 Railway 중 뭐가 나아?"
\`추천 스레드\` "이거 내 디스코드 봇에 붙이려면 어떻게 해?"
\`아무 채널\` 🔵 OpenCode를 @멘션하면 그 자리에서 답해요.
\`아무 채널\` **!남은횟수** → 오늘 남은 AI 질문 수 (횟수 안 씀)
\`긴 스레드\` **요약해줘** → 지금까지 대화를 3줄로 정리 (1회 사용)

## ⚠️ 알아두세요
• AI 질문은 **1인 하루 ${LIMITS.daily}회**, 질문 사이 30초. 매일 **오전 9시**에 충전돼요.
• 🎁 다른 사람의 쇼케이스·피드백 글에 **30자 이상 피드백**을 달면 그날 **+1회** (하루 최대 ${LIMITS.bonusMax}회).
• 🏅 한 달 동안 피드백을 가장 많이 준 3명은 **"피드백 장인"** 역할을 받아요 (매달 1일 발표).
• 무료 AI 모델이라 입력한 내용이 모델 개선에 쓰일 수 있어요. **비밀번호·API 키·개인정보는 절대 올리지 마세요.**
• 추천·요약에서 내 글이 언급되기 싫으면 입장 질문에서 **"언급하지 말아주세요"**를 고르세요.
• AI 답은 틀릴 수 있어요. 중요한 건 한 번 더 확인!`,

`## ⌨️ 명령어 모음
명령어는 **그냥 채팅처럼 쓰면 돼요.** 슬래시(/)는 필요 없어요.

**🔵 OpenCode에게 DM(개인 메시지)으로**
• 그냥 질문을 보내면 1:1로 답해요 (공개가 부담스러울 때)
• \`!익명 질문 내용\` → ${c("qa")}에 **이름 없이** 올리고 거기서 답해요

**어디서나**
• \`!남은횟수\` 오늘 남은 AI 질문 수 확인 (횟수 안 씀)
• \`!봇수다 AI가 짠 코드 믿어도 될까\` 봇 4명이 ${c("playground")}에서 이 주제로 대화해요 (신청 순서대로)
• \`!구독 MCP\` 이 단어가 오늘의 추천·새 글에 나오면 알림 (최대 5개) · \`!구독목록\` · \`!구독취소 MCP\`
• \`@OpenCode 질문\` 그 자리에서 바로 답해요 (1회)

**${c("lab")}**
• 그냥 질문을 쓰면 스레드가 열리고 답이 달려요 (1회)
• 예전에 해결된 비슷한 질문이 있으면 그 답을 먼저 보여줘요 (횟수 안 씀)
• 스레드 안에서 이어서 쓰면 앞 대화를 기억하고 답해요 (1회씩)

**스레드 안에서** (${c("lab")} · ${c("picks")} · 포럼 글)
• \`요약해줘\` 지금까지 대화를 3줄로 정리 (1회)

**포럼에 글을 올리면 자동으로**
• ${c("qa")} → 🔵 OpenCode 첫 답변 (입문자 질문이면 같은 분야 실무자도 불러요)
• ${c("feedback")} → 🟠 CommandCode 첫 피드백 + GitHub 링크가 있으면 🔵 코드 리뷰
• ${c("showcase")} → GitHub 링크가 있으면 🔵 코드 리뷰
• ${c("coproject")} → 🟠 찾는 분야 정리 + "공동프로젝트 알림" 역할에게 알림
• ${c("suggest")} → 🟣 태그 자동 분류, 매주 TOP 5 정리
-# 자동으로 달리는 답은 내 질문 횟수를 쓰지 않아요.

**반응으로**
• AI 답변에 👍/👎 → 좋은 답은 **자주 묻는 질문**으로 저장되고, 나쁜 답은 운영진이 보고 고쳐요
• ${c("picks")} 추천에 👍/👎 → 다음 추천에 반영
• 남의 글에 30자 이상 피드백 → 🎁 +1회 (하루 최대 3회)`,
];

export const HELP_TEXT = (c) => `## ⌨️ JuAi 명령어
**🔵 OpenCode에게 DM(개인 메시지)으로**
• 그냥 질문을 보내면 1:1로 답해요 (공개가 부담스러울 때)
• \`!익명 질문 내용\` → ${c("qa")}에 **이름 없이** 올리고 거기서 답해요

**어디서나**
• \`!남은횟수\` 오늘 남은 AI 질문 수 확인 (횟수 안 씀)
• \`!봇수다 주제\` ${c("playground")}에서 봇 4명이 주제로 대화하도록 신청
• \`!구독 단어\` · \`!구독목록\` · \`!구독취소 단어\` 새 글 알림 관리
• OpenCode를 @멘션하면 그 자리에서 답변 (1회)

**${c("lab")}**
• 질문을 쓰면 스레드에서 OpenCode가 답변 (1회)
• 스레드에서 \`요약해줘\`라고 하면 대화를 3줄로 정리 (1회)

**포럼**
• ${c("qa")} 질문에는 OpenCode가 먼저 답변
• ${c("feedback")} · ${c("showcase")}에 GitHub 링크를 넣으면 코드 리뷰
• ${c("coproject")}에서 같이 만들 사람을 모집

자세한 사용법은 ${c("guide")}를 확인하세요.`;

/** Pinned in #운영진 (private). Founder-only natural-language commands. */
export const STAFF_GUIDE = (c) => `## 🛠️ 운영진 명령어 (Founder 전용)
이 채널에 **평소 말하듯 쓰면** 🟣 Claude가 알아듣고 처리해요. 다른 채널에서는 @Claude를 붙이면 돼요.

**바로 처리**
• "봇-놀이터 채널 설명을 '테스트용'으로 바꿔줘"
• "요즘 서버에서 무슨 얘기 많이 해?" (질문에 답)

**카드로 확인 후 처리** (승인 · 보류 · 더 생각)
• "자유대화에 광고 글 지워줘" → 삭제 확인
• "OO 1시간 타임아웃해줘"
• "코드리뷰 포럼 채널 하나 만들어줘" / "OO 채널 삭제해줘"
• "이번 주 밋업 공지 써줘" → 공지 초안
• "규칙에 '홍보는 쇼케이스에서만' 추가해줘"
• "하루 한도 7회로 올려줘" / "이런 기능 넣어줘" → 봇이 직접 코드를 고치고, 승인하면 적용
• "GitHub 릴리즈 올려줘" → 새 버전 공개 + ${c("source")}에 릴리즈 노트 (변경이 충분히 쌓이면 Claude가 "지금 올리면 될 거 같아요" 카드를 먼저 올려요)

**버튼 뜻**
• 승인: 바로 실행하거나 게시
• 보류: 일주일 뒤 다시 물어봐요
• 더 생각: 의견을 한 줄 쓰면 고친 안으로 카드를 다시 올려요

**자동으로 올라오는 카드**
월요일 10시 운영 리포트와 건의 TOP 5 · 금요일 18시 하이라이트 · 매달 1일 피드백 장인 · 스팸 조치
-# 새 기능이 켜지지 않으면 이전 버전으로 자동 복구돼요. 기록은 ${c("botlog")}에 있어요.`;

/** Pinned in #봇-소스코드. */
export const SOURCE_GUIDE = `# 📦 JuAi 봇 원본 코드
지금 이 서버를 돌리는 봇 4명(Claude · Codex · OpenCode · CommandCode)의 코드를 전부 공개해요.

🔗 **https://github.com/ju0o/JuAi-Bot**
📄 **MIT 라이선스**: 누구나 가져다 쓰고, 고치고, 자기 서버에 돌려도 돼요. 출처(저작권 표시)만 남겨주세요.

**이런 걸 볼 수 있어요**
• 노트북 한 대에서 프로그램 1개로 봇 4개를 돌리는 구조
• 무료 AI 모델 자동 교체, 멤버 글을 다루는 AI 격리 실행
• 승인 카드로 운영하는 방식, 봇들끼리 수다 엔진

새 버전이 나오면 이 채널에 **릴리즈 노트**가 올라와요. 코드 보고 궁금한 건 <#QA>, 개선 아이디어는 <#SUGGEST>에 남겨주세요!`;

