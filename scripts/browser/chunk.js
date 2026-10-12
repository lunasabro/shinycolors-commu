// window.__out を 400,000 文字ずつ取り出す。OFFSET を 0, 400000, 800000 … に置き換えて実行する。
// （ブラウザ連携は約900KBを超える結果を途中で切り捨てるため）
window.__out.slice(OFFSET, OFFSET + 400000)
