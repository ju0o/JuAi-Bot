// Builds the JuAi server from layout.mjs. Safe to re-run: everything is matched by name and updated in place.
//   node setup.mjs invite   → prints the 4 bot invite links
//   node setup.mjs          → applies roles, channels, forum tags, permissions, Community, onboarding
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { ChannelType, Client, GatewayIntentBits, GuildExplicitContentFilter, GuildVerificationLevel, PermissionFlagsBits as P, PermissionsBitField } from "discord.js";
import { CATEGORIES, GUIDE, ONBOARDING, ROLES, STAFF_GUIDE } from "./layout.mjs";
import { openDb, kvGet, kvSet } from "./db.mjs";

export const env = parseEnv(readFileSync(new URL("./.env", import.meta.url), "utf8"));
export const BOTS = { CLAUDE: "DISCORD_CLAUDE_BOT_TOKEN", CODEX: "DISCORD_CODEX_BOT_TOKEN", OPENCODE: "DISCORD_OPENCODE_BOT_TOKEN", COMMANDCODE: "DISCORD_COMMANDCODE_BOT_TOKEN" };
/** A bot token's first segment is its user id in base64, so ids never need to be configured. */
export const botId = (token) => token ? Buffer.from(token.split(".")[0], "base64").toString() : undefined;

const BASE = [P.ViewChannel, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.AddReactions];
const ADMIN = [...BASE, P.ManageGuild, P.ManageRoles, P.ManageChannels, P.ManageMessages, P.ManageThreads, P.ModerateMembers];
const DEFAULT_JUNK = new Set(["일반", "general", "채팅 채널", "음성 채널", "Text Channels", "Voice Channels"]);

function printInvites() {
  for (const [name, key] of Object.entries(BOTS)) {
    const id = botId(env[key]); if (!id) { console.log(`${name}: 토큰 없음`); continue; }
    const perms = P.Administrator; // Founder decision 9/24: bots run the server, the Founder only approves
    console.log(`${name}: https://discord.com/oauth2/authorize?client_id=${id}&scope=bot&permissions=${perms}`);
  }
}

