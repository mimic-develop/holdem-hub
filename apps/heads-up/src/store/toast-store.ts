import { create } from 'zustand';
import type { Milestone } from '../storage/stats';

export interface ActiveToast {
  id: string;
  milestone: Milestone;
  /** Wall-clock time when this toast should auto-dismiss. */
  expiresAt: number;
}

interface ToastStoreState {
  toasts: ActiveToast[];
  /** Track which milestone IDs have ever been shown — never re-fire one. */
  shownIds: Set<string>;
  push: (milestones: Milestone[]) => void;
  dismiss: (id: string) => void;
  reset: () => void;
}

const TOAST_DURATION_MS = 4500;

let counter = 0;

function genId(): string {
  counter += 1;
  return `t-${Date.now().toString(36)}-${counter}`;
}

/**
 * Queue of milestone toasts. We dedupe by milestone.id (one-shot per session).
 * The MilestoneToast component renders the queue and auto-dismisses after
 * TOAST_DURATION_MS.
 *
 * Persisted-shown milestones (across sessions) live in localStorage; we load
 * them lazily on first push to avoid touching window during SSR/tests.
 */
export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  shownIds: new Set(),
  push: (milestones) => {
    const persisted = loadShownIds();
    const cur = get();
    const merged = new Set([...cur.shownIds, ...persisted]);
    const newToasts: ActiveToast[] = [];
    for (const m of milestones) {
      if (merged.has(m.id)) continue;
      merged.add(m.id);
      newToasts.push({
        id: genId(),
        milestone: m,
        expiresAt: Date.now() + TOAST_DURATION_MS,
      });
    }
    if (newToasts.length === 0) {
      set({ shownIds: merged });
      return;
    }
    persistShownIds(merged);
    set({
      toasts: [...cur.toasts, ...newToasts],
      shownIds: merged,
    });
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  reset: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    set({ toasts: [], shownIds: new Set() });
  },
}));

// 모노레포 통합 시 prefix는 `heads-up:` (이미 콜론 prefix 있던 키 그대로 보존, app prefix만 추가).
const STORAGE_KEY = 'heads-up:headsup-solo:milestones-shown';

function loadShownIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function persistShownIds(ids: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage may be unavailable (private mode, quota); ignore
  }
}
