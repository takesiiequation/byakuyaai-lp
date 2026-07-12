'use client';

import { motion } from 'framer-motion';
import type { CustomerData } from '../_data/types';

interface HeroLiteProps {
  customer: CustomerData;
  activeCount: number;
}

const GRAIN_URL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export default function HeroLite({ customer, activeCount }: HeroLiteProps) {
  const catchLines = customer.catchCopy.split('\n').filter((line) => line.trim().length > 0);
  const lines = catchLines.length > 0 ? catchLines : [customer.catchCopy];

  return (
    <div className="absolute inset-0 flex flex-col justify-center overflow-hidden bg-[linear-gradient(180deg,#0b0b0f_0%,#141414_100%)]">
      {/* gradient mesh blobs */}
      <div aria-hidden className="hl-blob hl-blob-1" />
      <div aria-hidden className="hl-blob hl-blob-2" />
      <div aria-hidden className="hl-blob hl-blob-3" />

      {/* aurora band */}
      <div aria-hidden className="hl-aurora" />

      {/* grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[.07]"
        style={{ backgroundImage: `url("${GRAIN_URL}")` }}
      />

      {/* horizon line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[18%] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(247,147,30,.9) 35%, rgba(249,168,37,.9) 50%, rgba(247,147,30,.9) 65%, transparent)',
          boxShadow: '0 0 24px 2px rgba(247,147,30,.55)',
        }}
      />

      {/* typography */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 text-center sm:px-8">
        <h1
          className="font-[800] text-[#f5f0e8]"
          style={{
            fontSize: 'clamp(2.25rem, 8vw, 4.5rem)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {lines.map((line, index) => (
            <span key={`${line}-${index}`} className="block overflow-hidden">
              <span
                className="hl-line block [text-wrap:balance]"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
          className="mt-4 text-sm font-medium text-[#f5f0e8]/70 sm:text-base"
        >
          {customer.company}
          <span className="mx-2 text-[#f5f0e8]/30">|</span>
          公開中 {activeCount} 件の物件動画
        </motion.p>
      </div>

      <style>{`
        .hl-blob {
          position: absolute;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          filter: blur(70px);
          will-change: transform;
          background: radial-gradient(
            closest-side,
            color-mix(in oklch, #f7931e 55%, transparent),
            transparent 70%
          );
        }
        .hl-blob-1 {
          top: -10%;
          left: -8%;
          animation: hl-drift-a 24s ease-in-out infinite alternate;
        }
        .hl-blob-2 {
          top: 20%;
          right: -12%;
          width: 420px;
          height: 420px;
          animation: hl-drift-b 31s ease-in-out infinite alternate;
        }
        .hl-blob-3 {
          bottom: -14%;
          left: 30%;
          width: 520px;
          height: 520px;
          animation: hl-drift-c 47s ease-in-out infinite alternate;
        }
        @keyframes hl-drift-a {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { transform: translate(6%, 4%) scale(1.12) rotate(8deg); }
        }
        @keyframes hl-drift-b {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { transform: translate(-5%, 6%) scale(0.92) rotate(-6deg); }
        }
        @keyframes hl-drift-c {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { transform: translate(-4%, -5%) scale(1.08) rotate(5deg); }
        }
        .hl-aurora {
          position: absolute;
          inset: -10% -20%;
          height: 60%;
          background: conic-gradient(
            from 90deg at 50% 50%,
            transparent 0deg,
            rgba(249, 168, 37, 0.18) 90deg,
            rgba(247, 147, 30, 0.28) 180deg,
            rgba(249, 168, 37, 0.18) 270deg,
            transparent 360deg
          );
          -webkit-mask-image: linear-gradient(transparent, black, transparent);
          mask-image: linear-gradient(transparent, black, transparent);
          will-change: transform;
          animation: hl-aurora-sweep 38s ease-in-out infinite alternate;
        }
        @keyframes hl-aurora-sweep {
          0% { transform: translateX(-8%); }
          100% { transform: translateX(8%); }
        }
        .hl-line {
          animation: hl-line-up 0.7s cubic-bezier(0.2, 0.7, 0, 1) backwards;
        }
        @keyframes hl-line-up {
          from {
            transform: translateY(110%);
          }
          to {
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hl-blob,
          .hl-aurora,
          .hl-line {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
