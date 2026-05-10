import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Info } from "lucide-react";
import type { Difficulty } from "../lib/quizData";
import type { Concept } from "../lib/concepts";

// ──────────────────────────────────────────────
// Design Tokens
// ──────────────────────────────────────────────
export const PIQ = {
  red: "#BA0C19",
  dark: "#1a1a2e",
  border: "rgba(0,0,0,0.06)",
  text55: "rgba(0,0,0,0.55)",
  text35: "rgba(0,0,0,0.35)",
  bg: "#ffffff",
  bgSoft: "#fafafa",
  radius: 12,
  radiusLg: 14,
} as const;

// ──────────────────────────────────────────────
// Suit Meta (mirrors home.tsx exactly)
// ──────────────────────────────────────────────
export const SUIT_META: Record<
  Difficulty,
  { sym: string; color: string; bg: string; label: string; diffLabel: string }
> = {
  club:    { sym: "♣︎", color: "#16a34a", bg: "#f0fdf4", label: "클럽",       diffLabel: "쉬움" },
  diamond: { sym: "♦︎", color: "#2563eb", bg: "#eff6ff", label: "다이아몬드", diffLabel: "보통" },
  heart:   { sym: "♥︎", color: "#dc2626", bg: "#fef2f2", label: "하트",       diffLabel: "어려움" },
  spade:   { sym: "♠︎", color: "#4b5563", bg: "#f3f4f6", label: "스페이드",   diffLabel: "매우 어려움" },
};

// ──────────────────────────────────────────────
// PokerIQStatusBar
// Matches home.tsx progress strip: 32px, suit sym + label + thin bar + counter
// ──────────────────────────────────────────────
interface PokerIQStatusBarProps {
  difficulty: Difficulty;
  categoryLabel: string;
  progressPct: number;
  counterLabel: string;
}

