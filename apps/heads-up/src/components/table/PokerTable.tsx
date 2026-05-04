import type { ReactNode } from 'react';
import mimicLogo from '../../assets/mimic-logo.png';

interface PokerTableProps {
  /** 팟 표시 + 커뮤니티 카드 — 펠트 정중앙 */
  children?: ReactNode;
  /** 상대 베팅 칩 — 중앙에서 위쪽 (내 칩과 대칭) */
  oppBet?: ReactNode;
  /** 내 베팅 칩 — 중앙에서 아래쪽 */
  myBet?: ReactNode;
}

export function PokerTable({ children, oppBet, myBet }: PokerTableProps) {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {/* Bezel */}
      <div
        className="relative w-full overflow-hidden rounded-[50%/30%]"
        style={{
          aspectRatio: '16 / 10',
          padding: '10px',
          background:
            'radial-gradient(ellipse at center, #1a1a1a 0%, #0a0a0a 70%, #000 100%)',
          boxShadow:
            '0 22px 50px -16px rgba(0,0,0,0.7), 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Felt */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[50%/30%]"
          style={{
            background:
              'radial-gradient(ellipse 70% 65% at 50% 45%, #9c1a1a 0%, #801212 35%, #6b0a0a 65%, #4a0707 100%)',
            boxShadow:
              'inset 0 0 50px rgba(0,0,0,0.55), inset 0 -10px 24px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* Inner felt rail */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-2 rounded-[50%/30%]"
            style={{
              boxShadow:
                'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 28px rgba(0,0,0,0.25)',
            }}
          />

          {/* MIMIC 로고 워터마크 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
          >
            <img
              src={mimicLogo}
              alt=""
              className="w-[58%] select-none opacity-[0.07]"
              style={{ filter: 'brightness(10)' }}
            />
          </div>

          {/* 상대 베팅 칩 — 중앙 위 (내 칩과 top/bottom 대칭) */}
          {oppBet && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 flex justify-center"
              style={{ top: '14%' }}
            >
              {oppBet}
            </div>
          )}

          {/* 팟 + 커뮤니티 카드 — 펠트 중앙에서 소폭 위 */}
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4 pb-[7%]">
            {children}
          </div>

          {/* 내 베팅 칩 — 중앙 아래 (상대 칩과 top/bottom 대칭) */}
          {myBet && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 flex justify-center"
              style={{ bottom: '14%' }}
            >
              {myBet}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
