/**
 * 카드 뒷면 기본 SVG 패턴.
 *
 * Nut-to-3 같은 앱은 자체 이미지 (mimic-card-back.jpg)를
 * `backImage` prop으로 전달한다. 그 외에는 이 SVG가 사용된다.
 *
 * 의존성 없이 어디서든 동작하며 Tailwind 클래스로 색상 조절 가능.
 */
export function CardBackPattern() {
  return (
    <svg
      viewBox="0 0 60 84"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <pattern
          id="hh-card-back-diamond"
          x="0"
          y="0"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M4 0 L8 4 L4 8 L0 4 Z"
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="60" height="84" rx="4" ry="4" fill="#1a4480" />
      <rect x="0" y="0" width="60" height="84" fill="url(#hh-card-back-diamond)" />
      <rect
        x="3"
        y="3"
        width="54"
        height="78"
        rx="3"
        ry="3"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.7"
      />
      <text
        x="30"
        y="48"
        textAnchor="middle"
        fontFamily="Pretendard, system-ui, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="#e5343a"
      >
        MIMIC
      </text>
    </svg>
  );
}
