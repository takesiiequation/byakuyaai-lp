import type { Metadata } from "next";
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
    <Shell>
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
          読了目安:1〜2分
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="prose-custom">
          <p>
            弊社の動画は、皆さまからお預かりしたお写真をそのまま活かして制作しています。同じ物件でも、お写真の撮り方ひとつで動画の完成度は大きく変わります。以下のポイントを意識していただくだけで、より魅力的な動画に仕上がります。少しだけお時間をいただき、ご協力いただけますと幸いです。
          </p>

          <h2>基本の3原則</h2>
          <ol>
            <li>
              <strong>部屋の対角(角)から、引きで撮る</strong>
              <p>
                部屋の隅に立ち、対角線上を狙って撮影してください。壁が2面と床が写り込む構図だと、部屋の広さや奥行きがしっかり伝わります。
              </p>
            </li>
            <li>
              <strong>昼間の明るい時間に、カーテンは全開で</strong>
              <p>
                自然光が入っている状態が一番きれいに写ります。曇りの日でも問題ありませんが、夜間や照明だけでの撮影は避けてください。
              </p>
            </li>
            <li>
              <strong>縦向き(スマホのまま)でOK、ただし2〜3歩下がって</strong>
              <p>
                横向きに構え直していただく必要はありません。そのままの縦向きで大丈夫です。ただし被写体に寄りすぎず、2〜3歩下がって部屋全体が入る位置から撮影してください。下がるスペースがない部屋では、カメラの超広角(0.5×)に切り替えるのも効果的です。
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
          <p>
            つまり、<strong>撮影セットが揃っているほど、この流れがきれいに完成します</strong>。逆にどれかが欠けると、その役割を他の写真で代用することになり、少しもったいない仕上がりになることがあります。
          </p>

          {SHOWCASE_VIDEOS.length > 0 && (
            <>
              <h2>実際の作例</h2>
              <p>
                上の流れで実際に仕上がった動画のお手本です。撮影の際のイメージづくりにぜひご覧ください。
              </p>
              {SHOWCASE_VIDEOS.map((v) => (
                <div key={v.url}>
                  <h3>{v.title}</h3>
                  {v.note && <p>{v.note}</p>}
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    src={v.url}
                    className="mx-auto w-full max-w-[280px] rounded-xl ring-1 ring-black/10"
                  />
                </div>
              ))}
            </>
          )}

          <h2>ワンポイント</h2>
          <blockquote>
            <p>
              「その部屋に住むとしたら、朝起きてから夜眠るまでにどんな景色を目にするだろう」と想像しながら撮っていただくと、自然と撮るべきカットが揃います。玄関を開けて→廊下を通り→リビングでくつろぎ→キッチンで料理をして→お風呂で一日の疲れを癒し→バルコニーで夜景を眺める。そんな一日の流れをイメージしていただくだけで、住みたくなる動画に近づきます。
            </p>
          </blockquote>

          <p>
            ご不明な点がございましたら、いつでも担当者までお気軽にご連絡ください。いただいたお写真を最大限活かして、魅力的な動画をお届けします。
          </p>
        </div>
      </div>
    </Shell>
  );
}
