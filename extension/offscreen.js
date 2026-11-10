/* コミュ記録 — 画面の読み取り
   background.js から届いた画面の画像から、ゲーム画面（16:9）を見つけ、
   台詞の枠・タイトルの帯・選択肢のボタンを切り出して文字を読む。
   切り出す位置はゲーム画面に対する割合（ブラウザの大きさが変わっても同じ）。
   台詞は1文字ずつ表示されるので、同じ絵が2回続いた（表示し終わった）ときだけ読む。 */

const R = {
  text: { x: 0.19, y: 0.815, w: 0.57, h: 0.155 },   // 台詞の枠（名前の行と、右下のボイス・送りの印は除く）
  title: { x: 0.118, y: 0.135, w: 0.29, h: 0.055 },   // 左上の帯の、タイトルの行
  head: { x: 0.04, y: 0.02, w: 0.28, h: 0.07 },      // アルバムの画面の左上の見出し（「灯織のアルバム」「プロデュースアイドル詳細」）
  card: { x: 0.065, y: 0.115, w: 0.44, h: 0.07 },    // カードの詳細画面の「【カード名】アイドル名」
  ff: { x: 0.84, y: 0.87, w: 0.06, h: 0.10 },      // 右下の「早送り×4」のボタン（コミュの画面にだけある）
  choices: [                                          // 選択肢のボタン（3つのとき）
    { x: 0.06, y: 0.25, w: 0.25, h: 0.17 },
    { x: 0.37, y: 0.09, w: 0.25, h: 0.17 },
    { x: 0.68, y: 0.25, w: 0.25, h: 0.17 },
  ],
};

/* ===== 文字の読み取り（Tesseract.js。拡張の中に同梱したものを使う） ===== */

// 読み取りの準備（辞書の読み込み）は数秒かかるので、記録を始めた時点で先に済ませておく。
// そうしないと、コミュの始まりに少しだけ出るタイトルの帯を準備中に見逃す
const url = (p) => chrome.runtime.getURL(p);
const worker = Tesseract.createWorker("jpn", 1, {
  workerPath: url("lib/worker.min.js"), corePath: url("lib/core"), langPath: url("lib/lang"),
  workerBlobURL: false, gzip: true, cacheMethod: "none",
});
async function ocr(canvas) {
  const t = (await (await worker).recognize(canvas)).data.text;
  // 枠の線や飾りを文字と読んだ、端のゴミ（| や記号）を落とす
  const tidy = (s) => s.replace(/^[^\p{L}\p{N}「『（(【…―]+/u, "").replace(/[^\p{L}\p{N}」』）)!?！？…ー〜～♪っ]+$/u, "");
  return t.replace(/[ 　]+/g, "").split("\n").map(tidy).filter(Boolean);
}

/* ===== 画像の扱い ===== */

function load(dataUrl) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);
      ok(c);
    };
    img.src = dataUrl;
  });
}
const abs = (g, r) => ({ x: Math.round(g.x + g.w * r.x), y: Math.round(g.y + g.h * r.y), w: Math.round(g.w * r.w), h: Math.round(g.h * r.h) });
function crop(cv, r, scale = 1) {
  const o = document.createElement("canvas");
  o.width = Math.max(1, Math.round(r.w * scale)); o.height = Math.max(1, Math.round(r.h * scale));
  o.getContext("2d").drawImage(cv, r.x, r.y, r.w, r.h, 0, 0, o.width, o.height);
  return o;
}
function pixels(cv, r) { return cv.getContext("2d", { willReadFrequently: true }).getImageData(r.x, r.y, r.w, r.h).data; }
// 白っぽい（明るく色の薄い）画素の割合。台詞の枠・タイトルの帯・選択肢のボタンが出ているかの目安
function whiteness(cv, r) {
  const p = pixels(cv, r); let n = 0;
  for (let i = 0; i < p.length; i += 16) {
    const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]);
    if (mx > 205 && mx - mn < 45) n++;
  }
  return n / (p.length / 16);
}
// コミュの画面か：右下に「早送り×4」のボタン（白地に青い ON/OFF）があるか。アルバムなどの画面では読まない
function isCommu(cv, r) {
  const p = pixels(cv, r); let white = 0, blue = 0, n = 0;
  for (let i = 0; i < p.length; i += 8) {
    const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]);
    white += mx > 205 && mx - mn < 45; blue += p[i + 2] > p[i] + 40 && p[i + 2] > 150; n++;
  }
  return white / n > 0.5 && blue / n > 0.04;
}
// 文字の形だけを見る小さな指紋。台詞の枠は半透明で、後ろのキャラクターの動き（まばたき・呼吸）が透けるので、
// 枠の上の文字の色（濃い灰色）に近い、かなり暗い画素だけを数える
function print(cv, r) {
  const W = 256, H = 48, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(cv, r.x, r.y, r.w, r.h, 0, 0, W, H);
  const p = g.getImageData(0, 0, W, H).data, bits = new Uint8Array(W * H); let dark = 0;
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { bits[j] = p[i] + p[i + 1] + p[i + 2] < 300; dark += bits[j]; }
  return { bits, dark };
}

