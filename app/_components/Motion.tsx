"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ElementType,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  type Variants,
} from "framer-motion";

/* ------------------------------------------------------------------ */
/* 共通モーショントークン（単一の情報源 / 値の直書き禁止）             */
/* ------------------------------------------------------------------ */

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DUR_REVEAL = 0.6;
const STAGGER_STEP = 0.08;
const DELAY_CHILDREN = 0.1;
const DUR_COUNTUP = 1600;
const DUR_FLOAT = 6;
const FLOAT_AMPLITUDE = 8;
const VIEWPORT = { once: true, amount: 0.3 };

const TILT_MAX = 8;
const TILT_PERSPECTIVE = 900;
const TILT_SPRING = { stiffness: 150, damping: 18, mass: 0.4 };

/* ------------------------------------------------------------------ */
/* motion(as) 生成ヘルパ（生成コスト回避のためキャッシュ）            */
/* ------------------------------------------------------------------ */

type AnyMotionComponent = ComponentType<any>;

const motionCache = new Map<ElementType, AnyMotionComponent>();

function createMotion(as: ElementType): AnyMotionComponent {
  const cached = motionCache.get(as);
  if (cached) return cached;

  const factory = motion as unknown as {
    create?: (component: ElementType) => AnyMotionComponent;
  } & ((component: ElementType) => AnyMotionComponent);

  let component: AnyMotionComponent | undefined;
  if (typeof as === "string") {
    // motion.div / motion.section 等の既製コンポーネントを優先利用
    component = (motion as unknown as Record<string, AnyMotionComponent>)[as];
  }
  if (!component) {
    component =
      typeof factory.create === "function" ? factory.create(as) : factory(as);
  }

  motionCache.set(as, component);
  return component;
}

function useMotionComponent(as: ElementType | undefined): AnyMotionComponent {
  return useMemo(() => createMotion(as ?? "div"), [as]);
}

/* ------------------------------------------------------------------ */
/* 1. Reveal — スクロールでフェードアップ                             */
/* ------------------------------------------------------------------ */

type RevealProps<T extends ElementType = "div"> = {
  children: ReactNode;
  /** 発火からの遅延（秒）。default 0 */
  delay?: number;
  /** 開始オフセット（px, 下から）。default 24 */
  y?: number;
  className?: string;
  /** レンダリング要素。default 'div' */
  as?: T;
  /** ファーストビュー用: trueで初期から表示状態にしviewport監視を省く。default false */
  immediate?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "children" | "className">;

export function Reveal<T extends ElementType = "div">({
  children,
  delay = 0,
  y = 24,
  className,
  as,
  immediate = false,
  ...rest
}: RevealProps<T>) {
  const reducedMotion = useReducedMotion();
  const Component = useMotionComponent(as);
  const isStatic = reducedMotion || immediate;

  if (isStatic) {
    // initial を最終状態で固定し whileInView / transition を渡さない（静的表示）
    return (
      <Component className={className} initial={{ opacity: 1, y: 0 }} {...rest}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DUR_REVEAL, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </Component>
  );
}

/* ------------------------------------------------------------------ */
/* 2. RevealStagger + RevealItem — 子要素の逐次表示                    */
/* ------------------------------------------------------------------ */

type RevealStaggerProps<T extends ElementType = "div"> = {
  children: ReactNode;
  /** 子1つあたりの遅延（秒）。default STAGGER_STEP */
  staggerDelay?: number;
  /** 最初の子までの遅延（秒）。default DELAY_CHILDREN */
  delayChildren?: number;
  className?: string;
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "children" | "className">;

export function RevealStagger<T extends ElementType = "div">({
  children,
  staggerDelay = STAGGER_STEP,
  delayChildren = DELAY_CHILDREN,
  className,
  as,
  ...rest
}: RevealStaggerProps<T>) {
  const reducedMotion = useReducedMotion();
  const Component = useMotionComponent(as);

  if (reducedMotion) {
    return (
      <Component className={className} {...rest}>
        {children}
      </Component>
    );
  }

  const variants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: staggerDelay, delayChildren },
    },
  };

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      variants={variants}
      {...rest}
    >
      {children}
    </Component>
  );
}

