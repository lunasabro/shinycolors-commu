// brilliant.avalon-studio.work のどのページで実行してもよい。年別カード一覧（/card/YYYY.html）を全部読む。
// 結果: [{url, name, idols:[...], colls:[...], kind:"P"|"S", thumb}] を window.__out に入れる。
(async () => {
  const origin = "https://brilliant.avalon-studio.work";
  const first = new DOMParser().parseFromString(await (await fetch("/card/")).text(), "text/html");
  let years = [...new Set([...first.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    .filter((h) => h && /\/card\/\d{4}\.html$/.test(h)))];
  if (!years.length) years = Array.from({ length: new Date().getFullYear() - 2017 }, (_, i) => `/card/${2018 + i}.html`);
  const out = [];
  for (const y of years) {
    const d = new DOMParser().parseFromString(await (await fetch(y)).text(), "text/html");
    d.querySelectorAll(".card").forEach((c) => {
      const a = c.querySelector(".card-title a");
      if (!a) return;
      const meta = [...c.querySelectorAll(".card-title img")].map((i) => i.getAttribute("title") || "").join("/");
      const img = c.querySelector("img.img-default");
      out.push({
        url: new URL(a.getAttribute("href"), origin).href,
        name: a.textContent.trim(),
        idols: [...c.querySelectorAll(".idol-tag")].map((s) => s.textContent.trim()),
        colls: [...c.querySelectorAll(".attribute-tag")].map((s) => s.textContent.trim()),
        kind: meta.includes("プロデュース") ? "P" : "S",
        thumb: img ? new URL(img.getAttribute("src"), origin).href : "",
      });
    });
  }
  window.__out = JSON.stringify(out);
  return JSON.stringify({ length: window.__out.length, cards: out.length, years: years.length });
})();
