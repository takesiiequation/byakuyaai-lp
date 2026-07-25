import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { Shell, MessageCard } from "../_components/Shell";

// /portal/guide — 写真撮影ガイド(顧客教育コンテンツ)。認証+portal_enabled
// 再検証は他の /portal 配下ページと同一の流儀(getPortalClientId → シート
// 直読みで portal_enabled を毎リクエスト再確認)。
//
// 掲載内容は本体n8nワークフロー(fudosan_v15-prod)の写真処理ノードの実仕様
// に基づく: 「Claude Vision: キャプション+空室判定」の visual_impact ルール
// (暗い/狭い/トイレ/設備アップ=弱評価)、「Claude Director: 準備」の採用/
// 除外ロジック(設備単品クローズアップ除外・洗面台は例外・クローゼット/WIC
// は部屋として写っていれば採用・トイレ原則不採用・同一写真の使い回し禁止・
// リビング2枚以上なら褒めbeat保存則でbodyに残す)、「写真リスト展開」の
// PHOTO_CAP=10(MAX_PHOTOS/RECOMMENDED_PHOTOSとも一致)。
//
// 「写真の比率」セクションの根拠(2026-07-16 実仕様調査):
// - 「Kling: Build Request」— 顧客写真は image_url としてそのまま
//   Seedance i2v へ渡り aspect_ratio='9:16'(フォーム既定)で生成される。
// - 「Build Creatomate Payload」— 静止画フォールバックは fit:'cover' +
//   パン演出 scale 108〜118%(=中央基準で切り出し+ズーム。余白は足さない)。
// → どの比率で撮っても最終フレームは縦9:16に「切り出される」。9:16モードで
//   撮ると撮影時点で視野が狭まる(失った両脇は二度と戻らない)うえ寄り構図を
//   誘発するため、スマホ標準の4:3のまま+引きで撮るのが最も情報量を保つ。
//
// 「動画の流れ」対応表の根拠: 「Claude Director: 準備」の構成鉄則 —
// hook=一番映える室内 / intro=外観または玄関・廊下 / body=内見導線順
// (LDK→キッチン→水回り→居室→バルコニー) / reveal=外観優先(夜景演出)+
// 価格はラスト発表(reveal統合)。顧客向けには内部用語を使わず翻訳して掲載。
//
// 「同じ部屋を2枚1組で撮る」セクション(2026-07-22追加)の根拠:
// 入稿フォームの部屋カードUI(RoomCardsField)は同一部屋の写真2枚を
// 「始まり/終わり」の順序ラベルで受け付ける(docs/smapho_hitotsu_design.md
// のピボット設計)。start画像→end画像の2位置間をカメラ移動でつなぐため、
// 反対側から振り返って撮った「真逆の2枚」は間の映像が作れず不自然になる
// (=NG例として明記)。実演素材は public/guide/pair_demo_*(2026-07-23差し
// 替え: 白金台の実物件写真から生成した実演。モデルルームのサンプルではない)。
// 1枚のみの投稿は引き続きサポート対象のフォールバックなので、2枚1組は
// 「できれば」の推奨として案内する。
//
// 「カメラの動きは4種類」セクション(2026-07-25追加)の根拠:
// これまでの実演は「2枚1組=前へ進む(プッシュイン)」の1種類しか載せて
// いなかったが、動きの種類ごとに2枚目の撮り方が違う(前進/その場で向きを
// 変える/上を向く)ため、顧客が狭い部屋で前進を試みて詰まる。4本の実演
// 動画(public/guide/motion_*.mp4 — 白金台の実物件写真から生成した実映像・
// 720x1280 9:16・約5秒・音声なし)で動きと撮り方を対応づける。
// 既存の「場所別」テーブルは早見表として残し、①各行の先頭に動きの名前を
// 付けて4カードと対応づけ ②外観(見上げる)の行を追加 ③注意ボックスの
// 「必ず同じ向きのまま前に進んだ2枚を」という一文が「向きを変える/上を
// 向く」と矛盾するため、動き3種のいずれかを起点にする表現へ改めた。
//
// v3.3(2026-07-23・PC幅活用・岡本FB「画面をまだまだ使えてない」対応):
// 記事本文をこれまでの単一 prose-custom ラッパー1枚から、セクション単位の
// 複数ブロック(各ブロックが個別に prose-custom クラスを持つ)へ分割した。
// 理由: 実演ブロック・早見表・注意ボックスなど「非プローズ」要素はlg+で
// 広い幅を使わせたい一方、本文段落はmax-w-prose(可読行長)を維持したい
// ため、ブロック単位でしか幅を変えられない。
// 分割の仕組み: globals.css の `.prose-custom > * + *` は「直接の子要素」
// にのみ margin-top:1.2em を与える兄弟結合子ルールなので、ブロックをまたぐ
// と自動では効かなくなる → 各ブロックに `mt-[1.2em]`(先頭ブロックを除く)
// を明示して踏襲。見出し(h2=2.4em/h3=1.8em)やblockquote(margin:0)は
// 要素自身により強い指定を持つため、ブロックの親子マージン相殺(margin
// collapsing)で従来と同じ見た目になる(表・引用は個別に検証済み)。
// `.prose-custom <tag>` の色/罫線等のスタイルは子孫セレクタなので、入れ子
// 段数が変わっても分割の影響を受けない。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "写真の撮り方ガイド",
  robots: { index: false, follow: false },
};

