import { create } from 'zustand';
import { apiFetch } from '@hh/shared';
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
  /** Load shown IDs from server. Call once on app mount. */
  init: () => Promise<void>;
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

async function loadShownIdsFromAPI(): Promise<Set<string>> {
  return apiFetch<{ shown: string[] }>('/heads-up/milestones')
    .then((r) => new Set(r.shown))
    .catch(() => new Set<string>());
}

function persistMilestoneShown(milestoneId: string): void {
  apiFetch('/heads-up/milestones/mark-shown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ milestoneId }),
  }).catch(() => {});
}

/**
 * Queue of milestone toasts. We dedupe by milestone.id (one-shot per session).
 * The MilestoneToast component renders the queue and auto-dismisses after
 * TOAST_DURATION_MS.
 *
 * Call init() once on app mount to load persisted shown IDs from the server.
 * push() is synchronous after init completes.
 */
export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  shownIds: new Set(),

  init: async () => {
    const fromServer = await loadShownIdsFromAPI();
    set((state) => ({ shownIds: new Set([...state.shownIds, ...fromServer]) }));
  },

  push: (milestones) => {
    const cur = get();
    const merged = new Set(cur.shownIds);
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

    // fire-and-forget: 서버에 표시된 마일스톤 기록
    for (const t of newToasts) {
      persistMilestoneShown(t.milestone.id);
    }

    set({
      toasts: [...cur.toasts, ...newToasts],
      shownIds: merged,
    });
  },

  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  reset: () => {
    set({ toasts: [], shownIds: new Set() });
  },
}));
