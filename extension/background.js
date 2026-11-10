/* コミュ記録 — 裏で動く部分
   記録中は、ゲームのタブの画面を0.6秒ごとに撮って offscreen.js に渡す（ブラウザの制限は1秒に2回まで）。
   offscreen.js が読み取った台詞・タイトル・選択肢を受け取り、コミュごとにまとめて保存する。
   ゲームの操作は一切しない（画面を撮るだけ）。 */

const INTERVAL = 600;          // 撮影の間隔（ミリ秒）
const IDLE_SAVE = 30 * 1000;   // 台詞がこの時間増えなければ、いったん保存する
const GAME = "https://shinycolors.enza.fun/";

// 保存のたびにブラウザのダウンロード表示が出ないようにする（対応していないブラウザでは何もしない）
try { chrome.downloads.setUiOptions?.({ enabled: false }).catch(() => {}); } catch {}
let st = null; // { recording, tabId, windowId, title, startedAt, lines, choices, lastLineAt, savedLines, status }
let timer = null;

/* ===== 状態（拡張の裏側は眠ることがあるので、毎回 storage に書いておく） ===== */

async function loadState() {
  if (st) return st;
  st = (await chrome.storage.session.get("st")).st || { recording: false, lines: [], choices: [], title: "", status: "停止中" };
  return st;
}
async function saveState() { await chrome.storage.session.set({ st }); }

/* ===== 文字の読み取り（offscreen.html の中で動く） ===== */

async function offscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "画面の文字を読み取る" });
}

/* ===== 保存 ===== */

