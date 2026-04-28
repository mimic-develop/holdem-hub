/**
 * 앱별 prefix가 적용된 localStorage 키 빌더.
 *
 * 모노레포에서 모든 앱이 동일 origin을 공유하므로,
 * key 충돌을 막기 위해 반드시 앱 식별 prefix를 붙인다.
 *
 * @example
 *   const KEY = storageKey("pot-quiz", "bestScore_easy");
 *   // → "pot-quiz:bestScore_easy"
 */
export function storageKey(app: string, key: string): string {
  return `${app}:${key}`;
}

/**
 * SSR/비-브라우저 환경에서도 안전한 localStorage 읽기.
 */
export function getStoredItem(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredItem(key: string, value: string): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredItem(key: string): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
