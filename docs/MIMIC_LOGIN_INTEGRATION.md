# MIMIC 통합 로그인 이식 가이드

> 이 문서 한 장을 다른 프로젝트에 복사해 두고 Claude(또는 개발자)에게 보여주면,
> MIMIC 통합 로그인(OAuth `code` 플로우)을 그대로 붙일 수 있다.
> **비개발자도 아래 "0. 클로드에게 이렇게 시키세요" 프롬프트를 그대로 붙여넣으면 된다.**

레퍼런스 구현: `holdem-hub` 모노레포 (React + Vite). 스택이 달라도 개념은 동일하다.

---

## 0. 클로드에게 이렇게 시키세요 (비개발자용 복붙 프롬프트)

```
이 프로젝트에 MIMIC 통합 로그인을 붙여줘. 방식은 docs/MIMIC_LOGIN_INTEGRATION.md 가이드를 그대로 따르면 돼.
- 로그인 버튼 → 통합 로그인 페이지로 리다이렉트
- 돌아온 code로 토큰 교환 → 쿠키 저장 → 홈으로 이동
- 실패하면 에러 code를 한국어 메시지로 매핑해서 로그인 화면에 보여줘
환경변수(VITE_UNIFIED_LOGIN_URL / VITE_MIMIC_API_URL / VITE_MIMIC_CLIENT_ID / VITE_MIMIC_CLIENT_SECRET)는
내가 값을 줄 테니 .env에 자리만 만들어줘. 이 프로젝트가 "직원 전용"인지 "일반 유저용"인지는 아래에서 알려줄게.
```

값을 채울 때 필요한 정보는 **1. 사전 준비물**을 참고.

---

## 1. 사전 준비물 (MIMIC 인증팀에서 발급받아야 함)

| 항목                   | 설명                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `clientId`             | 이 애플리케이션 식별자. **프로젝트마다 다름**                        |
| `clientSecret`         | 위 clientId와 짝인 시크릿. **프로젝트마다 다름**                     |
| 통합 로그인 페이지 URL | 사용자를 리다이렉트할 로그인 페이지 (환경별로 다름)                  |
| MIMIC API base URL     | 토큰 교환을 요청할 MIMIC 서버 주소 (환경별로 다름)                  |

### ★ 핵심: 직원용 vs 유저용은 clientId/clientSecret로 갈린다

- MIMIC 인증 서버는 **애플리케이션(clientId)마다 "직원 전용 / 일반 유저 허용"을 서버 측에 등록**한다.
- **"직원 전용" 앱**에 일반 유저가 로그인하면 서버가 `code 400119`로 거부한다.
- 따라서 새 프로젝트를 시작할 때 **그 프로젝트가 직원용인지 유저용인지에 맞는 clientId/clientSecret 쌍을 발급받아 넣는 것**이 전부다. 코드 분기는 필요 없다 — 자격이 맞지 않으면 서버가 알아서 거부하고, 우리는 그 에러 코드를 메시지로 보여준다.

---

## 2. 환경변수

프론트(`VITE_` 접두사 = 브라우저 번들에 포함됨):

```bash
# 통합 로그인 페이지 URL (환경별로 값이 다름)
VITE_UNIFIED_LOGIN_URL=https://login.example.mimic

# MIMIC API base — 토큰 교환(/v1/auth/token) 요청 대상
VITE_MIMIC_API_URL=https://mimic-stage.r-e.kr/api

# 이 프로젝트용 자격 (직원용/유저용에 맞는 값을 발급받아 입력)
VITE_MIMIC_CLIENT_ID=mimic-web
VITE_MIMIC_CLIENT_SECRET=발급받은_시크릿
```

> ⚠️ **보안 주의**: 이 방식은 `clientSecret`을 프론트에서 MIMIC로 직접 전송하므로 **JS 번들에 노출된다.**
> MIMIC 사내 인증 흐름의 기존 관행(파라미터로 전달)과 동일하며, 사내 도구 기준으로 감수한 선택이다.
> 외부 공개 서비스에서 진짜 기밀이 필요하다면 백엔드 경유(server-to-server) 방식으로 바꿔야 한다.

---

## 3. 동작 흐름

