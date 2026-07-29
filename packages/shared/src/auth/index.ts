export type { AuthUser, AuthProvider, AuthProviderName } from "./types.js";
export { AuthError } from "./types.js";
export { createMimicAuthStub, setTokens, clearTokens, getAccessTokenExpiryMs } from "./mimic.js";
export { checkSession, startSessionKeepAlive } from "./session.js";
export { createNoneAuthStub } from "./none.js";
export { createMockAuthStub } from "./mock.js";
export {
  getActiveAuthProvider,
  registerAuthProvider,
  _resetAuthProviderForTests,
} from "./resolver.js";
export { createFirebaseAuthProvider } from "./firebase.js";
export { useAuthState, type AuthState } from "./useAuthState.js";
