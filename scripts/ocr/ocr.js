// 画像の文字を読み取って標準出力に出す。使い方: node ocr.js 画像...
// 日本語モデルは @tesseract.js-data/jpn の best_int（サイトの検索と同じもの）
const path = require("path");
const { createWorker } = require("tesseract.js");

(async () => {
  const langPath = path.join(path.dirname(require.resolve("@tesseract.js-data/jpn/package.json")), "4.0.0_best_int");
  const worker = await createWorker("jpn", 1, { langPath, gzip: true, cachePath: path.join(__dirname, ".cache") });
  for (const img of process.argv.slice(2)) {
    const { data } = await worker.recognize(img);
    process.stdout.write(data.text + "\n");
  }
  await worker.terminate();
})();
