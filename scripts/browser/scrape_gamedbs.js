// imassc.gamedbs.jp のどのページで実行してもよい。アイドル1〜29のカード一覧（名前とページURL）を読む。
// 画像（still）は make_sprite.js がカードページから取るので、ここでは読まない。
// 結果: [{url, name, idol}] を window.__out に入れる。
(async () => {
  const out = [];
  for (let i = 1; i <= 29; i++) {
    const d = new DOMParser().parseFromString(await (await fetch(`/chara/show/${i}`)).text(), "text/html");
    d.querySelectorAll(".js-filter a").forEach((a) => {
      const m = a.textContent.trim().match(/^【(.*)】(.*)$/s);
      if (m) out.push({ url: a.href, name: m[1].trim(), idol: m[2].replace(/\s/g, "") });
    });
  }
  window.__out = JSON.stringify(out);
  return JSON.stringify({ length: window.__out.length, cards: out.length });
})();
