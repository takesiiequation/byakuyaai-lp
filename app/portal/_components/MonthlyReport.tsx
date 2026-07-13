import type { MonthlyReportRow, ReportVideo } from "@/app/_lib/report";
import {
  reportPeriodLabel,
  reportAccountsLabel,
  reportNextActions,
  reportHighlightComment,
  reportIntro,
  reportPrevHpClicks,
  reportPrevLineClicks,
} from "@/app/_lib/report";

// 「今月のレポート」— メール配信中の月次成果レポート(fudosan-video/scripts/
// generate_monthly_report.py が正本のA4レイアウト)をポータルにも素直に落とす。
// プレミアム限定ゲートは呼び出し元(app/portal/page.tsx)で行う — ここは
// reportRow が null なら「まだレポートがありません」を出すだけ(fail-soft)。
// 全フィールド defensive: 欠損は非表示 or "—"(既存ダッシュボード要素を壊さない)。

function fmt(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

type Delta = { dir: "up" | "down"; label: string };

function pctDelta(cur?: number, prev?: number | null): Delta | null {
  if (prev == null || !Number.isFinite(prev) || prev === 0) return null;
  if (cur == null || !Number.isFinite(cur)) return null;
  const d = ((cur - prev) / prev) * 100;
  const dir: Delta["dir"] = d >= 0 ? "up" : "down";
  const sign = d >= 0 ? "+" : "−";
  return { dir, label: `${d >= 0 ? "↑" : "↓"} ${sign}${Math.abs(d).toFixed(0)}%` };
}

function unitDelta(cur?: number, prev?: number | null): Delta | null {
  if (prev == null || !Number.isFinite(prev) || prev <= 0) return null;
  if (cur == null || !Number.isFinite(cur)) return null;
  const d = cur - prev;
  if (d === 0) return null;
  const dir: Delta["dir"] = d > 0 ? "up" : "down";
  return { dir, label: `${d > 0 ? "↑" : "↓"} ${d > 0 ? "+" : ""}${d} 件` };
}

function DeltaBadge({ delta }: { delta: Delta | null | undefined }) {
  if (!delta) return null;
  const cls =
    delta.dir === "up" ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100";
  return (
    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {delta.label}
    </span>
  );
}

function Kpi({
  label,
  value,
  unit,
  delta,
  major,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: Delta | null;
  major?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        major
          ? "border-[var(--brand-orange-light)]/40 bg-[var(--brand-cream-2)]"
          : "border-[var(--brand-border)] bg-white"
      }`}
    >
      <div className="text-[11px] font-semibold text-[var(--brand-gray-light)]">{label}</div>
      <div
        className={`mt-1 text-xl font-black leading-tight ${
          major ? "text-[var(--brand-orange-dark)]" : "text-[var(--brand-ink)]"
        }`}
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-bold text-[var(--brand-gray-light)]">{unit}</span>
        )}
      </div>
      <DeltaBadge delta={delta} />
    </div>
  );
}

function FollowerKpi({ value }: { value?: number }) {
  const has = typeof value === "number" && Number.isFinite(value);
  const up = has && value! >= 0;
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-white p-3 text-center">
      <div className="text-[11px] font-semibold text-[var(--brand-gray-light)]">フォロワー増減</div>
      <div
        className={`mt-1 text-xl font-black leading-tight ${
          has ? (up ? "text-green-700" : "text-red-700") : "text-[var(--brand-ink)]"
        }`}
      >
        {has ? `${up ? "↑+" : "↓"}${fmt(Math.abs(value!))}` : "—"}
        <span className="ml-0.5 text-xs font-bold text-[var(--brand-gray-light)]">人</span>
      </div>
    </div>
  );
}

// 累計再生数の右肩上がり折れ線グラフ(SVG・緑#16a34a)。
// generate_monthly_report.py の build_chart() / JS_HTML の buildChart() と
// 同じ数式(viewBox座標変換)をReact要素として再実装(文字列HTML生成を避け、
// JSXの自動エスケープに任せる)。
function ViewsChart({ videos, totalViews }: { videos: ReportVideo[]; totalViews?: number }) {
  if (!videos.length) return null;
  const pts: { label: string; cum: number }[] = [{ label: "月初", cum: 0 }];
  let cum = 0;
  for (const v of videos) {
    cum += v.views || 0;
    pts.push({ label: v.date || "", cum });
  }
  const W = 700;
  const H = 224;
  const pl = 56;
  const pr = 116;
  const pt = 26;
  const pb = 22;
  const maxV = Math.max(...pts.map((p) => p.cum)) || 1;
  const n = pts.length;
  const X = (i: number) => pl + (i * (W - pl - pr)) / (n - 1);
  const Y = (v: number) => pt + (1 - v / maxV) * (H - pt - pb);

  const linePts = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.cum).toFixed(1)}`).join(" ");
  const areaPts = `${pl},${Y(0).toFixed(1)} ${linePts} ${X(n - 1).toFixed(1)},${Y(0).toFixed(1)}`;
  const fx = X(n - 1);
  const fy = Y(pts[n - 1].cum);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="累計再生数の推移">
      <defs>
        <linearGradient id="reportChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1.0].map((frac) => {
        const gy = Y(maxV * frac);
        return (
          <g key={frac}>
            <line x1={pl} y1={gy} x2={W - pr} y2={gy} stroke="#e5e7eb" strokeWidth={1} />
            <text x={pl - 6} y={gy + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {fmt(Math.round(maxV * frac))}
            </text>
          </g>
        );
      })}
      <polygon points={areaPts} fill="url(#reportChartFill)" />
      <polyline
        points={linePts}
        fill="none"
        stroke="#16a34a"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(p.cum)} r={4} fill="#16a34a" stroke="#fff" strokeWidth={1.5} />
          <text x={X(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fill="#6b7280">
            {p.label}
          </text>
          {i > 0 && i < n - 1 && (
            <text x={X(i)} y={Y(p.cum) - 9} textAnchor="middle" fontSize={8.5} fill="#16a34a" fontWeight={700}>
              {fmt(p.cum)}
            </text>
          )}
        </g>
      ))}
      <text x={fx + 12} y={fy + 2} fontSize={13} fill="#16a34a" fontWeight={900}>
        ↗ {fmt(totalViews ?? pts[n - 1].cum)} 回
      </text>
      <text x={fx + 12} y={fy + 16} fontSize={9} fill="#16a34a" fontWeight={700}>
        今月の累計再生
      </text>
    </svg>
  );
}