```
[로그인 버튼 클릭]
      │  state 생성 → sessionStorage 저장
      ▼
[통합 로그인 페이지로 리다이렉트]
      │  ?client_id=...&redirect_uri=/oauth/callback&state=...
      ▼
[사용자가 MIMIC 계정으로 인증]
      │
      ▼
[/oauth/callback?code=xxx&state=xxx 로 되돌아옴]
      │  ① state 일치 검증 (CSRF 방지)
      │  ② POST {MIMIC_API_URL}/v1/auth/token  { code, clientId, clientSecret }
      ▼
   ┌──성공──────────────┐        ┌──실패──────────────────────────────────┐
   │ 토큰을 쿠키에 저장  │        │ 응답 { code, failReason }               │
   │ → 홈("/")으로 이동  │        │ → code를 한국어 메시지로 매핑           │
   └────────────────────┘        │ → 통합 로그인 페이지로 error와 함께      │
                                 │   리다이렉트 (우리 앱은 에러 UI 없음)   │
                                 └────────────────────────────────────────┘
```

> **실패 처리 정책**: 로그인 실패 메시지를 우리 앱 화면에 렌더링하지 않는다.
> 대신 통합 로그인 페이지로 되돌리며 `error` 파라미터로 메시지를 함께 넘긴다 —
> 에러 표시는 통합 로그인 페이지가 담당한다.

---

## 4. 구현 (파일별 복붙)

레퍼런스는 React + wouter(`useLocation`) + `js-cookie`. 다른 라우터/프레임워크면 라우팅·리다이렉트 부분만 그 스택 방식으로 바꾸면 된다.

### 4.1 토큰 저장 유틸 — `auth.ts`

로그인 성공 시 토큰을 쿠키에 저장한다.

```ts
import Cookies from "js-cookie";

const COOKIE_ACCESS = "accessToken";
const COOKIE_REFRESH = "refresh_token";

function cookieOpts(days: number): Cookies.CookieAttributes {
  return {
    expires: days,
    sameSite: "Lax",
    // HTTPS일 때만 Secure (localhost dev는 생략)
    ...(typeof location !== "undefined" && location.protocol === "https:"
      ? { secure: true }
      : {}),
  };
}

export function setTokens(accessToken: string, refreshToken?: string | null): void {
  Cookies.set(COOKIE_ACCESS, accessToken, cookieOpts(1));
  if (refreshToken) Cookies.set(COOKIE_REFRESH, refreshToken, cookieOpts(30));
  // 로그인 상태를 구독하는 곳에 알림 (선택)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mimic:token-set"));
  }
}

export function clearTokens(): void {
  Cookies.remove(COOKIE_ACCESS);
  Cookies.remove(COOKIE_REFRESH);
}
```

### 4.2 통합 로그인 헬퍼 + 에러 매핑 — `unifiedLogin.ts`

로그인 리다이렉트와 에러 매핑을 한 파일에 모은다. **로그인 버튼과 콜백 실패 처리가 이걸 공유한다.**

- `ERROR_MESSAGES`: 서버 `code` → 사용자용 한국어 문구. 없는 code면 서버 `failReason` 원문 폴백.
- `redirectToUnifiedLogin(error?)`: 통합 로그인 페이지로 이동. `error`를 주면 `?error=`로 함께 전달.

```ts
export const OAUTH_STATE_KEY = "hh:oauth-state";

export const ERROR_MESSAGES: Record<string, string> = {
  "40101": "존재하지 않는 계정입니다.",
  "40103": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "400025": "정지된 계정입니다. 관리자에게 문의해주세요.",
  "400026": "차단된 계정입니다. 관리자에게 문의해주세요.",
  "400000": "가입된 계정이 없습니다.",
  "400119": "직원 전용 서비스입니다. 일반 사용자는 이용하실 수 없습니다.",
  "None registered account": "가입된 계정이 없습니다.",
  oauth_failed: "로그인에 실패했습니다. 다시 시도해주세요.",
};

/** 서버 code/failReason → 사용자용 메시지 (알려진 code → 한국어, 없으면 failReason 폴백) */
export function resolveErrorMessage(code?: string | null, failReason?: string | null): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (failReason) return failReason;
  return ERROR_MESSAGES.oauth_failed;
}

/** 통합 로그인 페이지로 리다이렉트. error를 주면 ?error=로 함께 전달한다. */
export function redirectToUnifiedLogin(error?: string): void {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const unifiedLoginUrl = String(env?.VITE_UNIFIED_LOGIN_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "");

  // state = CSRF 방지용 1회성 난수. sessionStorage에 저장했다가 콜백에서 대조.
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  // base: 이 앱이 배포된 sub-path (예: GitHub Pages project page면 "/repo-이름/").
  // 도메인 루트에 배포되면 "/" — window.location.origin은 path를 포함하지 않으므로
  // sub-path 배포 시 반드시 BASE_URL을 함께 붙여야 한다 (자세한 설명은 4.2.1 참고).
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const redirectUri = new URL("oauth/callback", base).href;
  const cancelUrl = new URL("login", base).href; // 사용자가 취소 시 돌아올 곳
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    cancel_url: cancelUrl,
    service_name: "플레이랩", // 로그인 페이지에 표시될 서비스명
  });
  if (error) params.set("error", error); // ← 실패 메시지를 통합 로그인 페이지로 전달
  window.location.href = `${unifiedLoginUrl}?${params.toString()}`;
}
```

