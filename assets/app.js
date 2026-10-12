// シャニマスコミュ総覧 — 一覧の表示と絞り込み
// データは data.json（scripts/build_data.py が生成）。画像は sprites/sheets/*.webp のスプライト。
"use strict";

/* ===== 定数 ============================================================ */

const PAGE = 150; // 一度に表示する件数

const KINDS = [
  ["プロデュースアイドル", "--k-produce"],
  ["サポートアイドル", "--k-support"],
  ["イベントシナリオ", "--k-event"],
  ["プロデュースシナリオ", "--k-scenario"],
];
const RARITIES = ["UR", "SSR", "SR", "R"];
// ユニット構成と区分の並びは data.json の meta から読む（定義は scripts/common.py の1か所だけ）
let UNITS = {};
let UNIT_OF = {};
let COLLECTIONS = [];

/* ===== 状態 ============================================================ */

const initialState = () => ({
  q: "", charas: [], match: "any", year: "", sort: "desc",
  kinds: new Set(), rars: new Set(), colls: new Set(),
  must: false, withUnit: true, shown: PAGE,
});
let st = initialState();
let rows = [];
let sheets = {};

/* ===== 小道具 ========================================================== */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const stars = (n) => `${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i>`;
function update(fn) { fn(); st.shown = PAGE; render(); }

/* ===== データ読み込み ================================================= */

function load(data) {
  const meta = data.meta || {};
  sheets = meta.sheets || {};
  UNITS = meta.units || {};
  UNIT_OF = Object.fromEntries(Object.entries(UNITS).flatMap(([u, ms]) => ms.map((m) => [m, u])));
  COLLECTIONS = meta.collections || [];
  // 各行は配列。並びは data.cols に書いてある（scripts/build_data.py の COLS）
  rows = data.rows.map((a) => Object.fromEntries(data.cols.map((c, i) => [c, a[i]])));
  rows.forEach((r) => { r.hay = [...r.tags, r.name, ...r.coll].join(" ").toLowerCase(); });
  renderStamp(meta);
  buildControls();
  render();
}

/* ===== 絞り込み ======================================================= */

function matchChara(r, c) {
  if (r.tags.includes(c)) return true;
  if (!st.withUnit) return false;
  if (UNITS[c]) return r.tags.some((t) => UNIT_OF[t] === c); // ユニット → メンバー個人のコミュも
  return UNIT_OF[c] ? r.tags.includes(UNIT_OF[c]) : false;  // アイドル → 所属ユニットのコミュも
}

function charaOk(r) {
  if (!st.charas.length) return true;
  return st.match === "all" ? st.charas.every((c) => matchChara(r, c)) : st.charas.some((c) => matchChara(r, c));
}

function filtered() {
  const words = st.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out = rows.filter((r) =>
    (!st.kinds.size || st.kinds.has(r.kind)) &&
    (!st.rars.size || st.rars.has(r.rarity)) &&
    (!st.colls.size || r.coll.some((c) => st.colls.has(c))) &&
    (!st.year || r.date.startsWith(st.year)) &&
    (!st.must || r.must) &&
    charaOk(r) &&
    words.every((w) => r.hay.includes(w)));

  const byDate = (a, b, dir) => dir * (a.date || "0000").localeCompare(b.date || "0000");
  if (st.sort.startsWith("must")) {
    const dir = st.sort === "mustdesc" ? -1 : 1;
    out.sort((a, b) => (!a.must !== !b.must ? (a.must ? -1 : 1)
      : a.must !== b.must ? dir * (a.must - b.must) : byDate(a, b, -1)));
  } else {
    out.sort((a, b) => byDate(a, b, st.sort === "desc" ? -1 : 1));
  }
  return out;
}

/* ===== 描画 ============================================================ */

function renderStamp(m) {
  $("stamp").innerHTML =
    `<span>掲載 <b>${rows.length.toLocaleString()}</b> 件</span>` +
    `<span>最終更新 <b>${esc(m.updated || "")}</b>（毎週日曜 23:59 に自動更新）</span>` +
    `<span>wiki反映：サポート ${esc(m.support_wiki || "-")} ／ プロデュース ${esc(m.produce_wiki || "-")}</span>`;
}

function thumb(r) {
  if (!r.img || !sheets[r.img[0]]) return '<span class="th none" aria-hidden="true"></span>';
  const [sh, i] = r.img, n = sheets[sh], col = i % 10, row = Math.floor(i / 10);
  const style = `background-image:url(sprites/sheets/${sh}.webp);background-size:1000% ${n * 100}%;` +
    `background-position:${(col / 9) * 100}% ${n > 1 ? (row / (n - 1)) * 100 : 0}%`;
  const label = esc(`${r.tags.join("・")}【${r.name}】`);
  return `<span class="th" role="img" aria-label="${label}" style="${style}"></span>`;
}

