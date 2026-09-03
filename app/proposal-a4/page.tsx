import type { Metadata } from "next";
import s from "./proposal.module.css";

/* ============================================================
 * /proposal-a4 — 提案チラシ(A4・1枚)の HTML 版
 *
 * 岡本が ChatGPT で作った画像版チラシ(Downloads/7e38db7b…png)を
 * デザイン指示書として、同じ温度感を HTML/CSS で再現したもの。
 * 画像版の弱点(誤字・QRの歪み・小さい見出し・文字量)をここで解消する。
 *
 * 岡本の自己評価(2026-09-04)に沿った変更:
 *  - 見出しを大きく、何を売っているか(SNS動画 月10本の丸ごと代行)を先頭に
 *  - タカのマークは廃止、ワードマークのみ
 *  - 「こんなお悩み」ブロック削除・料金表 7行→5行・比較は1バンドに圧縮
 *  - QR は正方形・LPトップへ
 *
 * PDF化: scripts/render_proposal.py(Playwright)→ public/proposal.pdf
 * 内部用: noindex
 * ============================================================ */

export const metadata: Metadata = {
  title: "ByakuyaAI 提案資料(A4)",
  robots: { index: false, follow: false },
};

const Check = () => (
  <svg className={s.check} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#0b1f3a" />
    <path
      d="M7 12.5l3.2 3.2L17 9"
      fill="none"
      stroke="#f4c542"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export default function ProposalA4Page() {
  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <span>A4・1枚。ブラウザの「印刷 → PDFに保存」で書き出せます(余白なし)</span>
        <a href="/proposal.pdf" target="_blank" rel="noopener">
          現行の proposal.pdf を開く
        </a>
      </div>

      <article className={s.page}>
        {/* ===== ヘッダー ===== */}
        <header className={s.header}>
          <div>
            <span className={s.brand}>ByakuyaAI</span>
            <span className={s.tag}>不動産集客をAIで自動化</span>
            <span className={s.tagline}>
              <b>AI</b>は、眠らない。
            </span>
          </div>
          <span className={s.pill}>✓ 賃貸 ✓ 売買 どちらにも対応</span>
        </header>

        {/* ===== ヒーロー ===== */}
        <section className={s.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 印刷用の固定サイズ画像 */}
          <img className={s.heroImg} src="/proposal/hero-right.jpg" alt="" />
          <div className={s.heroText}>
            <div className={s.eyebrow}>物件のショート動画制作 × Instagram・TikTok 投稿代行</div>
            <h1 className={s.h1}>
              物件のSNS動画を、
              <br />
              <em>月10本</em> まるごと代行。
            </h1>
            <div className={s.priceLine}>
              <span className={s.priceLabel}>月額</span>
              <span className={s.price}>¥100,000</span>
              <span className={s.priceNote}>(税別・スタンダードプラン)</span>
            </div>
            <p className={s.sub}>
              写真とマイソクを送るだけ。
              <br />
              撮影・編集・ナレーション・投稿まで、<b>AIが全部やります。</b>
            </p>
            <div className={s.pills}>
              <span>
                <Tick />
                撮影・出演は不要
              </span>
              <span>
                <Tick />
                投稿まで自動
              </span>
              <span>
                <Tick />
                専用ページで確認・修正
              </span>
            </div>
          </div>
          <div className={s.badge}>
            <small>外注と比べて</small>
            <strong>年間最大</strong>
            <span>¥480万円 削減</span>
          </div>
        </section>

        {/* ===== コスト比較バンド ===== */}
        <section className={s.band}>
          <div className={`${s.bandCell} ${s.bandOld}`}>
            <small>SNS担当を1人雇う／運用代行に頼む</small>
            <strong>月 25〜50万円</strong>
          </div>
          <div className={s.vs}>VS</div>
          <div className={`${s.bandCell} ${s.bandNew}`}>
            <small>ByakuyaAI に任せる(動画・投稿・分析込み)</small>
            <strong>月 10万円</strong>
          </div>
          <div className={`${s.bandCell} ${s.bandSave}`}>
            <small>採用・教育・要件定義の手間</small>
            <strong>¥0</strong>
            <em>※ 相場は当社調べ。削減額は月40万円×12ヶ月の試算</em>
          </div>
        </section>

        {/* ===== 料金プラン ===== */}
        <section className={s.section}>
          <h2 className={s.secTitle}>
            料金プラン<small>月額・税別。契約期間の縛りなし</small>
          </h2>
          <table className={s.plans}>
            <colgroup>
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th className={s.thStd}>スタンダード</th>
                <th className={s.thPre}>
                  <span className={s.reco}>おすすめ</span>
                  プレミアム
                  <small>WEBマーケ全部入り</small>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>月額</td>
                <td>
                  <span className={s.money}>
                    <small>¥</small>100,000
                  </span>
                </td>
                <td className={s.colPre}>
                  <span className={s.money}>
                    <small>¥</small>300,000
                  </span>
                </td>
              </tr>
              <tr>
                <td>ショート動画の本数</td>
                <td>
                  <span className={s.count}>月10本</span>
                </td>
                <td className={s.colPre}>
                  <span className={s.count}>月20本</span>
                </td>
              </tr>
              <tr>
                <td>
                  SNS自動投稿 <small>Instagram・TikTok。ハッシュタグ・投稿時間も最適化</small>
                </td>
                <td>
                  <Check />
                </td>
                <td className={s.colPre}>
                  <Check />
                </td>
              </tr>
              <tr>
                <td>
                  公式LINEの内見予約AI <small>24時間自動対応</small>
                </td>
                <td>
                  <span className={s.dash}>—</span>
                </td>
                <td className={s.colPre}>
                  <Check />
                </td>
              </tr>
              <tr>
                <td>
                  AI検索対策 <small>SEO・AEO／毎月AIが自動更新</small>
                </td>
                <td>
                  <span className={s.dash}>—</span>
                </td>
                <td className={s.colPre}>
                  <Check />
                </td>
              </tr>
              <tr>
                <td>
                  月次効果レポート・専属担当 <small>LINE直通・優先対応</small>
                </td>
                <td>
                  <span className={s.dash}>—</span>
                </td>
                <td className={s.colPre}>
                  <Check />
                </td>
              </tr>
            </tbody>
          </table>
          <div className={s.planNote}>
            <span>
              <b>無料お試しパックあり</b>(動画5本・自動継続なし)
            </span>
            <span>※ フランチャイズ・複数店舗運営は別途ご相談ください</span>
          </div>
        </section>

        {/* ===== 4ステップ ===== */}
        <section className={s.section}>
          <h2 className={s.secTitle}>
            導入はたった4ステップ<small>最初の動画は約2〜3時間で完成</small>
          </h2>
          <div className={s.steps}>
            <div className={s.step}>
              <div className={s.stepNo}>1</div>
              <b>撮る</b>
              <span>空室・外観・周辺をスマホで撮影。写真だけでもOK</span>
            </div>
            <div className={s.step}>
              <div className={s.stepNo}>2</div>
              <b>送る</b>
              <span>専用ページに写真とマイソクをアップロード</span>
            </div>
            <div className={s.step}>
              <div className={s.stepNo}>3</div>
              <b>確認</b>
              <span>AIが動画を制作。文言はその場で修正OK</span>
            </div>
            <div className={s.step}>
              <div className={s.stepNo}>4</div>
              <b>投稿</b>
              <span>承認後、最適な時間帯に自動投稿。反響は月次で報告</span>
            </div>
          </div>
        </section>

        {/* ===== フッター ===== */}
        <footer className={s.footer}>
          <div>
            <div className={s.footBrand}>
              <span className={s.brand}>ByakuyaAI</span>
              <span className={s.rep}>代表 岡本 壮司</span>
            </div>
            <div className={s.contacts}>
              <div>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25c1.1.37 2.3.57 3.6.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.6a1 1 0 01-.25 1z" />
                </svg>
                080-6260-9731
              </div>
              <div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                info@byakuyaai.com
              </div>
              <div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                </svg>
                byakuyaai.com
              </div>
            </div>
            <p className={s.trial}>
              まずは<b>無料お試しパック(動画5本)</b>で、貴社の物件で仕上がりをご確認ください。
            </p>
          </div>
          <div>
            <div className={s.qrBox}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 印刷用の固定サイズ画像 */}
              <img src="/proposal/qr.png" alt="byakuyaai.com のQRコード" />
            </div>
            <div className={s.qrCap}>▲ 制作例はQRから</div>
          </div>
          <p className={s.legal}>
            表示価格は税別です。集客効果等の成果を保証するものではありません。掲載内容は2026年9月時点のものです。
          </p>
        </footer>
      </article>
    </div>
  );
}
