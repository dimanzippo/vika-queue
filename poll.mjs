import { readFile, writeFile } from "node:fs/promises";
const token = process.env.VK_GROUP_TOKEN;
if (!token) { console.error("no VK_GROUP_TOKEN"); process.exit(1); }
function samaraNow() {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
}
let q = [];
try { q = JSON.parse(await readFile("queue.json", "utf8")); } catch (e) {}
const r = await (await fetch(`https://api.vk.com/method/messages.getConversations?filter=unread&count=20&extended=0&access_token=${encodeURIComponent(token)}&v=5.199`)).json();
let added = 0;
for (const it of r?.response?.items || []) {
  const peer = it?.conversation?.peer?.id;
  const lm = it?.last_message;
  if (!peer || !lm?.id) continue;
  const id = `dm${peer}_${lm.id}`;
  if (q.some((e) => e.id === id)) continue;
  q.push({ id, ts: samaraNow(), kind: "message_new", peer, text: String(lm.text || "").slice(0, 300), status: "unread", src: "collector" });
  added++;
}
await writeFile("queue.json", JSON.stringify(q.slice(-200), null, 1));
console.log("added " + added + ", total " + q.length);
