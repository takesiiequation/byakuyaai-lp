import type { CustomerAddress, TradeType } from '../_data/types';

interface ComplianceFooterProps {
  company: string;
  tradeType: TradeType;
  licenseNo: string;
  address?: CustomerAddress;
  className?: string;
}

function formatAddress(address?: CustomerAddress): string | null {
  if (!address) return null;
  const parts = [address.prefecture, address.city, address.streetAddress].filter(Boolean);
  if (parts.length === 0) return null;
  const body = parts.join('');
  return address.postalCode ? `〒${address.postalCode} ${body}` : body;
}

export default function ComplianceFooter({ company, tradeType, licenseNo, address, className }: ComplianceFooterProps) {
  const addressText = formatAddress(address);

  return (
    <footer
      className={`w-full border-t border-[var(--border-1)] bg-[var(--surface)] px-3 py-4 pb-16 text-xs text-[var(--text-2)] sm:px-6 sm:pb-6${className ? ` ${className}` : ''}`}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="font-bold text-[var(--text-1)]">
            {company}
            <span className="ml-2 rounded-full border border-[var(--border-1)] px-2 py-0.5 text-[0.65rem] font-normal text-[var(--text-2)]">
              取引形態：{tradeType}
            </span>
          </p>
          <p>免許番号：{licenseNo}</p>
          {addressText && <p>{addressText}</p>}
        </div>

        {/* v4パッケージ本体には無かった2文 — 現行実装(コンプラフッター)の
            必須要件として移植・保持(design doc §7.4 / feedback_sugita_compliance:
            2週間免責+ステージング家具の一般注記)。 */}
        <div className="space-y-2 border-t border-[var(--border-2)] pt-3 leading-relaxed">
          <p>
            本ページの掲載情報は動画生成時点(最大2週間以内)のものです。成約・条件変更等により現況と異なる場合があります。最新の空室状況・詳細条件は担当者までお問い合わせください。
          </p>
          <p>
            バーチャルステージングを使用している物件の家具・小物はイメージであり、現況には含まれません。
          </p>
        </div>
      </div>
    </footer>
  );
}
