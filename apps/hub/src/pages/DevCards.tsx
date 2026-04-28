import { useState } from "react";
import { PlayingCard, type PlayingCardSize } from "@hh/ui";
import type { Rank, Suit } from "@hh/poker-engine";

const SIZES: PlayingCardSize[] = ["xs", "sm", "md", "lg"];
const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
];
const SUITS: Suit[] = ["s", "h", "d", "c"];

/**
 * `/dev/cards` — 개발자용 카드 카탈로그.
 * Step 2 체크포인트 검증용. 모든 사이즈/모드/상태가 정상 렌더링되는지 시각 확인.
 */
export function DevCards() {
  const [animate, setAnimate] = useState(false);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">PlayingCard 데모</h1>
        <p className="mt-1 text-sm text-zinc-400">
          @hh/ui PlayingCard 모든 사이즈/상태 시각 검증.
        </p>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={animate}
            onChange={(e) => setAnimate(e.target.checked)}
          />
          framer-motion 애니메이션 토글 (재마운트 트리거)
        </label>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">사이즈 비교</h2>
        <div className="flex flex-wrap items-end gap-4">
          {SIZES.map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <PlayingCard
                key={`${s}-${animate}`}
                card="As"
                size={s}
                animate={animate}
              />
              <span className="text-xs text-zinc-500">{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">모든 슈트 (md 사이즈)</h2>
        <div className="flex flex-wrap gap-2">
          {SUITS.map((suit) => (
            <PlayingCard
              key={suit}
              card={{ rank: "K", suit }}
              size="md"
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">전 랭크 (sm 사이즈, 객체 입력)</h2>
        <div className="flex flex-wrap gap-1">
          {RANKS.map((rank) => (
            <PlayingCard
              key={rank}
              card={{ rank, suit: "h" }}
              size="sm"
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">상태 — highlight / dimmed / faceDown</h2>
        <div className="flex flex-wrap gap-3">
          <PlayingCard card="As" size="md" />
          <PlayingCard card="As" size="md" highlight />
          <PlayingCard card="As" size="md" dimmed />
          <PlayingCard card="As" size="md" faceDown />
          <PlayingCard card="As" size="md" faceDown highlight />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">문자열 입력 다양성</h2>
        <p className="mb-2 text-sm text-zinc-500">
          "As", "Th", "2c" 같은 짧은 표기 모두 동일하게 렌더링됨.
        </p>
        <div className="flex flex-wrap gap-2">
          {["As", "Kh", "Qd", "Jc", "Th", "9s", "2c"].map((s) => (
            <PlayingCard key={s} card={s} size="md" />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">잘못된 입력 (에러 폴백)</h2>
        <div className="flex flex-wrap gap-2">
          <PlayingCard card="Zx" size="md" />
          <PlayingCard card="" size="md" />
        </div>
      </section>
    </div>
  );
}
