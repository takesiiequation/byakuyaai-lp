import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { Shell, MessageCard } from "@/app/portal/_components/Shell";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";

// /portal/guide/video — 動画撮影ガイド(顧客教育コンテンツ)。2026-07-30新設。
// 認証+portal_enabledの再検証は ../page.tsx(写真ガイド)と全く同一の流儀
// (getPortalClientId → シート直読みでportal_enabledを毎リクエスト再確認)
// をそのまま踏襲。独自の認証実装はしない(セッション検証を弱めないため)。
//
// 新設の経緯(2026-07-30): 札幌カンリセンター様が自主撮影の動画8本を
// 「ドアを開ける→入室→部屋を見せる」の11〜23秒構成で撮影・入稿したところ、
// 当時のシステムは先頭から切り出す仕様だったため部屋が映る前に切れてしまう
// 事故が発生。n8n側は同日に改修済み(素材は30秒まで受け入れ、頭35%を飛ばして
// 使う=MAX_VIDEO_DURATION_SEC=30と整合)。本ページは残る「顧客教育」の穴を
// 埋めるためのもので、写真ガイド(../page.tsx)の「動画で撮影する場合」節から
// 誘導される想定。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "動画で撮るときのコツ",
  robots: { index: false, follow: false },
};

// 写真ガイド(../page.tsx)のNARROW_BLOCKと同じ役割。本ページは表・画像等の
// 「非プローズ」要素を持たないため、WIDE_BLOCK相当の分割は不要(単一ブロック
// のままで足りる)。
const NARROW_BLOCK = "prose-custom mx-auto max-w-prose";

export default async function PortalGuideVideoPage() {
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  const client = await getClientById(clientId);
  if (!client || !isFlagOn(client.portal_enabled)) {
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
    <Shell maxWidthClassName="max-w-lg lg:max-w-4xl xl:max-w-6xl">
      <div className="mb-6">
        <a
          href="/portal"
          className="text-xs text-[var(--brand-gray-light)] hover:text-[var(--brand-ink)] transition-colors"
        >
          ← マイページへ戻る
        </a>
        <h1 className="mt-2 text-lg sm:text-xl font-bold text-[var(--brand-ink)]">
          🎥 動画で撮るときのコツ
        </h1>
        <p className="text-xs text-[var(--brand-gray-light)] mt-0.5">
          読了目安:1〜2分
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className={NARROW_BLOCK}>
          <p>
            動画でご入稿いただく場合も、お写真と同じように魅力的な物件動画に仕上げることができます。ポイントは<strong>「短く区切ること」</strong>の一点です。以下を意識して撮影いただくだけで、仕上がりが大きく変わります。
          </p>
        </div>

        {/* TODO: 実演動画の追加(後日、撮影例の動画を public/guide/ に追加して
            このあたりに埋め込む予定)。現時点はテキストのみで案内する。 */}

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>いちばん大事なこと:1カットは5〜10秒</h2>
          <p>
            動画で撮影する場合、1部屋につき1本、<strong>5〜10秒程度</strong>に区切っていただくのがいちばんきれいに仕上がります。最大30秒までお送りいただけますが、それより長くなる場合は、見せたい部分だけを切り出してお送りください。
          </p>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>「溜めてから見せる」は効きます。ただし溜めは1〜2秒で</h2>
          <p>
            ドアを開けた瞬間に広いリビングが広がる、カメラを下から上へ振ると建物の全景が現れる——こうした
            <strong>「溜めてから見せる」撮り方は、最後まで見てもらうためにとても効果的</strong>
            です。ぜひ積極的に使ってください。
          </p>
          <p>
            ポイントは、<strong>溜めの部分を1〜2秒に抑える</strong>ことです。動画の中でお部屋が映るのは1本あたり数秒間ですので、前置きが長いと、肝心のお部屋が映る前に終わってしまいます。
          </p>
          <ul>
            <li>
              ⭕ ドアの前に立つ → すぐ開ける → 部屋が見える(前置き1〜2秒)
            </li>
            <li>
              ⭕ 足元から空へゆっくり振り上げて、建物の全景を見せる
            </li>
            <li>
              ❌ 廊下を10秒歩いてからドアを開ける(歩いている間に終わってしまいます)
            </li>
          </ul>
          <p>
            なお、長めに撮っていただいた場合も、システムがお部屋の映っている部分を自動で選んで使用しますのでご安心ください。ただし狙い通りに仕上げるには、短く区切っていただくのが確実です。
          </p>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <h2>スマホは「縦向き」のまま撮ってください</h2>
          <p>
            横向きで撮影すると、動画の上下が切れてしまいます。スマートフォンを持ったそのままの縦向きで撮影してください。
          </p>

          <h2>動きはゆっくりと</h2>
          <p>
            ゆっくり歩く、またはゆっくり横に振る(パン)ように撮影してください。速い動きは画面がブレてしまい、見づらい映像になります。
          </p>

          <h2>1部屋1本でOKです</h2>
          <p>
            同じ部屋を何本も撮っていただく必要はありません。1部屋につき1本で十分です。
          </p>

          <h2>写真と混ぜてもOKです</h2>
          <p>
            動画が撮れたお部屋は動画で、撮れなかったお部屋は写真(2枚1組)でお送りいただいて構いません。1つの物件の中で、動画と写真を混ぜてお送りいただけます。
          </p>

          <h2>こんな撮り方はご注意ください</h2>
          <ul>
            <li>手ブレが激しい</li>
            <li>逆光で真っ暗</li>
            <li>人や個人情報が映っている</li>
            <li>縦横を途中で持ち替える</li>
          </ul>
        </div>

        <div className={`${NARROW_BLOCK} mt-[1.2em]`}>
          <a
            href="/portal/guide"
            className="block text-xs font-semibold text-[var(--brand-orange-dark)] underline decoration-[var(--brand-orange)]/40 underline-offset-2 hover:decoration-current"
          >
            📸 写真で撮る場合はこちら
          </a>
          <p className="mt-[1.2em]">
            ご不明な点や「この撮り方で大丈夫かな」といったご相談も、いつでも担当者までお気軽にご連絡ください。
          </p>
        </div>
      </div>
    </Shell>
  );
}
