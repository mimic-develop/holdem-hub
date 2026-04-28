import type { ReactNode } from 'react';

interface PokerTableProps {
  children?: ReactNode;
}

/**
 * Oval felt-green table shell. Children render on top of the felt.
 */
export function PokerTable({ children }: PokerTableProps) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className="relative w-full overflow-hidden rounded-[40%/20%] bg-felt-green shadow-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, #0d8046 0%, #0a6b3a 50%, #074a29 100%)',
          aspectRatio: '3 / 4',
          border: '6px solid #3a2512',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div className="absolute inset-0 flex flex-col items-stretch justify-between p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
