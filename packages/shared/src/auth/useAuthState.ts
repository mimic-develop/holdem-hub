/**
 * Hub navbar 등에서 활성 provider의 인증 상태를 구독하는 훅.
 *
 * 현재 provider가 stub이라도 인터페이스(getCurrentUser/onAuthChange)는 동일하므로
 * 호출 측 코드는 실제 구현이 들어와도 변경 없이 동작한다.
 */
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "./types.js";
import { getActiveAuthProvider } from "./resolver.js";

export interface AuthState {
  user: AuthUser | null;
  /** signIn 진행 중 여부 */
  busy: boolean;
  /** 가장 최근 signIn 시도가 던진 에러 (사용자 표시용). 새 시도 시 reset. */
  error: Error | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** 활성 provider 이름 ("firebase" | "mimic" | "none") */
  providerName: string;
}

export function useAuthState(): AuthState {
  const providerRef = useRef(getActiveAuthProvider());
  const provider = providerRef.current;
  const [user, setUser] = useState<AuthUser | null>(provider.getCurrentUser());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const off = provider.onAuthChange((u) => setUser(u));
    return off;
  }, [provider]);

  return {
    user,
    busy,
    error,
    providerName: provider.name,
    signIn: async () => {
      setBusy(true);
      setError(null);
      try {
        const u = await provider.signIn();
        setUser(u);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setBusy(false);
      }
    },
    signOut: async () => {
      setBusy(true);
      try {
        await provider.signOut();
        setUser(null);
      } finally {
        setBusy(false);
      }
    },
  };
}
