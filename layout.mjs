// The whole JuAi server as data. setup.mjs applies it (idempotent, matched by name); bot.mjs looks channels up by key.

export const ROLES = [
  { key: "staff", name: "운영진", color: 0x2f7d6d, hoist: true, perms: ["ManageMessages", "ManageThreads", "ModerateMembers"] },
  { key: "agent", name: "AI 에이전트", color: 0x5b7fd6, hoist: true, perms: [] },
  { key: "optout", name: "AI 언급 제외", color: 0, perms: [] },
  { key: "coproject", name: "공동프로젝트 알림", color: 0xc8872b, perms: [] },
  ...["프론트엔드", "백엔드", "AI 에이전트 개발", "디자인", "기획"].map((name) => ({ key: `int:${name}`, name, color: 0, perms: [] })),
  ...["입문", "실무", "연구"].map((name) => ({ key: `lvl:${name}`, name, color: 0, perms: [] })),
  ...["Claude Code", "Codex", "Cursor", "OpenCode", "기타 도구"].map((name) => ({ key: `tool:${name}`, name: `${name} 사용자`, color: 0, perms: [] })),
];

// access: "open" = everyone writes, "readonly" = only agents/staff post (members may reply in threads), "private" = staff + agents only
export const CATEGORIES = [
  { name: "시작하기", channels: [
    { key: "notice", name: "공지", type: "text", access: "readonly", topic: "운영진이 승인한 공지만 올라와요." },
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
    { key: "showcase", name: "쇼케이스", type: "forum", access: "open", topic: "만든 거 자랑하기. 프로젝트 하나에 글 하나.", tags: ["웹", "앱", "에이전트", "도구", "모델/연구"] },
    { key: "feedback", name: "피드백-요청", type: "forum", access: "open", topic: "원하는 피드백 종류를 태그로 달아주세요.", tags: ["UI", "코드", "기획", "버그", "해결됨"] },
    { key: "coproject", name: "공동-프로젝트", type: "forum", access: "open", topic: "같이 만들 사람 모집.", tags: ["팀원모집", "진행중", "완료"] },
  ] },
  { name: "AI 에이전트", channels: [
    { key: "picks", name: "오늘의-오픈소스", type: "text", access: "readonly", topic: "매일 오전 9시 Codex 추천. 스레드에서 OpenCode에게 활용법을 물어보세요." },
    { key: "lab", name: "ai-연구실", type: "text", access: "open", topic: "여기 글을 쓰면 OpenCode가 스레드에서 답해요. 1인 하루 15회." },
    { key: "playground", name: "봇-놀이터", type: "text", access: "open", topic: "봇 테스트, 아무거나." },
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

// Discord onboarding (multiple choice only). Option → role keys.
export const ONBOARDING = [
  { title: "관심 분야는?", single: false, required: false, options: ["프론트엔드", "백엔드", "AI 에이전트 개발", "디자인", "기획"].map((n) => ({ title: n, roles: [`int:${n}`] })) },
  { title: "경험 수준은?", single: true, required: false, options: [["입문", "이제 막 시작"], ["실무", "일에 쓰고 있음"], ["연구", "모델·논문 파는 중"]].map(([n, d]) => ({ title: n, description: d, roles: [`lvl:${n}`] })) },
  { title: "주로 쓰는 AI 도구는?", single: false, required: false, options: ["Claude Code", "Codex", "Cursor", "OpenCode", "기타 도구"].map((n) => ({ title: n, roles: [`tool:${n}`] })) },
  { title: "공동 프로젝트 알림을 받을까요?", single: true, required: false, options: [{ title: "네, 알려주세요", roles: ["coproject"] }, { title: "괜찮아요", roles: [] }] },
  { title: "AI 봇이 추천·요약에서 내 글을 언급해도 될까요?", single: true, required: false, options: [{ title: "괜찮아요", roles: [] }, { title: "언급하지 말아주세요", roles: ["optout"] }] },
];