type RevealItemProps<T extends ElementType = "div"> = {
  children: ReactNode;
  /** 開始オフセット（px）。default 24 */
  y?: number;
  className?: string;
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "children" | "className">;

export function RevealItem<T extends ElementType = "div">({
  children,
  y = 24,
  className,
  as,
  ...rest
}: RevealItemProps<T>) {
  const reducedMotion = useReducedMotion();
  const Component = useMotionComponent(as);

  if (reducedMotion) {
    return (
      <Component className={className} {...rest}>
        {children}
      </Component>
    );
  }

  // whileInView は持たず、親 RevealStagger の orchestration に従う
  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR_REVEAL, ease: EASE_OUT },
    },
  };

  return (
    <Component className={className} variants={variants} {...rest}>
      {children}
    </Component>
  );
}

/* ------------------------------------------------------------------ */
/* 3. CountUp — 金額カウントアップ                                    */
/* ------------------------------------------------------------------ */

type CountUpProps = {
  /** 目標値。例 50000 */
  value: number;
  /** 例 '¥'。default '' */
  prefix?: string;
  /** 例 '/月'。default '' */
  suffix?: string;
  className?: string;
  /** アニメ時間（ms）。default DUR_COUNTUP */
  durationMs?: number;
};

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  className,
  durationMs = DUR_COUNTUP,
}: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.5 });

  const finalFormatted = value.toLocaleString("ja-JP");
  const ariaLabel = `${prefix}${finalFormatted}${suffix}`;

  // マウント後に 0 へ戻す（SSR/no-JS では最終値のまま表示 / JS有効時のみリセット）
  useEffect(() => {
    if (reducedMotion) return;
    const node = numberRef.current;
    if (node) node.textContent = "0";
  }, [reducedMotion]);

  // ビューポート進入で 0 → value を durationMs かけて補間（once）
  useEffect(() => {
    if (reducedMotion || !inView) return;
    const node = numberRef.current;
    if (!node) return;

    const controls = animate(0, value, {
      duration: durationMs / 1000,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        node.textContent = Math.round(latest).toLocaleString("ja-JP");
      },
    });

    return () => controls.stop();
  }, [reducedMotion, inView, value, durationMs]);

  return (
    <span
      ref={rootRef}
      className={className}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        display: "inline-block",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* 幅確保用サイザー: 最終値基準・不可視でレイアウトシフトを 0 にする */}
      <span aria-hidden="true" style={{ visibility: "hidden" }}>
        {prefix}
        {finalFormatted}
        {suffix}
      </span>
      {/* 可視レイヤ: カウント中の中間値は SR に読ませない（aria-hidden） */}
      <span
        aria-hidden="true"
        style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}
      >
        {prefix}
        <span ref={numberRef}>{finalFormatted}</span>
        {suffix}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 4. TiltCard — PC限定マウス追従チルト                               */
/* ------------------------------------------------------------------ */

type TiltCardProps = {
  children: ReactNode;
  className?: string;
};

export function TiltCard({ children, className }: TiltCardProps) {
  const reducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  // 有効化判定は必ずマウント後（window参照は effect 内）。初回レンダーは静的。
  useEffect(() => {
    if (reducedMotion) {
      setEnabled(false);
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [reducedMotion]);

  // 初回マウント / タッチ / reduced-motion / hover不可 は完全静的な div
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return <TiltCardActive className={className}>{children}</TiltCardActive>;
}

// motion value / listener はこのアクティブ版が mount された時のみ生成される
function TiltCardActive({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-py * TILT_MAX);
    rotateY.set(px * TILT_MAX);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: TILT_PERSPECTIVE,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. FloatY — 電話モック用の微揺れ（常時ループ / Hero 1箇所のみ）    */
/* ------------------------------------------------------------------ */

type FloatYProps = {
  children: ReactNode;
  className?: string;
};

export function FloatY({ children, className }: FloatYProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -FLOAT_AMPLITUDE, 0] }}
      transition={{ duration: DUR_FLOAT, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}
