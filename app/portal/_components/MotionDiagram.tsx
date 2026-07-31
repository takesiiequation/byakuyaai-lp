// カメラ移動の図解(2026-07-31追加)。実演動画が「できあがる映像」を見せるのに対し、
// この図は「どこに立ってどう構えるか」を見せる。撮る前に見るもの=図、仕上がり確認=動画、
// という役割分担で撮影ガイドに並置する。
//
// 画像生成AIではなくSVGで描いている理由: ①日本語が崩れない ②小さく表示しても潰れない
// ③後から数値ひとつで直せる ④追加費用ゼロ。
//
// 表示サイズが小さい(カード内で最大200px幅)ため、文字は最小限にして
// 「扇形=カメラの視野の向き」「①②=撮る順番」「矢印=動き」の3要素だけで伝える。
// 詳しい説明は各カードのキャプション(guide/page.tsx側)が担う。

export type MotionKind = "pushin" | "slide" | "pan" | "arc" | "tilt";

const ORANGE = "var(--brand-orange)";
const ORANGE_DARK = "var(--brand-orange-dark)";

/** カメラ1台分(視野の扇形+本体の丸+番号)。angle は度数・0=上向き、時計回り。 */
function Cam({
  x,
  y,
  angle,
  n,
  dark,
}: {
  x: number;
  y: number;
  angle: number;
  n: string;
  dark?: boolean;
}) {
  const color = dark ? ORANGE_DARK : ORANGE;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      {/* 視野の扇形(上向きに描き、gのrotateで向きを与える) */}
      <path
        d="M0 0 L-30 -56 A64 64 0 0 1 30 -56 Z"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="2"
      />
      <circle r="13" fill={color} />
      {/* 番号だけは回転を打ち消して常に正立させる */}
      <text
        transform={`rotate(${-angle})`}
        y="6"
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill="#fff"
      >
        {n}
      </text>
    </g>
  );
}

/** 視野の扇だけ(同じ地点に2台置く図で、本体の丸が重ならないようにするため分離) */
function FanOnly({
  x,
  y,
  angle,
  dark,
}: {
  x: number;
  y: number;
  angle: number;
  dark?: boolean;
}) {
  const color = dark ? ORANGE_DARK : ORANGE;
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${angle})`}
      d="M0 0 L-30 -56 A64 64 0 0 1 30 -56 Z"
      fill={color}
      fillOpacity="0.18"
      stroke={color}
      strokeWidth="2"
    />
  );
}

/** カメラ本体の丸(番号なし)。同じ地点に2台ある図で1つだけ描く */
function Body({ x, y, dark }: { x: number; y: number; dark?: boolean }) {
  return <circle cx={x} cy={y} r="13" fill={dark ? ORANGE_DARK : ORANGE} />;
}

/** 扇の先に置く番号バッジ */
function Num({
  x,
  y,
  n,
  dark,
}: {
  x: number;
  y: number;
  n: string;
  dark?: boolean;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="13" fill={dark ? ORANGE_DARK : ORANGE} />
      <text
        x={x}
        y={y + 6}
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill="#fff"
      >
        {n}
      </text>
    </g>
  );
}

export default function MotionDiagram({ kind }: { kind: MotionKind }) {
  const common = {
    viewBox: "0 0 320 196",
    className: "mx-auto block w-full max-w-[200px]",
    role: "img",
  } as const;

  const arrow = (
    <defs>
      <marker
        id={`mk-${kind}`}
        markerUnits="userSpaceOnUse"
        markerWidth="18"
        markerHeight="18"
        refX="15"
        refY="9"
        orient="auto"
      >
        <path d="M0 1 L17 9 L0 17 z" fill={ORANGE_DARK} />
      </marker>
    </defs>
  );
  const room = (
    <rect
      x="14"
      y="14"
      width="292"
      height="168"
      rx="8"
      fill="var(--brand-cream)"
      stroke="var(--brand-border)"
      strokeWidth="2"
    />
  );

  if (kind === "pushin") {
    return (
      <svg {...common} aria-label="前へ進む撮り方の図">
        {arrow}
        {room}
        <Cam x={196} y={158} angle={0} n="1" />
        <Cam x={196} y={92} angle={0} n="2" dark />
        <path
          d="M104 158 L104 110"
          stroke={ORANGE_DARK}
          strokeWidth="4"
          markerEnd={`url(#mk-${kind})`}
        />
      </svg>
    );
  }
  if (kind === "slide") {
    return (
      <svg {...common} aria-label="真横にスライドする撮り方の図">
        {arrow}
        {room}
        <Cam x={106} y={150} angle={0} n="1" />
        <Cam x={214} y={150} angle={0} n="2" dark />
        <path
          d="M126 150 L180 150"
          stroke={ORANGE_DARK}
          strokeWidth="4"
          markerEnd={`url(#mk-${kind})`}
        />
      </svg>
    );
  }
  if (kind === "pan") {
    return (
      <svg {...common} aria-label="その場で見わたす撮り方の図">
        {arrow}
        {room}
        <FanOnly x={160} y={160} angle={-38} />
        <FanOnly x={160} y={160} angle={38} dark />
        <Body x={160} y={160} dark />
        <Num x={104} y={96} n="1" />
        <Num x={216} y={96} n="2" dark />
        <path
          d="M118 82 A62 62 0 0 1 196 74"
          fill="none"
          stroke={ORANGE_DARK}
          strokeWidth="4"
          strokeDasharray="7 6"
          markerEnd={`url(#mk-${kind})`}
        />
      </svg>
    );
  }
  if (kind === "arc") {
    return (
      <svg {...common} aria-label="回り込む撮り方の図">
        {arrow}
        {room}
        <circle cx="160" cy="74" r="7" fill="#B9AFA1" />
        <Cam x={64} y={158} angle={42} n="1" />
        <Cam x={256} y={158} angle={-42} n="2" dark />
        <path
          d="M78 134 A112 112 0 0 1 184 118"
          fill="none"
          stroke={ORANGE_DARK}
          strokeWidth="4"
          strokeDasharray="8 7"
          markerEnd={`url(#mk-${kind})`}
        />
      </svg>
    );
  }
  // tilt: 横から見た図(建物を見上げる)
  return (
    <svg {...common} aria-label="見上げる撮り方の図">
      {arrow}
      <line
        x1="14"
        y1="176"
        x2="306"
        y2="176"
        stroke="var(--brand-border)"
        strokeWidth="2"
      />
      <rect
        x="198"
        y="30"
        width="96"
        height="146"
        fill="var(--brand-cream)"
        stroke="var(--brand-border)"
        strokeWidth="2"
      />
      <rect x="214" y="48" width="26" height="22" fill="#E0D8CB" />
      <rect x="254" y="48" width="26" height="22" fill="#E0D8CB" />
      <rect x="214" y="92" width="26" height="22" fill="#E0D8CB" />
      <rect x="254" y="92" width="26" height="22" fill="#E0D8CB" />
      <FanOnly x={70} y={148} angle={90} />
      <FanOnly x={70} y={148} angle={44} dark />
      <Body x={70} y={148} dark />
      <Num x={146} y={150} n="1" />
      <Num x={104} y={54} n="2" dark />
      <path
        d="M132 118 A58 58 0 0 0 118 78"
        fill="none"
        stroke={ORANGE_DARK}
        strokeWidth="4"
        strokeDasharray="7 6"
        markerEnd={`url(#mk-${kind})`}
      />
    </svg>
  );
}