> 새 에러 코드를 만나면 `ERROR_MESSAGES`에 `"코드": "문구"` 한 줄만 추가하면 된다.
> ⚠️ `error` 파라미터 이름(`error`)은 **통합 로그인 페이지가 읽어 표시하는 규약에 맞춰야 한다.** 페이지 규약이 다르면 이름만 바꾸면 된다.

### 4.2.1 배포 sub-path(base) 대응 — **비개발자 프로젝트는 Claude가 이 판단을 대신 해줄 것**

`redirect_uri`/`cancel_url`은 항상 실제 서빙되는 경로와 정확히 일치해야 한다. 문제는 `window.location.origin`이
도메인까지만 알려주고, 그 앱이 도메인의 루트(`/`)에 있는지 서브패스(`/repo-이름/`) 아래에 있는지는 알려주지 못한다는 점이다.
이 서브패스 값은 **빌드 도구(Vite면 `base` 설정)에서 가져와야** 하고, `base` 값 자체는 "어디에 배포하는지"에 따라 결정된다.

**Claude가 새 프로젝트에 이 가이드를 적용할 때 반드시 다음을 판단할 것:**

1. **배포 대상이 GitHub Pages의 "project repo"인가?**
   (예: `<org>.github.io` 이외의 일반 저장소를 gh-pages 브랜치로 배포하는 경우 — CI 설정의 `external_repository`/저장소 이름을 확인)
   → 그렇다면 GitHub Pages 규칙상 실제 URL은 항상 `https://<org>.github.io/<repo-이름>/` 형태이므로,
     `vite.config.ts`에 아래처럼 **repo 이름을 그대로 반영해 자동으로 설정**한다:
     ```ts
     base: mode === "staging" ? "/<repo-이름>/" : "/"
     ```
   저장소 이름이 `<org-or-user>.github.io` 자체(유저/조직 전용 page repo)라면 서브패스가 없으므로 `base: "/"`.

2. **그 외 호스팅(Vercel, Netlify, Cloudflare Pages, 커스텀 서버 등)인가?**
   → 대부분 도메인 루트에 그대로 배포되므로 기본값은 `base: "/"`. 별도 판단 없이 바로 이 값으로 두면 된다.
   (리버스 프록시로 특정 서브패스 뒤에 물리는 특수 배포는 저장소 코드만으로는 알 수 없으므로, 이 경우에만 사용자에게 실제 서빙 경로를 직접 물어본다.)

이 판단은 **한 프로젝트당 한 번, `vite.config.ts`의 `base` 값을 정하는 순간에만** 필요하다.
일단 정해지면 `unifiedLogin.ts`의 `import.meta.env.BASE_URL` 기반 코드(4.2)는 그대로 재사용되며,
프로젝트마다 로그인 헬퍼 코드를 다시 고칠 필요가 없다.

> 참고: wouter를 쓴다면 `Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}` 로 라우터에도 같은 값을 전달해야
> `/login`, `/oauth/callback` 라우트가 서브패스 아래에서도 정상 매칭된다.

### 4.3 로그인 페이지 — `Login.tsx`

버튼 클릭 시 통합 로그인 페이지로 리다이렉트만 한다. **에러 표시 UI는 두지 않는다** (실패는 통합 로그인 페이지가 표시).

```tsx
import { useLocation } from "wouter";
import { redirectToUnifiedLogin } from "../lib/unifiedLogin";

export function Login() {
  const [, navigate] = useLocation();
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1>로그인</h1>
        <button type="button" onClick={() => redirectToUnifiedLogin()}>
          MIMIC 계정으로 로그인
        </button>
        <button type="button" onClick={() => navigate("/")}>홈으로 돌아가기</button>
      </div>
    </div>
  );
}
```