// 「実際の作例」セクションのお手本動画。URLは後日差し込み(白金台デモ+
// スタンダード価格帯物件の2本を予定)。空配列の間はセクションごと非表示
// (fail-soft)。mp4等の直リンクを想定 — YouTube等の埋め込みへ切り替える
// 場合はレンダリング側を iframe に差し替えること。
const SHOWCASE_VIDEOS: ReadonlyArray<{
  title: string;
  url: string;
  note?: string;
}> = [];

// 「カメラの動きは4種類」の実演カード。動画は全て 9:16(720x1280)・約5秒・
// 音声なし。autoPlay+loop だが preload="none" とし、ポスター画像で初期表示を
// 賄う(4本同時ダウンロードを避ける。ブラウザは画面外の自動再生を遅延させる
// ため、実質はスクロールで見えたものから読み込まれる)。
const CAMERA_MOTIONS: ReadonlyArray<{
  name: string;
  src: string;
  poster: string;
  label: string;
  how: string;
  where: string;
}> = [
  {
    name: "前へ進む",
    src: "/guide/motion_pushin.mp4",
    poster: "/guide/motion_pushin_poster.jpg",
    label: "前へ進むカメラ移動の実演(廊下)",
    how: "同じ向きのまま、2〜3歩(廊下なら5歩ほど)前に進んだ位置で2枚目を撮ります。",
    where: "廊下・玄関・細長い部屋・広いリビング",
  },
  {
    name: "左右に見わたす(室内)",
    src: "/guide/motion_pan_lr.mp4",
    poster: "/guide/motion_pan_lr_poster.jpg",
    label: "左右に見わたすカメラ移動の実演(洗面)",
    how: "足は動かさず、その場に立ったまま体の向きだけ変えて2枚目を撮ります(90°以内)。",
    where: "洗面・浴室・キッチンなど、下がるスペースがない場所",
  },
  {
    name: "左右に見わたす(屋外)",
    src: "/guide/motion_pan_lr_outdoor.mp4",
    poster: "/guide/motion_pan_lr_outdoor_poster.jpg",
    label: "左右に見わたすカメラ移動の実演(バルコニー)",
    how: "同じくその場に立ったまま、向きだけ変えて2枚。景色の広がりが伝わります。",
    where: "バルコニー・テラス・眺望",
  },
  {
    name: "見上げる",
    src: "/guide/motion_tilt.mp4",
    poster: "/guide/motion_tilt_poster.jpg",
    label: "見上げるカメラ移動の実演(外観)",
    how: "同じ場所に立ったまま、カメラを少し上に向けて2枚目を撮ります。",
    where: "外観・吹き抜け・天井の高いお部屋",
  },
];

// v3.3: 「非プローズ」ブロック(実演/早見表/注意ボックス/表/作例)の幅。
// モバイル・タブレットは従来どおり max-w-prose のまま、lg+から段階的に
// 拡張する。本文の段落・見出し・リスト等(「プローズ」ブロック)は
// max-w-prose 固定(NARROW_BLOCK)。
const NARROW_BLOCK = "prose-custom mx-auto max-w-prose";
const WIDE_BLOCK =
  "prose-custom mx-auto max-w-prose lg:max-w-3xl xl:max-w-4xl";

