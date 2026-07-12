// Compliance footer for /f pages — 宅建業法32条(誇大広告等の禁止)・景表法対応。
// See docs/property_db_f_design.md §7.4 and feedback_sugita_compliance.md.
// Rendered once per page (client-level fields), not per property.
export function ComplianceFooter({
  licenseNumber,
  transactionType,
}: {
  licenseNumber?: string;
  transactionType?: string;
}) {
  return (
    <footer className="border-t border-white/10 bg-neutral-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-3 text-[11px] leading-relaxed text-white/40">
        {(licenseNumber || transactionType) && (
          <p>
            {licenseNumber && <>宅地建物取引業免許番号: {licenseNumber}　</>}
            {transactionType && <>取引態様: {transactionType}</>}
          </p>
        )}
        <p>
          本ページの掲載情報は動画生成時点(最大2週間以内)のものです。成約・条件変更等により現況と異なる場合があります。最新の空室状況・詳細条件は担当者までお問い合わせください。
        </p>
        <p>
          バーチャルステージングを使用している物件の家具・小物はイメージであり、現況には含まれません。
        </p>
      </div>
    </footer>
  );
}
