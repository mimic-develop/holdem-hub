import type { ReactNode } from 'react';

interface PokerTableProps {
  children?: ReactNode;
}

/**
 * Oval felt-green table shell. Children render on top of the felt.
 *
 * GTO Wizard / Poker Now 스타일: 어두운 슬레이트 베젤 + 입체감 있는 펠트 +
 * 중앙 spotlight 그라디언트 + 워터마크.
 */
export function PokerTable({ children }: PokerTableProps) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Outer bezel — modern slate ring instead of wood brown */}
      <div
        className="relative w-full overflow-hidden rounded-[42%/22%]"
        style={{
          aspectRatio: '3 / 4',
          padding: '10px',
          background:
            'linear-gradient(180deg, #1f2937 0%, #0f172a 60%, #020617 100%)',
          boxShadow:
            '0 18px 40px -12px rgba(0,0,0,0.55), 0 4px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Felt — radial spotlight + outer darker ring */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[40%/20%]"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 42%, #14955a 0%, #0d8046 35%, #0a6b3a 65%, #064a29 100%)',
            boxShadow:
              'inset 0 0 36px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.06), inset 0 -8px 18px rgba(0,0,0,0.35)',
          }}
        >
          {/* Inner felt rail — subtle highlight ring */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-2 rounded-[40%/20%]"
            style={{
              boxShadow:
                'inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 24px rgba(0,0,0,0.25)',
            }}
          />

          {/* Center watermark — only visible when no board cards */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="select-none text-[88px] leading-none text-white/[0.04] font-black tracking-tighter">
              ♠
            </span>
          </div>

          {/* Content layer */}
          <div className="absolute inset-0 flex flex-col items-stretch justify-between p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