### 4.4 콜백 페이지 — `OAuthCallback.tsx`

`code` 수신 → `state` 검증 → 토큰 교환 → 쿠키 저장. **실패하면 우리 화면에 표시하지 않고, 메시지를 매핑해 통합 로그인 페이지로 리다이렉트**한다.

```tsx
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { setTokens } from "./auth";
import { OAUTH_STATE_KEY, redirectToUnifiedLogin, resolveErrorMessage } from "../lib/unifiedLogin";

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export function OAuthCallback() {
  const [, navigate] = useLocation();
  const done = useRef(false); // StrictMode 이중 실행 방지

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const apiBase = String(env?.VITE_MIMIC_API_URL ?? "");
    const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "");
    const clientSecret = String(env?.VITE_MIMIC_CLIENT_SECRET ?? "");

    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    // ① state 검증 — 불일치면 CSRF 의심. 통합 로그인 페이지로 되돌려 재시도.
    if (!code || !state || state !== savedState) {
      redirectToUnifiedLogin(resolveErrorMessage("oauth_failed"));
      return;
    }

    // ② 토큰 교환
    fetch(`${apiBase}/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, clientId, clientSecret }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw { status: res.status, data }; // 실패 응답 본문 보존
        return data as TokenResponse;
      })
      .then(({ accessToken, refreshToken }) => {
        setTokens(accessToken, refreshToken); // ③ 쿠키 저장
        navigate("/");                          // ④ 홈으로
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // ⑤ 실패: code/failReason을 메시지로 매핑해 통합 로그인 페이지로 리다이렉트
        const data = (err as { data?: { code?: string; failReason?: string } })?.data;
        redirectToUnifiedLogin(resolveErrorMessage(data?.code, data?.failReason));
      });

    return () => controller.abort();
  }, [navigate]);

  return <p>로그인 처리 중…</p>;
}
```

### 4.5 라우팅 등록

```tsx
<Route path="/login"><Login /></Route>
<Route path="/oauth/callback"><OAuthCallback /></Route>
```

`redirect_uri`(`/oauth/callback`)와 `cancel_url`(`/login`)이 실제 라우트와 일치해야 한다.

---

## 5. 로그인 상태 읽기 (선택)

저장된 accessToken(JWT)을 디코드해 현재 사용자 정보를 얻을 수 있다. 한글 깨짐 방지를 위해 `atob` + `TextDecoder`를 쓴다.

```ts
import Cookies from "js-cookie";