function itemHtml(r) {
  const kindColor = (KINDS.find((k) => k[0] === r.kind) || [, "--k-scenario"])[1];
  const tags = r.tags.map((t) =>
    `<button type="button" class="tg${UNITS[t] ? " unit" : ""}${st.charas.includes(t) ? " on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
  const sub = r.coll.length
    ? `<span class="sub2">${r.coll.map((c) => `<span class="coll">${esc(c)}</span>`).join("")}</span>`
    : "";
  // 必読度・レア・種別は、空でも枠を出して列をそろえる
  const badges =
    (r.must ? `<span class="must" title="必読度 ${r.must}">${stars(r.must)}</span>` : '<span class="must"></span>') +
    (r.rarity ? `<span class="rar">${esc(r.rarity)}</span>` : "<span></span>") +
    `<span class="kind" style="--c:var(${kindColor})">${esc(r.kind.replace("アイドル", ""))}</span>`;
  // 日付順のときは見出しに年月があるので月日だけ。必読度順のときは年も出す
  const date = !r.date ? "—" : st.sort.startsWith("must") ? r.date.replace(/-/g, "/") : r.date.slice(5).replace("-", "/");
  return `<div class="item">` +
    `<span class="d">${date}</span>${thumb(r)}` +
    `<span class="card"><span class="tgs">${tags}</span><span class="nm">${esc(r.name)}</span>${sub}</span>` +
    `<span class="tags">${badges}</span></div>`;
}

function groupOf(r) {
  if (st.sort.startsWith("must")) {
    return r.must ? { key: `m${r.must}`, label: `必読度 ${"★".repeat(r.must)}` } : { key: "m0", label: "必読度なし" };
  }
  const ym = r.date ? r.date.slice(0, 7) : "";
  return { key: ym, label: ym ? ym.replace("-", "年") + "月" : "実装日不明" };
}

function renderList(out) {
  if (!out.length) {
    $("list").innerHTML = '<p class="empty">条件に合うコミュがありません。検索語や絞り込みを減らしてみてください。</p>';
    $("more").hidden = true;
    return;
  }
  const counts = {};
  out.forEach((r) => { const k = groupOf(r).key; counts[k] = (counts[k] || 0) + 1; });
  let html = "", cur = null;
  for (const r of out.slice(0, st.shown)) {
    const g = groupOf(r);
    if (g.key !== cur) {
      cur = g.key;
      html += `<div class="month"><h2>${g.label}</h2><span>${counts[g.key]}件</span></div>`;
    }
    html += itemHtml(r);
  }
  $("list").innerHTML = html;
  $("more").hidden = out.length <= st.shown;
  $("more").textContent = `さらに表示（残り ${Math.max(0, out.length - st.shown).toLocaleString()} 件）`;
}

function renderCount(out) {
  let note = "";
  const one = st.charas.length === 1 ? st.charas[0] : "";
  if (one && st.withUnit) {
    if (UNIT_OF[one]) {
      const u = UNIT_OF[one], n = out.filter((r) => r.tags.includes(u) && !r.tags.includes(one)).length;
      if (n) note = `（うち${esc(u)}のコミュ ${n}件）`;
    } else if (UNITS[one]) {
      const n = out.filter((r) => !r.tags.includes(one)).length;
      if (n) note = `（うちメンバー個人のコミュ ${n}件）`;
    }
  }
  $("count").innerHTML = `<b>${out.length.toLocaleString()}</b> 件${note}`;
}

function renderControls() {
  // 選択中のアイドル
  const picked = $("picked");
  picked.hidden = !st.charas.length;
  picked.innerHTML = !st.charas.length ? "" :
    '<span class="lbl">選択中</span>' +
    st.charas.map((c) => `<span class="pick">${esc(c)}<button type="button" data-rm="${esc(c)}" aria-label="${esc(c)}を外す">×</button></span>`).join("") +
    (st.charas.length > 1
      ? `<span class="seg" role="group" aria-label="複数選択の条件">` +
        `<button type="button" data-m="any" aria-pressed="${st.match === "any"}">いずれかが登場</button>` +
        `<button type="button" data-m="all" aria-pressed="${st.match === "all"}">全員が登場</button></span>`
      : "");
  // アイドル・ユニットのパネル
  document.querySelectorAll("#charaPanel [data-pick]").forEach((b) => b.setAttribute("aria-pressed", st.charas.includes(b.dataset.pick)));
  const cs = $("charaSum");
  cs.textContent = st.charas.length ? st.charas.join("・") : "アイドル・ユニット：すべて";
  cs.classList.toggle("on", st.charas.length > 0);
  // 区分
  const ks = $("collSum");
  ks.textContent = st.colls.size ? [...st.colls].join("・") : "すべて";
  ks.classList.toggle("on", st.colls.size > 0);
  // トグル類
  document.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-pressed", st[b.dataset.set].has(b.dataset.val)));
  $("withUnit").setAttribute("aria-pressed", st.withUnit);
  $("mustOnly").setAttribute("aria-pressed", st.must);
  $("q").value = st.q;
  $("year").value = st.year;
  $("sort").value = st.sort;
}

function render() {
  const out = filtered();
  renderControls();
  renderCount(out);
  renderList(out);
}

/* ===== 操作部品の組み立て ============================================= */

function chip(label, set, val, n, color) {
  return `<button type="button" class="chip" data-set="${set}" data-val="${esc(val)}" aria-pressed="false"` +
    (color ? ` style="--c:var(${color})"` : "") + `>` +
    (color ? '<span class="dot"></span>' : "") + `${esc(label)} <span class="n">${n}</span></button>`;
}

function buildControls() {
  const count = (pred) => rows.filter(pred).length;
  $("kinds").insertAdjacentHTML("beforeend",
    KINDS.map(([k, c]) => chip(k.replace("アイドル", ""), "kinds", k, count((r) => r.kind === k), c)).join(""));
  $("rars").insertAdjacentHTML("beforeend",
    RARITIES.map((x) => chip(x, "rars", x, count((r) => r.rarity === x))).join(""));
  $("colls").innerHTML = COLLECTIONS.map((x) => [x, count((r) => r.coll.includes(x))])
    .filter(([, n]) => n).map(([x, n]) => chip(x, "colls", x, n)).join("");

  const all = new Set(rows.flatMap((r) => r.tags));
  const others = [...all].filter((t) => !UNITS[t] && !UNIT_OF[t]).sort((a, b) => a.localeCompare(b, "ja"));
  const group = (label, items) => `<div class="grp">${label ? `<span class="glbl">${esc(label)}</span>` : ""}` +
    items.map(([t, cls]) => `<button type="button" class="chip${cls}" data-pick="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("") + "</div>";
  $("charaPanel").innerHTML =
    Object.entries(UNITS).map(([u, ms]) => group("", [[u, " uchip"], ...ms.map((m) => [m, ""])])).join("") +
    (others.length ? group("その他", others.map((t) => [t, ""])) : "") +
    '<div class="ddfoot"><button type="button" class="reset" data-clear="1">選択を解除</button>' +
    '<button type="button" class="reset" data-close="1">閉じる</button></div>';

  [...new Set(rows.map((r) => r.date.slice(0, 4)).filter(Boolean))].sort().reverse()
    .forEach((y) => $("year").add(new Option(`${y}年`, y)));
}

/* ===== イベント ======================================================= */

function toggleChara(v) {
  update(() => {
    const i = st.charas.indexOf(v);
    if (i < 0) st.charas.push(v); else st.charas.splice(i, 1);
  });
}
const closeDropdowns = (except) => document.querySelectorAll("details.dd[open]").forEach((d) => { if (d !== except) d.open = false; });

$("q").addEventListener("input", (e) => update(() => { st.q = e.target.value; }));
$("year").addEventListener("change", (e) => update(() => { st.year = e.target.value; }));
$("sort").addEventListener("change", (e) => update(() => { st.sort = e.target.value; }));
$("withUnit").addEventListener("click", () => update(() => { st.withUnit = !st.withUnit; }));
$("mustOnly").addEventListener("click", () => update(() => { st.must = !st.must; }));
$("more").addEventListener("click", () => { st.shown += PAGE; render(); });
$("reset").addEventListener("click", () => { closeDropdowns(); update(() => { st = initialState(); }); });

// 種別・レア・区分のチップ（data-set の Set を切り替える）
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-set]");
  if (!b) return;
  update(() => {
    const set = st[b.dataset.set], v = b.dataset.val;
    if (set.has(v)) set.delete(v); else set.add(v);
  });
});

$("charaPanel").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pick]");
  if (b) return toggleChara(b.dataset.pick);
  if (e.target.closest("[data-clear]")) update(() => { st.charas = []; });
  if (e.target.closest("[data-close]")) $("charaDD").open = false;
});
$("picked").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]"), m = e.target.closest("[data-m]");
  if (rm) toggleChara(rm.dataset.rm);
  else if (m) update(() => { st.match = m.dataset.m; });
});
$("list").addEventListener("click", (e) => {
  const b = e.target.closest(".tg");
  if (b) toggleChara(b.dataset.tag);
});

// ドロップダウン：外側クリック・Esc で閉じ、同時に1つだけ開く
document.addEventListener("click", (e) => document.querySelectorAll("details.dd[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDropdowns(); });
document.querySelectorAll("details.dd").forEach((d) => d.addEventListener("toggle", () => { if (d.open) closeDropdowns(d); }));

/* ===== 起動 ============================================================ */

fetch("data.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(load)
  .catch(() => {
    $("list").innerHTML = '<p class="empty">データを読み込めませんでした。ページを再読み込みしてください。</p>';
    $("stamp").textContent = "";
  });
