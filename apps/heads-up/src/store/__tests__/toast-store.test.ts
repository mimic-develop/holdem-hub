import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Milestone } from '../../storage/stats';
import { useToastStore } from '../toast-store';

// Tests run in node — wire up a tiny in-memory localStorage shim so the
// toast-store's persistence path is exercised. Real browsers always have it.
function installLocalStorageShim(): void {
  if (typeof (globalThis as unknown as { localStorage?: Storage }).localStorage !== 'undefined') {
    return;
  }
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    configurable: true,
    writable: true,
  });
}

const M_FIRST: Milestone = {
  id: 'FIRST_HAND',
  emoji: '🃏',
  title: '첫 핸드',
  detail: '시작!',
};

const M_HIGH: Milestone = {
  id: 'FIRST_HIGH_SCORE',
  emoji: '🎯',
  title: '고득점',
  detail: '!',
};

describe('toast-store', () => {
  beforeAll(() => {
    installLocalStorageShim();
  });

  beforeEach(() => {
    // Wipe localStorage so persisted shownIds don't leak between tests.
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    useToastStore.getState().reset();
  });

  it('push adds new toasts', () => {
    useToastStore.getState().push([M_FIRST]);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].milestone.id).toBe('FIRST_HAND');
  });

  it('push dedupes by milestone id within session', () => {
    useToastStore.getState().push([M_FIRST]);
    useToastStore.getState().push([M_FIRST]);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('push dedupes via server-loaded shown ids (pre-populated by init)', () => {
    // Simulate what init() does: populate shownIds from the server.
    useToastStore.setState({ shownIds: new Set(['FIRST_HAND']) });
    useToastStore.getState().push([M_FIRST]);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('different milestones in one push both fire', () => {
    useToastStore.getState().push([M_FIRST, M_HIGH]);
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it('dismiss removes a single toast by id', () => {
    useToastStore.getState().push([M_FIRST, M_HIGH]);
    const toasts = useToastStore.getState().toasts;
    useToastStore.getState().dismiss(toasts[0].id);
    const after = useToastStore.getState().toasts;
    expect(after).toHaveLength(1);
    expect(after[0].milestone.id).toBe('FIRST_HIGH_SCORE');
  });

  it('reset clears persisted shown ids and active toasts', () => {
    useToastStore.getState().push([M_FIRST]);
    useToastStore.getState().reset();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(useToastStore.getState().shownIds.size).toBe(0);
    // Should be able to fire FIRST_HAND again now.
    useToastStore.getState().push([M_FIRST]);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
