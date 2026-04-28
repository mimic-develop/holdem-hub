import { useState, useMemo, useCallback, useEffect, useRef, useContext, createContext, forwardRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Info } from "lucide-react";
import { parseGlossaryText, type GlossaryEntry } from "../lib/glossary";

const GlossaryTrackerContext = createContext<React.MutableRefObject<Set<string>> | null>(null);

export function GlossaryTrackerProvider({ children }: { children: React.ReactNode }) {
  const seenRef = useRef(new Set<string>());

  return (
    <GlossaryTrackerContext.Provider value={seenRef}>
      {children}
    </GlossaryTrackerContext.Provider>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  "수학": "bg-blue-100 text-blue-700",
  "전략": "bg-purple-100 text-purple-700",
  "베팅": "bg-orange-100 text-orange-700",
  "핸드·드로우": "bg-emerald-100 text-emerald-700",
  "포지션": "bg-amber-100 text-amber-700",
};

interface GlossaryTextProps {
  text: string;
  className?: string;
  as?: "p" | "span";
}

export const GlossaryText = forwardRef<HTMLElement, GlossaryTextProps>(
  function GlossaryTextInner({ text, className = "", as: Tag = "p" }, ref) {
    const [activeEntry, setActiveEntry] = useState<GlossaryEntry | null>(null);
    const trackerRef = useContext(GlossaryTrackerContext);

    const filteredSegments = useMemo(() => {
      const segments = parseGlossaryText(text);
      if (!trackerRef) return segments;
      return segments.map((seg) => {
        if (!seg.entry) return seg;
        const seen = trackerRef.current;
        if (seen.has(seg.entry.term)) {
          return { text: seg.text };
        }
        seen.add(seg.entry.term);
        return seg;
      });
    }, [text]);

    const handleTap = useCallback((entry: GlossaryEntry) => {
      setActiveEntry(entry);
    }, []);

    const hasTerms = filteredSegments.some((s) => s.entry);

    const content = hasTerms
      ? filteredSegments.map((seg, i) =>
          seg.entry ? (
            <span
              key={i}
              role="button"
              tabIndex={0}
              data-testid={`glossary-term-${seg.entry.term}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleTap(seg.entry!);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTap(seg.entry!);
                }
              }}
              className="inline underline decoration-dotted decoration-primary/40 underline-offset-2 text-primary/80 cursor-pointer hover:text-primary active:text-primary transition-colors"
              aria-label={`용어 설명 보기: ${seg.entry.term}`}
            >
              {seg.text}
              <Info className="w-3 h-3 inline-block opacity-50 align-text-top ml-0.5" />
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )
      : text;

    return (
      <>
        {Tag === "span" ? (
          <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>{content}</span>
        ) : (
          <p ref={ref as React.Ref<HTMLParagraphElement>} className={className}>{content}</p>
        )}

        {createPortal(
          <AnimatePresence>
            {activeEntry && (
              <GlossaryTooltip
                entry={activeEntry}
                onClose={() => setActiveEntry(null)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
      </>
    );
  }
);

function GlossaryTooltip({
  entry,
  onClose,
}: {
  entry: GlossaryEntry;
  onClose: () => void;
}) {
  const categoryColor = CATEGORY_COLORS[entry.category] ?? "bg-muted text-muted-foreground";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-black/20 z-[9998]"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Escape") onClose(); }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: "spring", damping: 28, stiffness: 350 }}
        className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-[env(safe-area-inset-bottom,16px)]"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`용어 설명: ${entry.term}`}
      >
        <div className="max-w-lg mx-auto bg-card border border-border rounded-t-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <div>
                <span className="font-bold text-foreground text-[15px]">
                  {entry.term}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {entry.english}
                </span>
              </div>
            </div>
            <button
              data-testid="button-glossary-close"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center active:bg-muted/50 transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-4 pb-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColor}`}>
              {entry.category}
            </span>
          </div>

          <div className="w-8 h-0.5 bg-border rounded-full mx-auto my-2" />

          <div className="px-4 pb-4 space-y-2.5">
            <p className="text-sm text-foreground leading-relaxed">
              {entry.definition}
            </p>
            {entry.example && (
              <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
                <span className="text-xs text-muted-foreground font-semibold mt-0.5 shrink-0">
                  예시
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {entry.example}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
