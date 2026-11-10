#!/bin/sh
# 拡張機能に、文字の読み取り（Tesseract.js・Apache-2.0）を同梱する。scripts/ocr で npm install 済みのものを使う
set -e
cd "$(dirname "$0")"
NM=../scripts/ocr/node_modules
mkdir -p lib/core lib/lang
cp $NM/tesseract.js/dist/tesseract.min.js $NM/tesseract.js/dist/worker.min.js lib/
cp $NM/tesseract.js-core/tesseract-core-simd-lstm.wasm.js $NM/tesseract.js-core/tesseract-core-lstm.wasm.js lib/core/
cp $NM/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz lib/lang/
cp $NM/tesseract.js/LICENSE.md lib/LICENSE-tesseract.js.md
echo "lib/ にそろいました"