/* ===== ゲーム画面（16:9）の範囲 =====
   拡張が撮るのはページの表示部分だけ（ブラウザのツールバーやサイドバーは入らない）。
   シャニマスのページは、ゲーム画面を 16:9 のまま、はみ出さない最大の大きさで真ん中に置く。
   なので位置は画像の大きさだけで決まる（場面の色に左右されない）。 */

function findGame(cv) {
  const W = cv.width, H = cv.height;
  const w = Math.min(W, Math.round(H * 16 / 9)), h = Math.round(w * 9 / 16);
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
}

/* ===== 1枚ごとの処理 ===== */

let game = null, frames = 0, busy = false, inCommu = 0, away = 0; // inCommu: コミュの画面になってから何枚目か
const seen = {}; // 場所ごとに { prev: 前の指紋, done: 最後に読んだ指紋 }
// 2つの指紋の違い（違う画素の割合）
function diff(a, b) {
  if (!a || !b) return 1;
  let n = 0; for (let i = 0; i < a.length; i++) n += a[i] !== b[i];
  return n / a.length;
}
// 前の1枚とほぼ同じ（表示し終わって止まっている）で、最後に読んだものとははっきり違うときだけ読む
function steady(key, fp, still = 0.002) {
  const s = (seen[key] ||= {});
  const ok = diff(s.prev, fp.bits) < still && diff(s.done, fp.bits) > 0.004;
  s.prev = fp.bits;
  return ok;
}
const markDone = (key) => { seen[key].done = seen[key].prev; };

// 調整用：画面全体に、見つけたゲーム画面と読んだ場所の枠を描いた縮小画像
function overview(cv, rects) {
  const s = Math.min(1, 900 / cv.width), o = document.createElement("canvas");
  o.width = Math.round(cv.width * s); o.height = Math.round(cv.height * s);
  const g = o.getContext("2d");
  g.drawImage(cv, 0, 0, o.width, o.height);
  g.lineWidth = 2;
  for (const [r, color] of rects) { g.strokeStyle = color; g.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s); }
  return o.toDataURL("image/png");
}

// 「【カード名】アイドル名」を分ける。閉じ括弧は「j」などと読み違えることがあるので、
// 後ろのアイドル名を名簿と照らし合わせて決め、その前をカード名とする（名前の誤読も名簿の表記に直る）
const IDOLS = ["櫻木真乃", "風野灯織", "八宮めぐる", "月岡恋鐘", "田中摩美々", "白瀬咲耶", "三峰結華", "幽谷霧子", "小宮果穂", "園田智代子", "西城樹里", "杜野凛世", "有栖川夏葉", "大崎甘奈", "大崎甜花", "桑山千雪", "芹沢あさひ", "黛冬優子", "和泉愛依", "浅倉透", "樋口円香", "福丸小糸", "市川雛菜", "七草にちか", "緋田美琴", "斑鳩ルカ", "鈴木羽那", "郁田はるき"];
function splitCard(raw) {
  const t = raw.replace(/\s+/g, "");
  let best = null;
  for (const name of IDOLS) {
    const tail = t.slice(-name.length);
    let same = 0;
    for (let i = 0; i < name.length; i++) if (tail[i] === name[i]) same++;
    const score = same / name.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { name, score };
  }
  if (!best) return null;
  const card = t.slice(0, -best.name.length).replace(/^[【\[「(（]+/, "").replace(/[】\]」)）jJ|lI1]+$/, "");
  return card ? { card: `【${card}】${best.name}`, idol: best.name } : null;
}

// アルバムの画面から「どのカード／どのアイドルのコミュか」を読む（コミュを開く前の画面）
let page = ""; // "album"（アイドルのアルバム）| "card"（カードの詳細）
async function readContext(cv, out) {
  const hr = abs(game, R.head);
  if (whiteness(cv, hr) > 0.5) {
    const fp = print(cv, hr);
    if (fp.dark > 30 && steady("head", fp, 0.01)) {
      const h = (await ocr(crop(cv, hr, Math.max(1, 600 / hr.w)))).join("");
      markDone("head");
      const m = h.match(/^(.+?)の?アルバム/);
      if (m) { page = "album"; out.context = { idol: m[1].replace(/の$/, ""), card: "" }; }
      else if (/詳細/.test(h)) { page = "card"; if (seen.card) seen.card.done = null; }
      else page = "";
    }
  }
  if (page !== "card") return;
  const cr = abs(game, R.card);
  const fp = print(cv, cr);
  if (fp.dark > 30 && steady("card", fp, 0.01)) {
    const t = (await ocr(crop(cv, cr, Math.max(1, 900 / cr.w)))).join("");
    markDone("card");
    const c = splitCard(t);
    if (c) out.context = c;
  }
}