const TH_CLS = "border-b border-[var(--brand-border)] px-2 py-1.5 font-semibold text-[var(--brand-gray)]";
const TD_CLS = "border-b border-[var(--brand-border)] px-2 py-1.5 text-right";

function ReportBody({ row }: { row: MonthlyReportRow }) {
  const r = row.report;
  const s = r.summary || {};
  const p = r.prev_summary || undefined;
  const videos = (r.videos || []).slice(0, 10);
  const omitted = (r.videos?.length || 0) - videos.length;
  const bestViews = Math.max(0, ...videos.map((v) => v.views || 0));
  const intro = reportIntro(r);
  const nextActions = reportNextActions(r);
  const highlightComment = reportHighlightComment(r);
  const hasHighlight = !!(r.highlight && (r.highlight.title || r.highlight.views != null));

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div>
        <div className="text-xs text-[var(--brand-gray-light)]">
          {reportPeriodLabel(r, row.year_month)} ｜ 対象アカウント: {reportAccountsLabel(r)}
        </div>
        {intro && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--brand-ink)]">{intro}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="総再生数" value={fmt(s.views)} unit="回" major delta={pctDelta(s.views, p?.views)} />
        <Kpi
          label="リーチ(視聴者数)"
          value={fmt(s.reach)}
          unit="人"
          major
          delta={pctDelta(s.reach, p?.reach)}
        />
        <Kpi
          label="HPへの誘導"
          value={fmt(s.hp_clicks)}
          unit="件"
          major
          delta={unitDelta(s.hp_clicks, reportPrevHpClicks(r))}
        />
        <Kpi
          label="LINEへの誘導"
          value={fmt(s.line_clicks)}
          unit="件"
          major
          delta={unitDelta(s.line_clicks, reportPrevLineClicks(r))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="投稿本数" value={fmt(s.posts)} unit="本" />
        <Kpi label="いいね" value={fmt(s.likes)} unit="件" delta={pctDelta(s.likes, p?.likes)} />
        <Kpi label="保存数" value={fmt(s.saves)} unit="件" delta={pctDelta(s.saves, p?.saves)} />
        <FollowerKpi value={s.follower_delta} />
      </div>

      {videos.length > 0 && (
        <div>
          <h3 className="mb-2 border-l-[3px] border-[var(--brand-orange)] pl-2 text-xs font-bold text-[var(--brand-ink)]">
            再生数の伸び(今月の累計推移)
          </h3>
          <div className="rounded-xl border border-[var(--brand-border)] p-2">
            <ViewsChart videos={videos} totalViews={s.views} />
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <h3 className="mb-2 border-l-[3px] border-[var(--brand-orange)] pl-2 text-xs font-bold text-[var(--brand-ink)]">
            投稿別パフォーマンス
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--brand-border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className={TH_CLS}>投稿日</th>
                  <th className={`${TH_CLS} text-left`}>動画</th>
                  <th className={TH_CLS}>媒体</th>
                  <th className={TH_CLS}>再生数</th>
                  <th className={TH_CLS}>いいね</th>
                  <th className={TH_CLS}>保存</th>
                  <th className={TH_CLS}>コメント</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v, i) => (
                  <tr
                    key={i}
                    className={
                      bestViews > 0 && (v.views || 0) === bestViews
                        ? "bg-[var(--brand-cream-2)] font-semibold"
                        : ""
                    }
                  >
                    <td className={`${TD_CLS} whitespace-nowrap`}>{v.date || "—"}</td>
                    <td className={`${TD_CLS} text-left`}>{v.title || "—"}</td>
                    <td className={`${TD_CLS} whitespace-nowrap`}>{v.platform || "—"}</td>
                    <td className={TD_CLS}>{fmt(v.views)}</td>
                    <td className={TD_CLS}>{fmt(v.likes)}</td>
                    <td className={TD_CLS}>{fmt(v.saves)}</td>
                    <td className={TD_CLS}>{fmt(v.comments)}</td>
                  </tr>
                ))}
                {omitted > 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-1.5 text-center text-[var(--brand-gray-light)]">
                      ほか {omitted} 本
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasHighlight && (
        <div>
          <h3 className="mb-2 border-l-[3px] border-[var(--brand-orange)] pl-2 text-xs font-bold text-[var(--brand-ink)]">
            今月のベスト動画
          </h3>
          <div className="flex gap-3 rounded-xl border border-[var(--brand-orange-light)]/40 bg-[var(--brand-cream-2)] p-3">
            <div className="text-2xl leading-none">🏆</div>
            <div className="min-w-0">
              <div className="break-words text-sm font-bold text-[var(--brand-orange-dark)]">
                {r.highlight?.title || "—"}
              </div>
              <div className="mt-0.5 text-xs text-[var(--brand-gray)]">
                再生 {fmt(r.highlight?.views)} 回 ｜ 保存 {fmt(r.highlight?.saves)} 件
              </div>
              {highlightComment && (
                <div className="mt-1.5 text-xs leading-relaxed text-[var(--brand-ink)]">{highlightComment}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {nextActions.length > 0 && (
        <div>
          <h3 className="mb-2 border-l-[3px] border-[var(--brand-orange)] pl-2 text-xs font-bold text-[var(--brand-ink)]">
            来月の打ち手
          </h3>
          <ul className="space-y-1">
            {nextActions.map((a, i) => (
              <li
                key={i}
                className="flex gap-2 border-b border-dashed border-[var(--brand-border)] py-1.5 text-xs text-[var(--brand-ink)] last:border-0"
              >
                <span className="shrink-0 font-bold text-[var(--brand-orange)]">→</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {typeof r.total_videos === "number" && r.total_videos > 0 && (
        <div className="rounded-lg border-l-[3px] border-blue-400 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
          累計 <strong>{fmt(r.total_videos)}本</strong>
          の物件動画が御社のSNS資産として蓄積されています。動画は投稿後も検索・おすすめ経由で再生され続け、認知を継続的に積み上げます。
        </div>
      )}
    </div>
  );
}

export function MonthlyReportSection({ reportRow }: { reportRow: MonthlyReportRow | null }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="border-b border-gray-50 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold text-[var(--brand-ink)]">今月のレポート</h2>
      </div>
      {!reportRow ? (
        <div className="p-8 text-center text-sm text-[var(--brand-gray-light)]">
          まだレポートがありません(毎月1日に更新されます)
        </div>
      ) : (
        <ReportBody row={reportRow} />
      )}
    </div>
  );
}