export function PokerIQStatusBar({
  difficulty,
  categoryLabel,
  progressPct,
  counterLabel,
}: PokerIQStatusBarProps) {
  const sm = SUIT_META[difficulty];
  return (
    <div
      style={{
        height: 32,
        background: PIQ.bg,
        borderBottom: `1px solid ${PIQ.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        paddingLeft: 16,
        paddingRight: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, width: 96 }}>
        <span style={{ color: sm.color, fontSize: 12 }}>{sm.sym}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: PIQ.dark,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {categoryLabel}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          height: 3,
          borderRadius: 999,
          overflow: "hidden",
          background: PIQ.border,
        }}
      >
        <motion.div
          style={{ height: "100%", borderRadius: 999, background: PIQ.red }}
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: PIQ.text35,
          flexShrink: 0,
        }}
      >
        {counterLabel}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────
// PokerIQDifficultyPill
// ──────────────────────────────────────────────
interface PokerIQDifficultyPillProps {
  difficulty: Difficulty;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function PokerIQDifficultyPill({
  difficulty,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: PokerIQDifficultyPillProps) {
  const sm = SUIT_META[difficulty];
  return (
    <span
      data-testid={testId}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: sm.bg,
        color: sm.color,
        border: `1.5px solid ${sm.color}30`,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{sm.sym}</span>
      {sm.label}
      <span style={{ opacity: 0.6 }}>·</span>
      <span style={{ opacity: 0.8 }}>{sm.diffLabel}</span>
    </span>
  );
}

// ──────────────────────────────────────────────
// PokerIQConceptCard
// Accordion card - white bg, thin border, subtle shadow
// ──────────────────────────────────────────────
interface PokerIQConceptCardProps {
  concept: Concept;
  isOpen: boolean;
  onToggle: () => void;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PokerIQConceptCard({ concept, isOpen, onToggle }: PokerIQConceptCardProps) {
  const sentences = splitSentences(concept.description);

  return (
    <div
      style={{
        background: PIQ.bg,
        border: `1px solid ${PIQ.border}`,
        borderRadius: PIQ.radius,
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Header button */}
      <button
        data-testid={`concept-toggle-${concept.id}`}
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "rgba(186,12,25,0.09)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Info style={{ width: 15, height: 15, color: PIQ.red }} />
          </div>
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.025em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.3,
            }}
          >
            {concept.title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp style={{ width: 17, height: 17, color: PIQ.text55, flexShrink: 0 }} />
        ) : (
          <ChevronDown style={{ width: 17, height: 17, color: PIQ.text55, flexShrink: 0 }} />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "20px 24px 24px",
                borderTop: `1px solid ${PIQ.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {sentences.map((sentence, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: i === 0 ? 15 : 16,
                    fontWeight: i === 0 ? 700 : 500,
                    color: i === 0 ? "#1f2937" : "#374151",
                    lineHeight: i === 0 ? 1.6 : 1.75,
                    letterSpacing: i === 0 ? "-0.01em" : "-0.015em",
                    margin: 0,
                  }}
                >
                  {sentence}
                </p>
              ))}

              {/* Example block */}
              {concept.example && (
                <div
                  style={{
                    background: "#FFF1F2",
                    borderLeft: `3px solid ${PIQ.red}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#374151",
                    lineHeight: 1.7,
                    letterSpacing: "-0.01em",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: PIQ.red,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    예시
                  </span>
                  {concept.example}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────
// PokerIQHeroCard
// Category hero card for quiz intro
// ──────────────────────────────────────────────
interface PokerIQHeroCardProps {
  categoryLabel: string;
  description: string;
  difficulty: Difficulty | null;
  sectionLabel?: string;
  questionCount: number;
  icon: React.ElementType;
  children?: React.ReactNode;
}

export function PokerIQHeroCard({
  categoryLabel,
  description,
  difficulty,
  sectionLabel,
  questionCount,
  icon: Icon,
  children,
}: PokerIQHeroCardProps) {
  return (
    <div
      style={{
        background: PIQ.bg,
        border: `1px solid ${PIQ.border}`,
        borderRadius: PIQ.radiusLg,
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(186,12,25,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 20, height: 20, color: PIQ.red }} />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: PIQ.dark, margin: 0 }}>
            {categoryLabel}
          </h1>
          <p style={{ fontSize: 12, color: PIQ.text35, margin: 0 }}>총 {questionCount}개 문제</p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: PIQ.text55, lineHeight: 1.65, margin: "0 0 12px" }}>
        {description}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {difficulty && <PokerIQDifficultyPill difficulty={difficulty} />}
        {sectionLabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: PIQ.text35,
              padding: "3px 8px",
              borderRadius: 999,
              background: PIQ.bgSoft,
              border: `1px solid ${PIQ.border}`,
              letterSpacing: "0.04em",
              textTransform: "uppercase" as const,
            }}
          >
            {sectionLabel}
          </span>
        )}
      </div>

      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────
// PokerIQCTAButton
// Full-width CTA button
// ──────────────────────────────────────────────
interface PokerIQCTAButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
  children: React.ReactNode;
  "data-testid"?: string;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}

export function PokerIQCTAButton({
  onClick,
  disabled,
  variant = "primary",
  children,
  "data-testid": testId,
  type = "button",
  style: extraStyle,
}: PokerIQCTAButtonProps) {
  const [pressed, setPressed] = useState(false);

  const base: React.CSSProperties = {
    width: "100%",
    padding: "16px 16px",
    borderRadius: PIQ.radius,
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: "-0.01em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform 0.1s ease, opacity 0.1s ease",
    transform: pressed && !disabled ? "scale(0.97)" : "scale(1)",
    border: "none",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
  };

  const variantStyle: React.CSSProperties =
    disabled
      ? { background: PIQ.bgSoft, color: PIQ.text35, border: `1px solid ${PIQ.border}`, boxShadow: "none" }
      : variant === "primary"
      ? { background: PIQ.red, color: "#ffffff", boxShadow: "0 2px 12px rgba(186,12,25,0.25)" }
      : variant === "outline"
      ? { background: "transparent", color: PIQ.dark, border: `1.5px solid ${PIQ.border}` }
      : { background: "transparent", color: PIQ.text55, border: `1px solid ${PIQ.border}` };

  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...base, ...variantStyle, ...extraStyle }}
    >
      {children}
    </button>
  );
}
