import { readFile, writeFile } from "node:fs/promises";
const GT = process.env.VK_GROUP_TOKEN;
const UT = process.env.VK_USER_TOKEN || null;
if (!GT) { console.error("no VK_GROUP_TOKEN"); process.exit(1); }
function samaraNow() {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
}
const vk = (m, p, t) => fetch(`https://api.vk.com/method/${m}?${new URLSearchParams({ ...p, access_token: t, v: "5.199" }).toString()}`).then((r) => r.json());
async function load(f, fb) {
  try { return JSON.parse(await readFile(f, "utf8")); } catch (e) { return fb; }
}
let q = await load("queue.json", []);
let seen = await load("seen.json", { donut: [], members: [] });
function add(ev) {
  if (q.some((e) => e.id === ev.id)) return false;
  q.push({ ts: samaraNow(), status: "unread", src: "collector", ...ev });
  return true;
}
let added = 0;
const conv = await vk("messages.getConversations", { filter: "unread", count: "20" }, GT);
for (const it of conv?.response?.items || []) {
  const peer = it?.conversation?.peer?.id;
  const lm = it?.last_message;
  if (!peer || !lm?.id || lm.out) continue;
  if (add({ id: `dm${peer}_${lm.id}`, kind: "message_new", peer })) added++;
}
let cadded = 0;
if (UT) {
  try {
    const w = await vk("wall.get", { owner_id: "-242122575", count: "5" }, UT);
    for (const p of w?.response?.items || []) {
      const c = await vk("wall.getComments", { owner_id: "-242122575", post_id: p.id, count: "10" }, UT);
      for (const cm of c?.response?.items || []) {
        if (!cm?.id || cm.from_id < 0) continue;
        if (add({ id: `wall${p.id}_${cm.id}`, kind: "wall_reply_new", peer: cm.from_id })) cadded++;
      }
    }
  } catch (e) { console.error("wall: " + (e?.message || e)); }
}
let dadded = 0;
try {
  const d = await vk("groups.getMembers", { group_id: "242122575", filter: "donut", count: "100" }, GT);
  const ids = (d?.response?.items || []).map((x) => (typeof x === "object" ? x.id : x));
  if (seen.donut.length) {
    for (const uid of ids) {
      if (!seen.donut.includes(uid) && add({ id: `donut${uid}`, kind: "donut_new", peer: uid, text: "новая платная подписка (донат)" })) dadded++;
    }
  }
  seen.donut = ids;
} catch (e) { console.error("donut: " + (e?.message || e)); }
let jadded = 0;
try {
  const m = await vk("groups.getMembers", { group_id: "242122575", sort: "id_desc", count: "20" }, GT);
  const ids = (m?.response?.items || []).map((x) => (typeof x === "object" ? x.id : x));
  if (seen.members.length) {
    for (const uid of ids) {
      if (!seen.members.includes(uid) && add({ id: `join${uid}`, kind: "group_join", peer: uid, text: "новый участник группы" })) jadded++;
    }
  }
  seen.members = ids.slice(0, 100);
} catch (e) { console.error("members: " + (e?.message || e)); }
await writeFile("queue.json", JSON.stringify(q.slice(-200), null, 1));
await writeFile("seen.json", JSON.stringify(seen, null, 1));
console.log(`messages=${added} comments=${cadded} donut=${dadded} joins=${jadded} total=${q.length}`);
