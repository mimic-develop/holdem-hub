/**
 * Auth 추상화.
 *
 * 현재는 Firebase(concept-quiz용)만 실제 구현이 있고,
 * 추후 Mimic 서버 OAuth가 추가될 자리만 마련해 둠.
 */

export interface AuthUser {
  id: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface AuthProvider {
  readonly name: AuthProviderName;
  signIn(): Promise<AuthUser>;
  signOut(): Promise<void>;
  getCurrentUser(): AuthUser | null;
  /** 구독 해제 함수 반환 */
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
}

export type AuthProviderName = "firebase" | "mimic" | "none";