async function frame(dataUrl, debug) {
  if (busy) return { status: "読み取り中" };
  busy = true;
  try {
    const cv = await load(dataUrl);
    if (!game || frames++ % 15 === 0 || game.cw !== cv.width || game.ch !== cv.height) {
      const g = findGame(cv);
      if (g) game = { ...g, cw: cv.width, ch: cv.height };
    }
    if (!game) return { status: "ゲーム画面が見つかりません", debug: debug && frames % 10 === 1 ? { name: "見つからない", png: overview(cv, []), text: "" } : undefined };
    const out = { status: "記録中" };
    if (!isCommu(cv, abs(game, R.ff))) {
      // 場面転換の暗転などで一瞬ボタンが消えることがあるので、5秒ほど続けてコミュの画面でないときだけ「コミュを出た」とする
      if (++away >= 8 && inCommu) { for (const k of ["title", "text", "choice"]) delete seen[k]; inCommu = 0; } // 次のコミュは最初から読む
      out.commu = false;
      out.status = "コミュの画面を待っています";
      await readContext(cv, out);
      if (debug && frames % 20 === 1) out.debug = { name: "コミュ以外", png: overview(cv, [[game, "#00a0ff"], [abs(game, R.ff), "#00c060"]]), text: "" };
      return out;
    }

    // タイトルの帯（コミュの始まりに出る）
    const tr = abs(game, R.title);
    inCommu++; away = 0; out.commu = true;
    // 調整用：コミュが始まってすぐ（タイトルの帯が出る間）は毎回、その後は20枚に1回、様子を残す
    if (debug && (inCommu <= 10 || frames % 20 === 1)) out.debug = { name: "様子", png: overview(cv, [[game, "#00a0ff"], [tr, "#ffa000"], [abs(game, R.text), "#ff3060"]]), text: `白さ タイトル${whiteness(cv, tr).toFixed(2)} 台詞${whiteness(cv, abs(game, R.text)).toFixed(2)}` };
    // 帯はコミュの始まりにしか出ない。途中で天井や空の白いところを帯と間違えないよう、始まって20枚（約12秒）までだけ見る
    if (inCommu <= 20 && whiteness(cv, tr) > 0.55) {
      const fp = print(cv, tr);
      if (fp.dark > 30 && steady("title", fp, 0.04)) {
        const t = (await ocr(crop(cv, tr, Math.max(1, 900 / tr.w))))[0] || "";
        markDone("title");
        // 左端のアイコンの枠を「1」「|」などと読んだものを落とす（英数字1つのあとに日本語が続くとき）
        const tt = t.replace(/^[0-9A-Za-z|!]\s*(?=[^\x00-\x7F])/, "");
        // 仮名・漢字が2文字以上あるものだけ（「ーー」などの読み違いを落とす）
        if ((tt.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length >= 2) out.title = tt;
        if (debug) out.debug = { name: "タイトル", png: overview(cv, [[game, "#00a0ff"], [tr, "#ffa000"]]), text: t };
      }
    }

    // 選択肢のボタン
    // 白いボタンの上に文字があるものだけ（空の雲を選択肢と間違えないように）
    const boxes = R.choices.map((r) => abs(game, r)).filter((r) => whiteness(cv, r) > 0.75 && print(cv, r).dark > 80);
    if (boxes.length >= 2) {
      const fp = print(cv, boxes[0]);
      if (steady("choice", fp)) {
        const cs = [];
        for (const b of boxes) { const t = (await ocr(crop(cv, b, Math.max(1, 500 / b.w)))).join(""); if (t.length >= 2) cs.push(t); }
        markDone("choice");
        if (cs.length >= 2) out.choices = cs;
      }
    }

    // 台詞の枠
    const xr = abs(game, R.text);
    if (whiteness(cv, xr) > 0.45) {
      const fp = print(cv, xr);
      if (fp.dark > 24 && steady("text", fp)) {
        const t = (await ocr(crop(cv, xr, Math.max(1, 900 / xr.w)))).join("");
        markDone("text");
        if (t.length >= 2) out.line = t;
        if (debug) out.debug = { name: "台詞", png: overview(cv, [[game, "#00a0ff"], [xr, "#ff3060"], [abs(game, R.title), "#ffa000"]]), text: t };
      }
    }
    return out;
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (m.to !== "offscreen") return;
  if (m.type === "reset") { game = null; for (const k in seen) delete seen[k]; reply({}); return; }
  if (m.type === "frame") { frame(m.dataUrl, m.debug).then(reply, (e) => reply({ status: "エラー: " + e.message })); return true; }
});
