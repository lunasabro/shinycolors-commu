const $ = (id) => document.getElementById(id);
const send = (type, extra = {}) => chrome.runtime.sendMessage({ to: "background", type, ...extra });

function show(st) {
  if (!st) return;
  $("st").textContent = st.status || "停止中";
  $("st").classList.toggle("on", !!st.recording);
  $("toggle").textContent = st.recording ? "記録を止める" : "記録を始める";
  if (document.activeElement !== $("title")) $("title").value = st.title || "";
  $("debug").checked = !!st.debug;
  const lines = (st.lines || []).filter((l) => !l.startsWith("## "));
  $("n").textContent = lines.length;
  $("lines").innerHTML = "";
  lines.slice(-6).forEach((l) => { const li = document.createElement("li"); li.textContent = l; $("lines").append(li); });
}

$("toggle").addEventListener("click", async () => {
  const st = (await chrome.storage.session.get("st")).st;
  if (st?.recording) return show(await send("stop"));
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  show(await send("start", { tab }));
});
$("save").addEventListener("click", async () => show(await send("save")));
$("new").addEventListener("click", async () => show(await send("new")));
$("debug").addEventListener("change", async (e) => show(await send("debug", { on: e.target.checked })));
$("title").addEventListener("change", async (e) => show(await send("title", { title: e.target.value.trim() })));
chrome.storage.session.onChanged.addListener((c) => { if (c.st) show(c.st.newValue); });
chrome.storage.session.get("st").then(({ st }) => show(st || { status: "停止中" }));
