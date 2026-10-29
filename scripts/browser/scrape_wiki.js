// wikiwiki.jp/shinycolors のどのページで実行してもよい（同一オリジンで一覧ページを取得する）。
// 結果は window.__out（JSON文字列）に入れ、概要を返す。本体は chunk.js で取り出す。
(async () => {
  const base = "/shinycolors/";
  const parse = async (page) => new DOMParser().parseFromString(await (await fetch(base + encodeURIComponent(page))).text(), "text/html");
  const clean = (s) => (s || "").replace(/\s+/g, "");
  const headingOf = (tb) => {
    let p = tb;
    for (let k = 0; k < 300 && p; k++) {
      p = p.previousElementSibling || p.parentElement;
      if (p && /^H[1-4]$/.test(p.tagName)) return p.textContent.trim();
    }
    return "";
  };
  const reflect = (doc) => (doc.body.textContent.match(/(\d{4})\/(\d{2})\/(\d{2})実装分まで反映済み/) || []).slice(1, 4).join("-");
  const cards = [];
  const out = { support_reflect: "", produce_reflect: "", cards, pickups: [] };

  for (const [kind, page] of [["P", "プロデュースアイドル一覧"], ["S", "サポートアイドル一覧"]]) {
    const doc = await parse(page);
    out[kind === "P" ? "produce_reflect" : "support_reflect"] = reflect(doc);
    doc.querySelectorAll("table").forEach((tb) => {
      if (tb.parentElement.closest("table")) return;
      const hdr = [...(tb.rows[0]?.cells || [])].map((c) => clean(c.textContent));
      if (!/カード名/.test(hdr[0] || "")) return;
      const iDate = hdr.findIndex((h) => h === "追加日");
      const iCommu = hdr.findIndex((h) => h.includes("コミュ"));
      const iGacha = hdr.findIndex((h) => /ガシャ種別|^ガシャ$/.test(h));
      const iGet = hdr.findIndex((h) => h === "入手");
      const rarity = (headingOf(tb).match(/^(UR|SSR|SR|R)/) || [])[1] || "";
      [...tb.rows].slice(1).forEach((r) => {
        const c = [...r.cells].map((x) => x.textContent.trim());
        if (c.length < hdr.length - 1) return;
        const m = c[0].match(/^【(.*)】(.*?)(\*\d+)?$/s);
        const date = (c[iDate >= 0 ? iDate : c.length - 1] || "").replace(/\//g, "-");
        if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const card = {
          kind, rarity, name: m[1].trim(), idol: m[2].replace(/\s/g, ""), date,
          commu: iCommu >= 0 && /^\d+$/.test(c[iCommu]) ? +c[iCommu] : null,
          gacha: iGacha >= 0 ? c[iGacha] : "", get: iGet >= 0 ? c[iGet] : "",
        };
        cards.push(card);
      });
    });
  }

  // ガシャページのピックアップ（一覧に未反映の新カードの検出用）
  const g = await parse("ガシャ");
  g.querySelectorAll("table").forEach((tb) => {
    [...tb.rows].forEach((r) => {
      const t = r.textContent;
      const d = (t.match(/(\d{4})\/(\d{2})\/(\d{2})/) || []).slice(1, 4).join("-");
      (t.match(/【[^】]+】[^\s【]+/g) || []).forEach((s) => {
        const m = s.match(/^【(.*)】(.*)$/);
        if (m && d) out.pickups.push({ name: m[1], idol: m[2], start: d });
      });
    });
  });

  window.__out = JSON.stringify(out);
  return JSON.stringify({ length: window.__out.length, support_reflect: out.support_reflect, produce_reflect: out.produce_reflect,
    cards: cards.length, pickups: out.pickups.length });
})();