export async function findGuild(client) {
  const guilds = await client.guilds.fetch();
  const hit = env.JUAI_GUILD_ID ? guilds.get(env.JUAI_GUILD_ID) : guilds.find((g) => /juai/i.test(g.name));
  if (!hit) throw new Error(`JuAi 서버를 못 찾았어요. 봇이 들어간 서버: ${[...guilds.values()].map((g) => g.name).join(", ") || "없음"}`);
  return client.guilds.fetch(hit.id);
}

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(env[BOTS.CLAUDE]);
  const guild = await findGuild(client);
  console.log(`서버: ${guild.name} (${guild.id})`);
  kvSet(openDb(), "guild_id", guild.id);

  // Roles
  const roles = {}; const existingRoles = await guild.roles.fetch();
  for (const r of ROLES) {
    const perms = r.perms.map((p) => P[p]);
    let role = existingRoles.find((x) => x.name === r.name);
    if (!role) { role = await guild.roles.create({ name: r.name, color: r.color, hoist: !!r.hoist, permissions: perms, mentionable: !!r.mentionable }); console.log(`+ 역할 ${r.name}`); }
    else await role.edit({ color: r.color, hoist: !!r.hoist, permissions: perms, mentionable: !!r.mentionable });
    roles[r.key] = role;
  }
  for (const key of Object.values(BOTS)) {
    const id = botId(env[key]); if (!id) continue;
    const member = await guild.members.fetch(id).catch(() => null);
    if (member && !member.roles.cache.has(roles.agent.id)) await member.roles.add(roles.agent).catch((e) => console.warn(`역할 부여 실패 ${member.user.username}: ${e.message}`));
    if (!member) console.warn(`! 봇 ${id}가 아직 서버에 없어요 (초대 링크를 눌러주세요)`);
  }

  const everyone = guild.roles.everyone.id;
  const overwrites = (access) => ({
    open: [],
    readonly: [{ id: everyone, deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads], allow: [P.SendMessagesInThreads] },
      { id: roles.agent.id, allow: [P.SendMessages, P.CreatePublicThreads, P.ManageThreads, P.EmbedLinks] }, { id: roles.staff.id, allow: [P.SendMessages] }],
    private: [{ id: everyone, deny: [P.ViewChannel] }, { id: roles.agent.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks] },
      { id: roles.staff.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }],
  })[access];
  const TYPE = { text: ChannelType.GuildText, forum: ChannelType.GuildForum, voice: ChannelType.GuildVoice };

  const ids = {};
  async function applyChannels(forums) {
    const all = await guild.channels.fetch();
    let catPos = 0;
    for (const cat of CATEGORIES) {
      let parent = all.find((c) => c?.type === ChannelType.GuildCategory && c.name === cat.name);
      if (!parent) { parent = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory }); console.log(`+ 카테고리 ${cat.name}`); }
      await parent.setPosition(catPos++).catch(() => {});
      for (const ch of cat.channels) {
        if ((ch.type === "forum") !== forums) continue;
        const spec = { name: ch.name, type: TYPE[ch.type], parent: parent.id, permissionOverwrites: overwrites(ch.access),
          ...(ch.topic && ch.type !== "voice" ? { topic: ch.topic } : {}), ...(ch.tags ? { availableTags: ch.tags.map((name) => ({ name })) } : {}) };
        let chan = all.find((c) => c && c.type === TYPE[ch.type] && c.name === ch.name);
        if (!chan) { chan = await guild.channels.create(spec); console.log(`+ 채널 ${cat.name} / ${ch.name}`); }
        else {
          const tags = ch.tags ? ch.tags.map((name) => chan.availableTags?.find((t) => t.name === name) ?? { name }) : undefined;
          await chan.edit({ ...spec, ...(tags ? { availableTags: tags } : {}) });
        }
        ids[ch.key] = chan.id;
      }
    }
  }

  await applyChannels(false);
  // Turning Community on needs Administrator, which the bot deliberately doesn't have: the Founder flips it once in server settings.
  const community = guild.features.includes("COMMUNITY");
  await guild.edit({ systemChannel: ids.intro, ...(community ? { rulesChannel: ids.rules, publicUpdatesChannel: ids.staff } : {}) });
  await applyChannels(true);

  // Remove Discord's default channels only when they are empty.
  for (const c of (await guild.channels.fetch()).values()) {
    if (!c || !DEFAULT_JUNK.has(c.name)) continue;
    if (c.type === ChannelType.GuildCategory) { if (!guild.channels.cache.some((x) => x.parentId === c.id && !DEFAULT_JUNK.has(x.name))) await c.delete().then(() => console.log(`- 기본 ${c.name}`)).catch(() => {}); continue; }
    const msgs = c.isTextBased() ? await c.messages.fetch({ limit: 1 }).catch(() => null) : null;
    if (!msgs || msgs.size === 0) await c.delete().then(() => console.log(`- 기본 ${c.name}`)).catch(() => {});
  }

  kvSet(openDb(), "channels", ids);

  // #사용법: edit in place on re-run so the channel never collects duplicates.
  const guideCh = await guild.channels.fetch(ids.guide);
  const texts = GUIDE((k) => `<#${ids[k]}>`); const prevIds = kvGet(openDb(), "guide_messages") || [];
  const prev = await Promise.all(prevIds.map((id) => guideCh.messages.fetch(id).catch(() => null)));
  let msgIds;
  if (prev.length === texts.length && prev.every(Boolean)) { await Promise.all(prev.map((m, n) => m.edit(texts[n]))); msgIds = prevIds; console.log("~ 사용법 갱신"); }
  else {
    await Promise.all(prev.filter(Boolean).map((m) => m.delete().catch(() => {})));
    msgIds = []; for (const t of texts) msgIds.push((await guideCh.send({ content: t, allowedMentions: { parse: [] } })).id);
    await guideCh.messages.pin(msgIds[0]).catch(() => {}); console.log("+ 사용법 게시");
  }
  kvSet(openDb(), "guide_messages", msgIds);
  // Founder command sheet, pinned in the private staff channel.
  const staffCh = await guild.channels.fetch(ids.staff), staffText = STAFF_GUIDE((k) => `<#${ids[k]}>`);
  const staffPrev = kvGet(openDb(), "staff_guide") ? await staffCh.messages.fetch(kvGet(openDb(), "staff_guide")).catch(() => null) : null;
  if (staffPrev) await staffPrev.edit(staffText);
  else { const m = await staffCh.send({ content: staffText, allowedMentions: { parse: [] } }); await m.pin().catch(() => {}); kvSet(openDb(), "staff_guide", m.id); }
  let invite = kvGet(openDb(), "invite");
  if (!invite || !(await client.fetchInvite(invite).catch(() => null))) { invite = (await guideCh.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: "JuAi 공개 초대 링크" })).url; kvSet(openDb(), "invite", invite); }
  console.log(`초대 링크: ${invite}`);

  if (!community) {
    console.log("\n! 커뮤니티 기능이 꺼져 있어서 입장 질문은 아직 못 만들었어요.\n  서버 설정 → 커뮤니티 활성화 (규칙 채널: #규칙, 업데이트 채널: #운영진) 후 node setup.mjs를 한 번 더 실행하세요.");
    await client.destroy(); return;
  }
  // Onboarding. Discord wants snowflake-like ids for new prompts/options.
  let seq = 0n; const sid = () => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + seq++);
  await client.rest.put(`/guilds/${guild.id}/onboarding`, { body: {
    enabled: true, mode: 0,
    default_channel_ids: ["guide", "notice", "rules", "intro", "chat", "news", "qa", "showcase", "feedback", "coproject", "picks", "lab", "playground", "suggest", "summary"].map((k) => ids[k]),
    prompts: ONBOARDING.map((q) => ({ id: sid(), type: 0, title: q.title, single_select: q.single, required: q.required, in_onboarding: true,
      options: q.options.map((o) => ({ id: sid(), title: o.title, ...(o.description ? { description: o.description } : {}),
        role_ids: o.roles.map((k) => roles[k].id), channel_ids: o.roles.length ? [] : [ids.chat] })) })),
  } });
  console.log("+ 입장 질문 설정");
  kvSet(openDb(), "channels", ids);
  console.log("완료");
  await client.destroy();
}

if (import.meta.url === `file://${process.argv[1]}`) process.argv[2] === "invite" ? printInvites() : main().catch((e) => { console.error("실패:", e.message, e.method ?? "", e.url ?? ""); process.exit(1); });