const safe = (s) => s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 60) || "タイトル不明";
function stamp(t) {
  const d = new Date(t), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
// 1行目「# タイトル」、台詞を1行ずつ。選んだ選択肢の行の前に「## 選択肢: …」（scripts/commu_text.py と同じ形）
async function save() {
  if (!st.lines.length || st.savedLines === st.lines.length) return;
  // 2行目：アルバムで開いた画面（カードの詳細ならカード名、アイドルのアルバムならアイドル名＝共通コミュなど）
  const from = st.card ? `カード: ${st.card}` : st.idol ? `アイドル: ${st.idol}` : "";
  const text = `# ${st.title || "タイトル不明"}\n` + (from ? from + "\n" : "") + st.lines.join("\n") + "\n";
  await chrome.downloads.download({
    url: "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    filename: `コミュログ/${st.card || st.idol ? safe(st.card || st.idol) + "_" : ""}${safe(st.title)}_${stamp(st.startedAt)}.txt`,
    conflictAction: "overwrite", saveAs: false,
  });
  st.savedLines = st.lines.length;
}
// 調整用：読み取った場所の画像と読めた文字を「コミュログ/調整用」に残す（popup でオンにしたときだけ、40枚まで）
async function saveDebug(d) {
  st.debugCount = (st.debugCount || 0) + 1;
  const base = `コミュログ/調整用/${stamp(Date.now())}_${String(st.debugCount).padStart(2, "0")}_${d.name}`;
  await chrome.downloads.download({ url: d.png, filename: base + ".png", conflictAction: "uniquify", saveAs: false });
  if (d.text) await chrome.downloads.download({ url: "data:text/plain;charset=utf-8," + encodeURIComponent(d.text), filename: base + ".txt", conflictAction: "uniquify", saveAs: false });
}
function newCommu(title) {
  const c = st.context || {};
  Object.assign(st, { title, card: c.card || "", idol: c.idol || "", startedAt: Date.now(), lines: [], choices: [], lastLineAt: Date.now(), savedLines: 0 });
}

/* ===== 記録の繰り返し ===== */

function similar(a, b) {
  const g = (t) => new Set([...Array(Math.max(0, t.length - 1))].map((_, i) => t.slice(i, i + 2)));
  const A = g(a), B = g(b);
  if (!A.size || !B.size) return 0;
  let n = 0; A.forEach((x) => { if (B.has(x)) n++; });
  return (2 * n) / (A.size + B.size);
}

async function tick() {
  timer = null;
  await loadState();
  if (!st.recording) return;
  try {
    const tab = await chrome.tabs.get(st.tabId);
    if (!tab.active || !tab.url?.startsWith(GAME)) {
      st.status = "ゲームのタブが表示されていないので待っています";
    } else {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      await offscreen();
      const r = await chrome.runtime.sendMessage({ to: "offscreen", type: "frame", dataUrl, debug: !!st.debug });
      if (r?.debug && (st.debugCount || 0) < 40) await saveDebug(r.debug);
      st.status = r?.status || "記録中";
      if (r?.context) st.context = r.context;
      // コミュの画面が5秒ほど続けて出ていない（アルバムに戻った）＝そのコミュは終わり。保存して次に備える
      if (r?.commu === false) st.away = (st.away || 0) + 1; else if (r?.commu) st.away = 0; // 読み取り中（結果なし）は数えない
      if (st.away === 8 && st.lines.length) { await save(); newCommu(""); }
      // タイトルの帯：まだタイトルのないコミュならそのコミュの名前に、別のタイトルなら次のコミュの始まり
      if (r?.title && r.title !== st.title) {
        if (!st.title) { st.title = r.title; if (!st.lines.length) st.startedAt = Date.now(); const c = st.context || {}; st.card = c.card || ""; st.idol = c.idol || ""; }
        else { await save(); newCommu(r.title); }
      }
      if (r?.choices?.length) st.choices = r.choices;
      if (r?.line) {
        const last = st.lines[st.lines.length - 1] || "";
        const head = (t, n) => t.slice(0, n);
        // 1文字ずつ表示している途中を読んでしまったとき：続きまで読めたら前の行を置き換える
        if (last && r.line.length > last.length && similar(last, head(r.line, last.length)) >= 0.7) {
          st.lines[st.lines.length - 1] = r.line;
          st.lastLineAt = Date.now();
        } else if (last && (similar(r.line, last) >= 0.7 || (r.line.length >= 5 && similar(r.line, head(last, r.line.length)) >= 0.7))) {
          // 同じ台詞の読み直し（誤読の違いだけ）や、途中までのもの：記録しない
        } else {
          // 選択肢を選んだあと：選んだ文言と同じ台詞が出たら、その前に区切りを入れる
          const picked = st.choices.find((c) => similar(c, r.line) >= 0.6);
          if (picked) { st.lines.push(`## 選択肢: ${picked}`); st.choices = []; }
          st.lines.push(r.line);
          st.lastLineAt = Date.now();
        }
      }
      if (st.lines.length && Date.now() - st.lastLineAt > IDLE_SAVE) await save();
    }
  } catch (e) {
    st.status = "エラー: " + (e?.message || e);
  }
  await saveState();
  if (st.recording) timer = setTimeout(tick, INTERVAL);
}

async function start(tab) {
  await loadState();
  if (!tab?.url?.startsWith(GAME)) { st.status = "シャニマスのタブで開始してください"; await saveState(); return; }
  Object.assign(st, { recording: true, tabId: tab.id, windowId: tab.windowId, status: "記録中" });
  if (!st.startedAt) newCommu("");
  await offscreen();
  await chrome.runtime.sendMessage({ to: "offscreen", type: "reset" });
  await saveState();
  if (!timer) tick();
}
async function stop() {
  await loadState();
  st.recording = false;
  await save();
  st.status = "停止中";
  await saveState();
}

/* ===== 画面（popup）とショートカットから ===== */

chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (m.to !== "background") return;
  (async () => {
    await loadState();
    if (m.type === "start") await start(m.tab);
    if (m.type === "stop") await stop();
    if (m.type === "save") { await save(); await saveState(); }
    if (m.type === "title") { st.title = m.title; await saveState(); }
    if (m.type === "new") { await save(); newCommu(""); await saveState(); }
    if (m.type === "debug") { st.debug = m.on; st.debugCount = 0; await saveState(); }
    reply(st);
  })();
  return true;
});
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle") return;
  await loadState();
  if (st.recording) return stop();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return start(tab);
});
// 裏側が眠って起きたとき、記録中なら続ける
loadState().then(() => { if (st.recording && !timer) tick(); });
