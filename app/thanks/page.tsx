import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "送信完了 | ByakuyaAI",
  description: "お問い合わせありがとうございます。ByakuyaAIより1〜2営業日以内にご連絡いたします。",
  robots: { index: false, follow: false },
};

export default function ThanksPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--brand-cream)] via-white to-[var(--brand-cream-2)] px-6 py-16 text-center">
      <Image
        src="/logo.png"
        alt="ByakuyaAI"
        width={140}
        height={42}
        className="h-9 w-auto"
      />

      <div className="mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-orange)]/10">
        <svg
          className="h-8 w-8 text-[var(--brand-orange)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-black tracking-tight text-[var(--brand-ink)] sm:text-3xl">
        送信が完了しました
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--brand-gray)] sm:text-base">
        お問い合わせいただきありがとうございます。
        <br />
        内容を確認のうえ、通常1〜2営業日以内に
        ご入力いただいたメールアドレス宛にご連絡いたします。
      </p>

      <Link
        href="/"
        className="mt-10 inline-flex items-center justify-center rounded-full bg-[var(--brand-orange)] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-200 transition hover:translate-y-[-1px] hover:bg-[var(--brand-orange-dark)] hover:shadow-xl"
      >
        トップページに戻る
      </Link>
    </main>
  );
}