export default async function PortalGuidePage() {
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  const client = await getClientById(clientId);
  if (!client || client.portal_enabled !== "true") {
    return (
      <Shell>
        <MessageCard
          title="マイページをご利用いただけません"
          body="お手数ですが担当者までご連絡ください。"
        />
      </Shell>
    );
  }

  return (
    // v3.3(2026-07-23): 記事幅をxl+でさらに拡大(lg:max-w-4xl→
    // xl:max-w-6xl)。カード自体の幅はここで決まり、本文プローズは
    // カード内部で個別にmax-w-proseへ絞る(下のNARROW_BLOCK)。
    <Shell maxWidthClassName="max-w-lg lg:max-w-4xl xl:max-w-6xl">
      <div className="mb-6">
        <a
          href="/portal"
          className="text-xs text-[var(--brand-gray-light)] hover:text-[var(--brand-ink)] transition-colors"
        >
          ← マイページへ戻る
        </a>
        <h1 className="mt-2 text-lg sm:text-xl font-bold text-[var(--brand-ink)]">
          📸 魅力的な動画になる写真の撮り方
        </h1>
        <p className="text-xs text-[var(--brand-gray-light)] mt-0.5">
          読了目安:2〜3分
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className={NARROW_BLOCK}>
          <p>
            弊社の動画は、皆さまからお預かりしたお写真をそのまま活かして制作しています。同じ物件でも、お写真の撮り方ひとつで動画の完成度は大きく変わります。以下のポイントを意識していただくだけで、より魅力的な動画に仕上がります。少しだけお時間をいただき、ご協力いただけますと幸いです。
          </p>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>同じ部屋を2枚1組で撮る(基本ルール)</h2>
          <p>
            各お部屋の写真は、できるだけ<strong>2枚1組</strong>でお送りください。同じ部屋を、同じ向きのまま2〜3歩進んだ2つの位置から撮っていただくだけで、その2枚から自然なカメラ移動のある映像を作ることができます。1枚目が映像の「始まり」、2枚目が「終わり」になり、その間をなめらかにつないだ映像に仕上がります。
          </p>
          <p>
            ※ 1枚のみでも動画は作成できます。ただし2枚1組でお送りいただいたお部屋は、より内見に近い臨場感のある仕上がりになります。
          </p>
        </div>

        {/* 実演ブロック: 始まり/終わりの2枚 → 矢印 → 生成された映像。
            非プローズ要素なので単独でWIDE幅を使う(prose-customは内部の
            テキストが全てTailwindユーティリティで自己完結しているため
            不要)。v3.3: lg+では画像ペア・矢印・動画を横一列に並べる
            (岡本FB「実演ブロックをlg+では横一列に」)。 */}
        <div className="mt-[1.2em] mx-auto max-w-prose lg:max-w-3xl xl:max-w-4xl rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/60 p-4 sm:p-5">
          <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-center lg:gap-4">
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <figure className="w-[36%] max-w-[160px] lg:w-32 lg:max-w-none xl:w-36">
                <Image
                  src="/guide/pair_demo_start.jpg"
                  alt="始まりの1枚(撮影例・LDKを広めに撮った1枚目)"
                  width={768}
                  height={768}
                  sizes="(min-width: 1024px) 144px, 160px"
                  className="h-auto w-full rounded-lg ring-1 ring-black/10"
                />
                <figcaption className="mt-1.5 text-center text-[10px] font-bold text-[var(--brand-orange-dark)]">
                  始まりの1枚
                </figcaption>
              </figure>
              <span
                aria-hidden
                className="shrink-0 text-xl text-[var(--brand-gray-light)] sm:text-2xl"
              >
                →
              </span>
              <figure className="w-[36%] max-w-[160px] lg:w-32 lg:max-w-none xl:w-36">
                <Image
                  src="/guide/pair_demo_end.jpg"
                  alt="終わりの1枚(撮影例・同じ向きのまま数歩進んだ2枚目)"
                  width={768}
                  height={768}
                  sizes="(min-width: 1024px) 144px, 160px"
                  className="h-auto w-full rounded-lg ring-1 ring-black/10"
                />
                <figcaption className="mt-1.5 text-center text-[10px] font-bold text-[var(--brand-orange-dark)]">
                  終わりの1枚
                </figcaption>
              </figure>
            </div>
            {/* lg+のみ表示する2本目の矢印(ペア→動画の生成イメージをつなぐ) */}
            <span
              aria-hidden
              className="hidden text-2xl text-[var(--brand-gray-light)] lg:block"
            >
              →
            </span>
            <video
              src="/guide/pair_demo_ldk.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="mx-auto block w-full max-w-[200px] rounded-xl ring-1 ring-black/10 lg:mx-0 lg:w-32 lg:max-w-none xl:w-36"
            />
          </div>
          <p className="mt-3 text-center text-xs text-[var(--brand-gray-light)]">
            この2枚から、このカメラ移動が生まれます(作例は実際の物件写真から生成した映像です)
          </p>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>カメラの動きは4種類。2枚の撮り方で決まります</h2>
          <p>
            上の作例は「前へ進む」動きですが、カメラの動きはこれだけではありません。<strong>2枚をどう撮ったかで、映像の動き方が決まります</strong>。同じ向きのまま前に進んで撮れば前へ進む映像に、その場で向きを変えて撮れば左右に見わたす映像になります。
          </p>
          <p>
            どの動きが向いているかは、お部屋の形で決まります。たとえば洗面所のような狭い場所で前へ進もうとすると、すぐ壁にぶつかってしまい2枚目が撮れません。こうした場所は、その場に立ったまま向きを変える「左右に見わたす」が向いています。下の4つの実演を参考に、お部屋ごとに撮りやすい動きをお選びください。
          </p>
        </div>

        {/* 4種のカメラ移動の実演カード。非プローズ要素なので実演ブロックと
            同じWIDE幅を使う。縦積み(モバイル)→2列(lg)→4列(xl)。 */}
        <div className="mt-[1.2em] mx-auto max-w-prose lg:max-w-3xl xl:max-w-4xl">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4 xl:gap-3">
            {CAMERA_MOTIONS.map((m) => (
              <figure
                key={m.src}
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/60 p-4 xl:p-3"
              >
                <video
                  src={m.src}
                  poster={m.poster}
                  aria-label={m.label}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="mx-auto block aspect-[9/16] w-full max-w-[200px] rounded-lg object-cover ring-1 ring-black/10"
                />
                <figcaption className="mt-3">
                  <p className="text-center text-sm font-bold text-[var(--brand-ink)]">
                    {m.name}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--brand-gray)]">
                    <span className="font-bold text-[var(--brand-orange-dark)]">
                      こう撮ります:
                    </span>
                    {m.how}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--brand-gray-light)]">
                    向く場所:{m.where}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-[var(--brand-gray-light)]">
            いずれも、実際の物件写真2枚から生成した映像です
          </p>
        </div>

        {/* 場所別・2枚の撮り方の目安(早見表)— 非プローズ要素としてWIDE幅 */}
        <div className={`${WIDE_BLOCK} mt-[1.2em]`}>
          <h3>場所別・撮り方の早見表</h3>
          <p>
            上の4つの動きを、場所別にまとめました。迷ったときは、この表のとおりに撮っていただければ大丈夫です。
          </p>
          <table>
            <thead>
              <tr>
                <th>場所</th>
                <th>2枚の撮り方</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>通常の部屋</td>
                <td>
                  前へ進む:部屋の同じ側から、向きを変えずに2〜3歩前進
                </td>
              </tr>
              <tr>
                <td>細長い部屋・廊下</td>
                <td>前へ進む:同じ向きのまま、5歩ほど前進</td>
              </tr>
              <tr>
                <td>狭い部屋・洗面</td>
                <td>
                  左右に見わたす:その場に立ったまま、少しだけ向きを変えて2枚(90°以内)
                </td>
              </tr>
              <tr>
                <td>バルコニー・眺望</td>
                <td>
                  左右に見わたす:その場に立ったまま、景色を追うように向きを変えて2枚
                </td>
              </tr>
              <tr>
                <td>浴室・トイレ</td>
                <td>前へ進む:入口から1枚+半歩入って1枚</td>
              </tr>
              <tr>
                <td>外観・吹き抜け</td>
                <td>
                  見上げる:同じ場所から、カメラを少し上に向けて2枚目
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* こんな2枚の撮り方はご注意ください(注意ボックス)— 非プローズ要素 */}
        <div className={`${WIDE_BLOCK} mt-[1.2em]`}>
          <h3>こんな2枚の撮り方はご注意ください</h3>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              ⚠ 部屋の反対側に回り込んで、振り返って撮った2枚(真逆の2枚)
            </p>
            <p className="mt-1 text-sm text-amber-700">
              2枚の間をつなぐ映像が作れず、不自然な仕上がりになってしまいます。1枚目を撮った場所を起点に、上の4つの動き(前へ進む・左右に見わたす・見上げる)のいずれかで2枚目を撮ってください。
            </p>
          </div>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>スマホは「縦向き」のまま撮ってください</h2>
          <p>
            横向きに構え直していただく必要はありません。スマートフォンを持ったそのままの縦向きで撮影してください。弊社の動画はすべて縦画面でご覧いただく形式のため、横向きで撮ったお写真や、不動産ポータルサイト掲載用にすでに横長で保存されているお写真をお送りいただくと、画面にうまく収まらず画質が大きく落ちてしまいます。お手数ですが、動画用には縦向きで撮影したお写真を新たにご用意ください。
          </p>

          <h2>基本の2原則</h2>
          <ol>
            <li>
              <strong>部屋の対角(角)から、引きで撮る</strong>
              <p>
                部屋の隅に立ち、対角線上を狙って撮影してください。壁が2面と床が写り込む構図だと、部屋の広さや奥行きがしっかり伝わります。被写体に寄りすぎないよう、2〜3歩下がって部屋全体が入る位置から撮影してください。下がるスペースがない部屋では、カメラの超広角(0.5×)に切り替えるのも効果的です。
              </p>
            </li>
            <li>
              <strong>昼間の明るい時間に、カーテンは全開で</strong>
              <p>
                自然光が入っている状態が一番きれいに写ります。曇りの日でも問題ありませんが、夜間や照明だけでの撮影は避けてください。
              </p>
            </li>
          </ol>

          <h2>写真の比率は「スマホ標準(4:3)」のままで</h2>
          <p>
            カメラアプリの撮影比率は、<strong>標準の「4:3」のまま</strong>にしてください。「9:16」や「フルスクリーン」モードへの変更はおすすめしません。
          </p>
          <p>
            完成する動画は縦長(9:16)ですが、縦長への切り出しは弊社のシステムが自動で行います。9:16モードで撮影すると、その切り出しを撮影の時点で先にしてしまうことになり、写真の視野がぐっと狭くなります。その結果、お部屋が実際より狭く・近く見える「ドアップ気味」の写真になりがちです。一度撮影で失われた両脇の景色は、後からシステムで復元することができません。
          </p>
          <p>
            4:3のまま広めに撮っていただければ、いちばん見せたい部分を活かして動画に仕上げます。その際、写真の両端は多少切り取られる前提で、<strong>見せたい主役はなるべく中央寄り</strong>に収めていただくと確実です。
          </p>

          <h2>こんな写真はご注意ください</h2>
          <ul>
            <li>
              設備だけのドアップ(エアコン、給湯器、ブレーカー、モニター付きインターホン、コンロ、換気扇など)→
              動画では使用されない場合があります
            </li>
            <li>暗い写真・手ブレしている写真</li>
            <li>極端に寄りすぎて、壁や床が見切れている写真</li>
          </ul>
          <p>
            これらの写真をお送りいただくこと自体は問題ありません。ただし動画の1カットとして採用されにくいため、可能であれば他の写真もあわせてご用意いただけますと安心です。なお洗面台全体を写した写真や、クローゼット・ウォークインクローゼットを部屋として広く写した写真は、魅力的な1カットとして使わせていただいています。トイレは基本的に動画では使用しておりませんので、無理に撮影いただかなくても大丈夫です。
          </p>

          <h2>おすすめの撮影セット(1物件あたり)</h2>
          <ul>
            <li>
              リビング:2枚以上、できれば別の角度から(お部屋いちばんの魅力をしっかり見せられます)
            </li>
            <li>キッチン</li>
            <li>浴室</li>
            <li>洗面</li>
            <li>玄関または廊下</li>
            <li>外観(建物全体がわかるもの・動画の締めくくりに使われる大切な1枚です)</li>
            <li>バルコニーからの眺望(あれば)</li>
            <li>マイソク(図面):文字が読める鮮明さで撮影・スキャンをお願いします</li>
          </ul>
          <p>
            全体で5〜10枚程度が目安です。似た構図の写真を何枚も送っていただくより、部屋ごとに角度を変えて撮っていただいたほうが、動画の中でバラエティ豊かに活きます。
          </p>

          <h2>動画で撮影する場合</h2>
          <p>
            お写真の代わりに、動画で撮影していただいても構いません。次の点を意識してください。
          </p>
          <ul>
            <li>スマホは縦向きのまま撮影してください</li>
            <li>ゆっくり歩く、またはゆっくりパン(横に振る)しながら撮影してください</li>
            <li>1本あたり30秒以内を目安にしてください</li>
            <li>
              いちばん見せたい瞬間が最初の数秒に来るように撮影してください(お送りいただいた動画から、いい部分を切り出して使用します)
            </li>
          </ul>
        </div>

        {/* お送りいただいた写真は、こんな動画になります(役割対応表)—
            非プローズ要素としてWIDE幅 */}
        <div className={`${WIDE_BLOCK} mt-[1.2em]`}>
          <h2>お送りいただいた写真は、こんな動画になります</h2>
          <p>
            動画は「実際の内見と同じ流れ」で自動的に組み立てられます。上の撮影セットが揃っていると、それぞれのお写真が次のような役割で活躍します。
          </p>
          <table>
            <thead>
              <tr>
                <th>お写真</th>
                <th>動画の中での役割</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>リビング(いちばん映える1枚)</td>
                <td>
                  冒頭の「つかみ」。最初の2秒で視聴者の指を止める、動画の顔になります
                </td>
              </tr>
              <tr>
                <td>外観 または 玄関・廊下</td>
                <td>
                  物件の紹介パート。「これからこの物件に入っていく」導入のカットです
                </td>
              </tr>
              <tr>
                <td>キッチン・浴室・洗面・居室</td>
                <td>中盤の部屋巡り。内見と同じ順番でお部屋を案内します</td>
              </tr>
              <tr>
                <td>リビング(別角度の2枚目)</td>
                <td>
                  部屋巡りの中で改めてじっくり。物件の主役をもう一度褒める枠です
                </td>
              </tr>
              <tr>
                <td>バルコニーからの眺望 / 外観</td>
                <td>
                  締めのカット。外観は夜の景色に変わる演出で、余韻を残して終わります
                </td>
              </tr>
              <tr>
                <td>(家賃・価格)</td>
                <td>
                  最後の最後に発表。「いくらだと思いますか?」の期待感を引っ張るのが定番の勝ちパターンです
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <p>
            つまり、<strong>撮影セットが揃っているほど、この流れがきれいに完成します</strong>。逆にどれかが欠けると、その役割を他の写真で代用することになり、少しもったいない仕上がりになることがあります。
          </p>
        </div>

        {SHOWCASE_VIDEOS.length > 0 && (
          <div className={`${WIDE_BLOCK} mt-[1.2em]`}>
            <h2>実際の作例</h2>
            <p>
              上の流れで実際に仕上がった動画のお手本です。撮影の際のイメージづくりにぜひご覧ください。
            </p>
            {/* v3.3: 作例はlg+で2列グリッド。ブロック自体がWIDE幅なので
                縦動画2〜3列が余裕をもって収まる。モバイルは縦積みのまま。 */}
            <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
              {SHOWCASE_VIDEOS.map((v) => (
                <div key={v.url}>
                  <h3>{v.title}</h3>
                  {v.note && <p>{v.note}</p>}
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    src={v.url}
                    className="mx-auto w-full max-w-[280px] lg:max-w-full rounded-xl ring-1 ring-black/10"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>ワンポイント</h2>
          <blockquote>
            <p>
              「その部屋に住むとしたら、朝起きてから夜眠るまでにどんな景色を目にするだろう」と想像しながら撮っていただくと、自然と撮るべきカットが揃います。玄関を開けて→廊下を通り→リビングでくつろぎ→キッチンで料理をして→お風呂で一日の疲れを癒し→バルコニーで夜景を眺める。そんな一日の流れをイメージしていただくだけで、住みたくなる動画に近づきます。
            </p>
          </blockquote>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <p>
            ご不明な点がございましたら、いつでも担当者までお気軽にご連絡ください。いただいたお写真を最大限活かして、魅力的な動画をお届けします。
          </p>
        </div>
      </div>
    </Shell>
  );
}
