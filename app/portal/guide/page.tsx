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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "写真の撮り方ガイド",
  robots: { index: false, follow: false },
};

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
          読了目安:1分
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
                横向きに構え直していただく必要はありません。そのままの縦向きで大丈夫です。ただし被写体に寄りすぎず、2〜3歩下がって部屋全体が入る位置から撮影してください。
              </p>
            </li>
          </ol>

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
