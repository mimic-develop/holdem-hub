/**
 * 딜러 버튼 — 흰 puck "D" 표시.
 */
export function DealerButton() {
  return (
    <div
      aria-label="Dealer button"
      className="flex h-6 w-6 items-center justify-center rounded-full"
      style={{
        background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #d1d5db 70%, #6b7280 100%)',
        boxShadow:
          '0 0 0 1px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <span className="text-[10px] font-black text-neutral-700">D</span>
    </div>
  );
}
