/* 光空記録総覧 — スクショで探す
   コミュのスクショを貼ると、台詞を読み取って、どのコミュかを探す。
   - 文字の読み取りはブラウザの中（Tesseract.js）。画像はどこにも送らない。
   - 照らし合わせる先は commu_index.json（scripts/build_commu_index.py が作る）。
     台詞を3文字ずつに区切った値の集合で、本文そのものは入っていない。
   - 区切り方と値の計算（norm / fnv1a / grams）は build_commu_index.py と同じにすること。
   構成: 1.索引と照合  2.画像の切り出し  3.文字の読み取り  4.画面 */

(() => {
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const LANG = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn@1.0.0/4.0.0_best_int";
  const MIN_SCORE = 0.5; // 台詞の断片がこの割合以上一致したら候補に出す
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ===== 1. 索引と照合 ================================================= */

  const KEEP = /[^ぁ-ゖァ-ヺー々〆一-鿿a-z0-9]/g;
  const norm = (s) => s.normalize("NFKC").toLowerCase().replace(KEEP, "");
  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }
  let index = null;
  async function loadIndex() {
    if (index) return index;
    const j = await (await fetch("commu_index.json", { cache: "no-store" })).json();
    const mask = (1 << j.bits) - 1;
    const grams = (text) => {
      const t = norm(text), out = new Set();
      for (let i = 0; i + j.n <= t.length; i++) out.add(fnv1a(t.slice(i, i + j.n)) & mask);
      return out;
    };
    const entries = j.entries.map((e) => {
      const b = atob(e.g), set = new Set();
      for (let i = 0; i < b.length; i += 3) set.add((b.charCodeAt(i) << 16) | (b.charCodeAt(i + 1) << 8) | b.charCodeAt(i + 2));
      return { key: e.key, title: e.title || "", choice: e.choice || "", set };
    });
    return (index = { grams, entries });
  }
  // 読み取った文字は行ごとに照らし合わせる。画面の飾りを読んだ行（ゴミ）が混ざっても、台詞の行が一致すれば当たる
  async function match(text) {
    const { grams, entries } = await loadIndex();
    const lines = text.split(/\n+/).map(grams).filter((g) => g.size >= 5);
    const hits = entries.map((e) => {
      let best = 0;
      for (const q of lines) {
        let n = 0;
        q.forEach((g) => { if (e.set.has(g)) n++; });
        best = Math.max(best, n / q.size);
      }
      return { key: e.key, title: e.title, choice: e.choice, score: best };
    }).filter((h) => h.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
    // 同じコミュ（共通部分と選択肢ごとの続き）は、いちばん合ったもの1つにまとめる
    const seen = new Set();
    // いちばん合ったものより大きく下回る候補（言い回しがたまたま似ているだけ）は出さない
    const top = hits.filter((h) => { const k = `${h.key}|${h.title}`; return !seen.has(k) && seen.add(k); })
      .filter((h, _, a) => h.score >= a[0].score - 0.25).slice(0, 5);
    return { total: new Set(entries.map((e) => `${e.key}|${e.title}`)).size, hits: top };
  }

  /* ===== 2. 画像の切り出し ============================================= */

  // ブラウザごと撮ったスクショでも、ゲーム画面（16:9）の範囲を見つけて、台詞の枠だけを切り出す
  function findGame(cv) {
    const { width: w, height: h } = cv;
    const px = cv.getContext("2d").getImageData(0, 0, w, h).data;
    const busy = (x, y) => {
      const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      return Math.max(r, g, b) - Math.min(r, g, b) > 40 || r + g + b < 560;
    };
    const run = (n, frac) => {
      let best = [0, -1], s = -1;
      for (let i = 0; i <= n.length; i++) {
        if (i < n.length && n[i] >= frac) { if (s < 0) s = i; }
        else if (s >= 0) { if (i - s > best[1] - best[0] + 1) best = [s, i - 1]; s = -1; }
      }
      return best;
    };
    const step = Math.max(1, Math.floor(w / 400));
    const rowsF = Array.from({ length: h }, (_, y) => { let c = 0; for (let x = 0; x < w; x += step) c += busy(x, y); return c / Math.ceil(w / step); });
    const [y0, y1] = run(rowsF, 0.2); // 台詞の枠の行は白っぽいので、低めのしきい値で
    const colsF = Array.from({ length: w }, (_, x) => { let c = 0; for (let y = y0; y <= y1; y += step) c += busy(x, y); return c / Math.ceil((y1 - y0 + 1) / step); });
    const [x0, x1] = run(colsF, 0.2);
    const gw = x1 - x0 + 1, gh = y1 - y0 + 1, ar = gw / gh;
    return ar > 1.55 && ar < 1.95 && gw > w * 0.3 ? { x: x0, y: y0, w: gw, h: gh } : null;
  }
  const TEXTBOX = { x: 0.17, y: 0.815, w: 0.66, h: 0.155 }; // ゲーム画面の中の、台詞の枠（名前の行は除く）
  function crop(cv, r) {
    const out = document.createElement("canvas");
    const s = Math.max(1, 900 / r.w); // 小さい画像は拡大したほうが読める
    out.width = Math.round(r.w * s); out.height = Math.round(r.h * s);
    out.getContext("2d").drawImage(cv, r.x, r.y, r.w, r.h, 0, 0, out.width, out.height);
    return out;
  }

  /* ===== 3. 文字の読み取り ============================================= */

  let worker = null;
  async function ocr(canvas) {
    if (!worker) {
      if (!window.Tesseract) await new Promise((ok, ng) => { const s = document.createElement("script"); s.src = TESS; s.onload = ok; s.onerror = ng; document.head.append(s); });
      worker = await Tesseract.createWorker("jpn", 1, { langPath: LANG, gzip: true });
    }
    return (await worker.recognize(canvas)).data.text;
  }

  /* ===== 4. 画面 ======================================================= */

  const box = $("shot");
  let image = null, sel = null, drag = null;

  function status(html) { $("shotResult").innerHTML = html; }
  function drawPreview() {
    const pv = $("shotPreview"), g = pv.getContext("2d");
    const s = Math.min(1, 640 / image.width);
    pv.width = Math.round(image.width * s); pv.height = Math.round(image.height * s);
    g.drawImage(image, 0, 0, pv.width, pv.height);
    if (sel) { g.strokeStyle = "#e0457b"; g.lineWidth = 2; g.strokeRect(sel.x * s, sel.y * s, sel.w * s, sel.h * s); }
  }
  function showHits(res, text) {
    const site = window.commuSite;
    if (!res.hits.length) {
      status(`見つかりませんでした。読み取った文字：「${esc(text.replace(/\s+/g, ""))}」<br>` +
        `台詞の枠だけを囲み直すと、読み取りがよくなることがあります（プレビューの上でドラッグ）。` +
        `<br><small>台詞で探せるのは、本文を登録したコミュ（いま ${res.total ?? 0} 件）だけです。</small>`);
      return;
    }
    status(res.hits.map((h) => {
      const r = site.rowByKey(h.key);
      const title = (h.title ? `「${esc(h.title)}」` : "") + (h.choice ? `<small>選択肢「${esc(h.choice)}」のあと</small>` : "");
      const label = r ? `${title}【${esc(r.name)}】${esc(r.tags.join("・"))}　<small>${esc(r.kind)}・${esc(r.date)}</small>` : esc(h.key);
      return `<button type="button" class="shot-hit" data-key="${esc(h.key)}"><b>${Math.round(h.score * 100)}%</b>${label}</button>`;
    }).join(""));
  }
  async function run() {
    try {
      status("文字を読み取っています…（初回は読み取りの準備に少し時間がかかります）");
      const text = await ocr(crop(image, sel));
      status("照らし合わせています…");
      showHits(await match(text), text);
    } catch (e) {
      status("読み取りに失敗しました。通信状態を確かめて、もう一度試してください。");
    }
  }
  function useImage(blob) {
    const img = new Image();
    img.onload = () => {
      image = document.createElement("canvas");
      image.width = img.width; image.height = img.height;
      image.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      const game = findGame(image);
      sel = game ? { x: game.x + game.w * TEXTBOX.x, y: game.y + game.h * TEXTBOX.y, w: game.w * TEXTBOX.w, h: game.h * TEXTBOX.h }
                 : { x: 0, y: 0, w: image.width, h: image.height };
      $("shotPreview").hidden = false;
      drawPreview();
      run();
    };
    img.src = URL.createObjectURL(blob);
  }

  $("shotOpen").addEventListener("click", () => { box.hidden = !box.hidden; });
  $("shotClose").addEventListener("click", () => { box.hidden = true; });
  $("shotFile").addEventListener("change", (e) => { if (e.target.files[0]) useImage(e.target.files[0]); });
  box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("over"); });
  box.addEventListener("dragleave", () => box.classList.remove("over"));
  box.addEventListener("drop", (e) => { e.preventDefault(); box.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) useImage(f); });
  document.addEventListener("paste", (e) => {
    if (box.hidden) return;
    const f = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (f) useImage(f.getAsFile());
  });
  // プレビューの上でドラッグすると、読み取る範囲を選び直せる
  const pv = $("shotPreview");
  const at = (e) => { const r = pv.getBoundingClientRect(), s = image.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
  pv.addEventListener("pointerdown", (e) => { if (!image) return; drag = at(e); pv.setPointerCapture(e.pointerId); });
  pv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = at(e);
    sel = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
    drawPreview();
  });
  pv.addEventListener("pointerup", () => { if (drag && sel.w > 20 && sel.h > 10) run(); drag = null; });
  $("shotResult").addEventListener("click", (e) => {
    const b = e.target.closest(".shot-hit");
    if (b) { box.hidden = true; window.commuSite.focus(b.dataset.key); }
  });
})();
