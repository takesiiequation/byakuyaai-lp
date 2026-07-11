import type { Manual } from "./types";

export const lineSetupManual: Manual = {
  slug: "line-setup",
  title: "LINE導入ガイド",
  summary:
    "顧客のLINE公式アカウントにAI自動応答ボットを導入する手順(担当者向け)。",
  steps: [
    {
      n: 1,
      title: "LINE公式アカウント + Messaging APIチャネルを作成",
      body: "顧客にLINE公式アカウントを開設してもらう(無料)。続けてLINE DevelopersでMessaging APIチャネルを作成する。操作に不慣れな顧客が多いため、画面共有での伴走を推奨。",
    },
    {
      n: 2,
      title: "3つの値を控える",
      body: "LINE Developersのチャネル設定画面から以下3つを控えておく。\n・channel access token(長期)\n・channel secret\n・bot user ID(Uで始まる文字列)",
    },
    {
      n: 3,
      title: "顧客のDriveフォルダを作成しサービスアカウントに共有",
      body: "顧客専用のGoogle Driveフォルダを新規作成し、下記のサービスアカウントを「編集者」として共有する。共有後、フォルダのURLをコピーし、admin顧客編集画面の「顧客フォルダ」欄に貼り付けて保存する(URLをそのまま貼ってよい)。",
      copyBoxes: [
        { label: "サービスアカウントのメールアドレス", valueKey: "sa_email" },
      ],
    },
    {
      n: 4,
      title: "/admin/clients でLINE欄に3値を保存",
      body: "対象顧客を開き、「LINE AI」セクションのチャネルアクセストークン / チャネルシークレット / ボットユーザーIDにStep2で控えた値を貼り付けて保存する。",
    },
    {
      n: 5,
      title: "「セットアップ実行」ボタンを押す",
      body: "顧客詳細ページの「セットアップ実行」ボタンを押すと、Step3のDriveフォルダ内に顧客専用データシート(LINEナレッジ / LINE会話ログ / 内見予約の3タブ、ナレッジタブは5列ヘッダー)が自動生成される。",
    },
    {
      n: 6,
      title: "LINE Developers側でWebhookを設定",
      body: "LINE DevelopersのMessaging API設定画面で、下記のWebhook URLを貼り付けて「Webhookの利用」をONにする。",
      copyBoxes: [{ label: "Webhook URL", valueKey: "line_webhook_url" }],
      warning:
        "「応答メッセージ」は必ずOFFにすること。ONのままだとLINE標準応答とAI応答が二重に返信される(二重返信防止)。",
    },
    {
      n: 7,
      title: "/admin/line でナレッジを投入",
      body: "よくある質問・営業時間・会社情報などを/admin/lineから顧客ごとに登録する。",
    },
    {
      n: 8,
      title: "実弾テスト(2通)",
      body: "顧客のLINE公式アカウントに実際に2通メッセージを送り、以下を確認する。\n・1通目に返答が来る\n・会話ログシートに行が書き込まれる\n・2通目の返答で1通目の内容を覚えている(文脈保持)",
    },
    {
      n: 9,
      title: "計測リンクを設定",
      body: "LINE公式アカウントのlin.ee URLを顧客編集画面の「LINE計測リンク」欄に貼り付ける。Instagramプロフィール欄・ストーリーズには https://byakuyaai.com/go/<client_id>/line を案内する。",
      warning:
        "Instagramのキャプション内URLはリンク化されない(タップできない)。プロフィール欄またはストーリーズのリンクスタンプ経由で案内すること。",
    },
  ],
};
