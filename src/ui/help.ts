/** 「Wordで使う方法」（SPEC §7.3）。画像なしの文章で説明する */
export function mountHelp(dialog: HTMLDialogElement) {
  dialog.setAttribute('aria-labelledby', 'help-title');
  dialog.innerHTML = `
    <div class="dhead"><h2 id="help-title">Wordで使う方法</h2><button type="button" class="act" data-close>閉じる</button></div>
    <section class="sec howto">
      <h3>Microsoft Word（Microsoft 365）に数式を貼り付ける</h3>
      <ol>
        <li>Wordで <code>Alt</code> ＋ <code>=</code> を押して、数式を挿入します。</li>
        <li>「数式」タブの「変換」グループで、「LaTeX」を選びます（最初の1回だけ）。</li>
        <li>このアプリで「コピー」を押し、Wordの数式の中に貼り付けます。そのあと「変換」→「すべて - 2次元形式」を選びます。</li>
      </ol>
      <p class="note">コピーの形式は「Word用（LaTeX）」を選んでください。OverleafなどLaTeXの文書には「LaTeX」、対応しているアプリには「MathML」が使えます。</p>
      <p class="note">うまく変換されない記号があるときは、支援担当の方に伝えてください。キーの編集で書き方を変えられます。</p>
    </section>`;
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  return { open: () => dialog.showModal() };
}