export function getCurrentUser() {
  const token = Cookies.get("accessToken");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return {
      id: String(payload.sub ?? payload.id ?? ""),
      nickname: typeof payload.nick === "string" ? payload.nick : null,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    return null;
  }
}
```

---

## 6. 체크리스트 (Definition of Done)

- [ ] 배포 대상에 맞게 `vite.config.ts`의 `base` 값 설정 확인 (GitHub Pages project repo면 `/repo-이름/`, 그 외 대부분 `/` — 4.2.1 참고)
- [ ] `.env`에 4개 값(`VITE_UNIFIED_LOGIN_URL`, `VITE_MIMIC_API_URL`, `VITE_MIMIC_CLIENT_ID`, `VITE_MIMIC_CLIENT_SECRET`) 채움
- [ ] 프로젝트 성격(직원용/유저용)에 맞는 clientId/clientSecret 발급받아 입력
- [ ] `/login`, `/oauth/callback` 라우트 등록
- [ ] 로그인 버튼 클릭 → 통합 로그인 페이지로 이동
- [ ] 인증 후 `/oauth/callback` 복귀 → 홈으로 이동 + 쿠키에 `accessToken` 저장 확인
- [ ] 실패 케이스에서 통합 로그인 페이지로 `error` 파라미터와 함께 리다이렉트됨 (우리 앱에 에러 UI 없음)
- [ ] 직원 전용 앱에 일반 계정으로 로그인 시 `400119` 메시지가 통합 로그인 페이지에 전달됨
- [ ] 통합 로그인 페이지가 `error`를 받으면 **자동 재로그인하지 않고 멈춰서 표시**하는지 확인 (무한 리다이렉트 방지)

---

## 7. 트러블슈팅 (실제 겪은 함정)

| 증상 | 원인 / 해결 |
| --- | --- |
| 로그인 실패가 반복되면 통합 로그인 ↔ 콜백 사이 **무한 리다이렉트** | 통합 로그인 페이지에 유효 세션이 있으면 code를 자동 재발급 → 콜백에서 같은 에러 → 다시 리다이렉트 → … 루프. 통합 로그인 페이지가 `error` 파라미터를 받으면 **자동 재발급을 멈추고 에러를 표시**하도록 되어 있어야 한다 (페이지 측 규약). 안 된다면 콜백에서 재시도 횟수를 sessionStorage로 1회 제한하는 가드 추가. |
| 통합 로그인 페이지에 에러가 안 뜸 | 우리가 넘기는 `error` 파라미터 이름이 페이지가 읽는 이름과 다름. 4.2의 `params.set("error", …)` 키를 페이지 규약에 맞게 변경. |
| 에러 메시지가 `"API 400 …"` 처럼 뭉개져 나옴 | 실패 응답의 `code`/`failReason`이 중간에 버려진 것. `OAuthCallback`의 `.catch`에서 `err.data`(this repo는 `ApiError.data`)를 `resolveErrorMessage(code, failReason)`에 넘긴다 (4.2/4.4 참고). |
| 콜백에서 토큰 교환이 두 번 실행됨 | React StrictMode. `useRef(done)` 가드로 1회만 실행 (4.4). |
| `import.meta.env` 값이 런타임에 `undefined` | **옵셔널 체이닝(`import.meta?.env`) 금지.** Vite의 env 주입이 텍스트 패턴 매칭이라 깨진다. `(import.meta as unknown as { env?: … }).env` 형태로 직접 접근. |
| 토큰 교환 요청이 엉뚱한 곳(404)으로 감 | 요청 base URL 확인. 이 흐름은 **MIMIC 서버(`VITE_MIMIC_API_URL`)의 `/v1/auth/token`을 직접** 호출한다. 공통 fetch 래퍼가 다른 baseUrl(예: 로컬 API 서버)을 붙이고 있으면 경로가 어긋난다 — 콜백에선 `VITE_MIMIC_API_URL`을 명시적으로 붙일 것. |
| `redirect_uri`로 콜백됐는데 그 페이지가 404 (특히 GitHub Pages 서브패스 배포) | `window.location.origin`만으로 `redirect_uri`를 만들면 서브패스(`/repo-이름/`)가 빠진다. `import.meta.env.BASE_URL`을 함께 반영해야 함 (4.2.1 참고). wouter 등 라우터의 `base`도 같은 값으로 맞춰져 있는지 함께 확인. |
| 성공했는데 `accessToken`이 `undefined` | 성공 응답이 `{accessToken, refreshToken}` 평면 구조가 아니라 `{result, data:{accessToken}}` 봉투 구조일 수 있음. 그렇다면 `.then` 에서 `data.data`를 언래핑. 실제 응답을 네트워크 탭에서 먼저 확인. |
| JWT의 한글 닉네임이 깨짐 | `atob`만 쓰면 Latin-1로 깨진다. `Uint8Array` + `TextDecoder` 사용 (5번 코드). |

---

## 8. 이 모노레포(@hh/*)에서 쓸 때의 차이

`holdem-hub` 내부에서는 위 유틸이 이미 공통 패키지로 존재하므로 새로 만들 필요 없다:

- `setTokens` / `clearTokens` → `@hh/shared`의 `packages/shared/src/auth/mimic.ts`
- fetch 래퍼 `apiFetch` / `ApiError` → `@hh/shared`의 `packages/shared/src/api/client.ts`
- 통합 로그인 헬퍼 + 에러 매핑 (`redirectToUnifiedLogin` / `resolveErrorMessage` / `ERROR_MESSAGES`) → `apps/hub/src/lib/unifiedLogin.ts`
- 로그인/콜백 페이지 → `apps/hub/src/pages/Login.tsx`, `OAuthCallback.tsx`
- 이 레포의 `apiFetch`는 baseUrl을 자동 결정하므로, 토큰 교환은 `apiFetch<TokenResponse>("/v1/auth/token", …)`로 호출하고 실패 시 `err instanceof ApiError`로 분기해 `ApiError.data`의 `code`/`failReason`을 `resolveErrorMessage`에 넘긴다.
