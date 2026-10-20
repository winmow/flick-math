# Word互換テストの結果

`/dev/word-test.html`（開発サーバーなら `http://localhost:5173/dev/word-test.html`）を開き、
Word（Microsoft 365、Windows版）で1つずつ貼り付けて変換した結果を、ここに残す。

## 手順
1. ページの「Word用をコピー」を押す
2. Wordで `Alt` ＋ `=`、「変換」を LaTeX にして貼り付け →「すべて - 2次元形式」
3. 結果（OK / NG / 要修正）とメモをページに記録する
4. 「結果をMarkdownの表にする」で出た表を、下の「結果」にまとめて貼る
5. NG・要修正のキーは、キー編集（またはキーセットJSON）の `word` に、Wordで変換できる書き方を入れる
   - `word` を使った置き換えは、`#0`・`#?` を含まない候補だけが対象（`src/logic/output.ts` の `wordOverrides`）
   - 空欄つきの候補（例：`\sqrt{#0}`）で書き方を変える必要があれば、`toWordLatex` に規則を足す

MathMLをWordへ貼り付けて数式になるかも、同じページの「MathMLをコピー」で確認する。
うまくいけば、出力形式に「Word用（MathML）」を加える。

## 実施情報
- 実施者：
- 実施日：
- Wordのバージョン：

## 結果
（未実施）
