// カード画像を 240×135（cover切り抜き）で横10列に並べたスプライトを作り、data URL を window.__out に入れる。
// ITEMS を update_excel.py が出力した sprite_plan.json の、このサイト用の items 配列に置き換えて実行する。
//   [{ "img": "画像URL" } または { "page": "カードページURL" }, ...]   ※ page は gamedbs 用（ページ内の still 画像を使う）
// 画像は実行しているサイトと同じオリジンのものだけ使える（canvas の制約）。
(async () => {
  const ITEMS_ = ITEMS;
  const W = 240, H = 135, C = 10;
  const cv = document.createElement("canvas");
  cv.width = W * C;
  cv.height = H * Math.ceil(ITEMS_.length / C);
  const g = cv.getContext("2d");
  const failed = [];
  await Promise.all(ITEMS_.map(async (it, i) => {
    try {
      let src = it.img;
      if (!src && it.page) {
        const d = new DOMParser().parseFromString(await (await fetch(it.page)).text(), "text/html");
        src = [...d.querySelectorAll("img")].map((x) => x.getAttribute("data-src") || x.getAttribute("src"))
          .find((s) => s && s.includes("/image/card/still/"));
      }
      if (!src) throw new Error("no image");
      const bm = await createImageBitmap(await (await fetch(src)).blob());
      const s = Math.max(W / bm.width, H / bm.height);
      g.drawImage(bm, (i % C) * W + (W - bm.width * s) / 2, Math.floor(i / C) * H + (H - bm.height * s) / 2, bm.width * s, bm.height * s);
    } catch (e) {
      failed.push(i);
    }
  }));
  window.__out = cv.toDataURL("image/webp", 0.72);
  return JSON.stringify({ length: window.__out.length, items: ITEMS_.length, failed });
})();
