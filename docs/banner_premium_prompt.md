# banner-premium.png 生成プロンプト (ChatGPT images 2.0)

## 目的

LP の BannerCarousel スライド2(プレミアム版)用バナー画像。
既存 `public/banner.png` (スタンダード版「月10万円でSNS担当者を雇う」) と同じ世界観・同じ縦横比で「プレミアム版」を作る。

## 配置先

`C:\Users\takes\projects\byakuyaai-lp\public\banner-premium.png`

## 規格

- **縦横比**: 4:3 (1024×768 推奨) ※ `banner.png` と統一
- **ファイル形式**: PNG
- **解像度**: 1024×768 以上
- **色味**: ブランドオレンジ (#E67E22 系) + アイボリー (#FAF6EE 系) + 黒ベース (#1A1A1A)
- **テキスト**: 画像内に大きく入れる(banner.png と同じスタイル)

## メインキャッチコピー(画像内)

**「月30万円で、WEBマーケティングチームを雇う。」**

サブコピー(小さく):
「動画制作 × SNS運用 × LINE自動応答 × HPサポート」
「ファイルを置くだけ。24時間眠らないAIチーム。」

## デザイン方針

`banner.png` (スタンダード版) と並列で見せるカルーセルなので **世界観統一が最重要**:

- 同じフォント (太めゴシック・サンセリフ系)
- 同じ色温度 (暖色系アイボリー背景に黒文字 or 黒背景に白文字)
- 同じレイアウト(中央寄せ・大きく一行・サブコピー下)
- ロゴ位置・スペック表示位置も同じ

ただし「格上げ感」を出すために以下で差別化:
- **PREMIUM バッジ**を左上 or 右上に金色 or 黒で配置
- 背景に「チーム」を象徴するモチーフ(複数のアバター・複数のスクリーン・ネットワーク図のいずれか・控えめに)
- スタンダードより「重厚」「上位プラン」感

## ChatGPT images 2.0 に投げるプロンプト(コピペ用)

```
A horizontal 4:3 banner image (1024x768px) for a Japanese B2B SaaS landing page called "ByakuyaAI".

Design language must match a sister banner I already have: cream/ivory background (#FAF6EE), warm orange accent (#E67E22), strong black typography (#1A1A1A). The style is clean, premium, minimalist B2B Japanese design — think modern fintech/SaaS landing pages, not playful illustrations.

Main copy (large, centered, Japanese):
「月30万円で、WEBマーケティングチームを雇う。」

Sub copy (smaller, below):
「動画制作 × SNS運用 × LINE自動応答 × HPサポート」

Place a small "PREMIUM" badge in the top-left corner in solid black with white text, premium feel.

Background should subtly suggest a "team" or "marketing department" — for example, abstract silhouettes of 3-4 professionals at desks, or stylized icons of (camera, smartphone, chat bubble, analytics chart) arranged in a clean grid, very subtle and never overpowering the text.

No stock-photo people faces. No childish illustrations. No emojis. No watermarks. No English text other than the PREMIUM badge.

The overall feel should signal "this is the higher-tier plan" while staying visually coherent with a paired standard-tier banner.
```

## 生成後の確認チェックリスト

- [ ] 縦横比が 4:3 (1024×768) になっているか
- [ ] メインコピーが「月30万円で、WEBマーケティングチームを雇う。」になっているか(誤字・文字化けなし)
- [ ] スタンダードバナーと並べた時に統一感があるか
- [ ] PREMIUM バッジが読めるか
- [ ] サブコピーが読めるか
- [ ] 「人の顔」が不自然に生成されていないか

## カルーセル動作確認

配置後、ブラウザで `npm run dev` → http://localhost:3000 で:
1. スタンダード/プレミアムが 5秒で自動切替
2. 左右矢印で手動切替できる
3. 下のドット2つで直接ジャンプできる
4. マウスホバー中は自動切替が止まる
