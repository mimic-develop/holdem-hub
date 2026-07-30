# MIMIC 통합 로그인 이식 가이드

> 이 문서 한 장을 다른 프로젝트에 복사해 두고 Claude(또는 개발자)에게 보여주면,
> MIMIC 통합 로그인(OAuth `code` 플로우)을 그대로 붙일 수 있다.
> **비개발자도 아래 "0. 클로드에게 이렇게 시키세요" 프롬프트를 그대로 붙여넣으면 된다.**

레퍼런스 구현: `holdem-hub` 모노레포 (React + Vite). 스택이 달라도 개념은 동일하다.

---

## 0. 클로드에게 이렇게 시키세요 (비개발자용 복붙 프롬프트)

```
이 프로젝트에 MIMIC 통합 로그인을 붙여줘. 방식은 docs/MIMIC_LOGIN_INTEGRATION.md 가이드를 그대로 따르면 돼.
시작하기 전에 0.1, 0.2 섹션을 먼저 읽고, 거기 나온 대로 나한테 딱 필요한 것만 물어봐줘.
```

**비개발자는 이 프롬프트만 붙여넣으면 된다.** 그 다음은 Claude가 아래 **0.1(뭘 물어볼지)**과
**0.2(뭘 절대 묻지 말아야 할지)**를 보고 알아서 필요한 질문만 하고, 나머지는 스스로 판단해서
구현한다.

---

## 0.1 (Claude 전용) 구현 전 판단 체크리스트

이 가이드로 작업을 시작하기 전에 아래 세 그룹으로 나눠서 처리한다. **혼동하지 말 것: 아래
목록에 없는 건 전부 Claude가 스스로 판단하고, 사용자에게 되묻지 않는다.**

**A. 지금 바로 사용자에게 물어볼 것 (구현 시작 전에 필요)**

1. 서비스 이름 — 로그인 페이지에 표시될 이름 (예: "플레이랩"). → `VITE_SERVICE_NAME`에 들어감.
2. 이 프로젝트가 **일반 유저용**인지 **직원(관리자) 전용**인지. → 코드 분기는 없다. 사용자가
   담당자에게 맞는 clientId를 요청할 때 쓸 정보이므로 미리 확정해둔다 (B / 1번 참고).
3. **배포 위치 (= 최종 서비스 주소).** 단, **리포의 배포 설정 파일로 판별되면 묻지 않는다** —
   먼저 `.github/workflows/*.yml`, `vercel.json`, `netlify.toml` 등을 확인하고(판단 기준은
   4.2.1), 거기서 확정할 수 있으면 그 값을 쓴다. **판별할 근거가 없으면(새 프로젝트라 배포
   설정이 아직 없는 경우가 흔하다) 추측하지 말고 아래처럼 묻는다:**

   > 이 사이트가 최종적으로 어떤 주소로 서비스되나요?
   > ① `https://우리도메인.com/` 처럼 도메인 바로 아래 → (대부분 이 경우)
   > ② `https://<계정>.github.io/<저장소이름>/` 처럼 뒤에 경로가 붙음 → GitHub Pages 프로젝트 저장소
   > ③ 아직 안 정했다

이 답들을 받으면 **바로 구현을 시작한다.** 아래 B는 실행/배포 직전에만 필요하므로 구현을 막지 않는다.

> **A-3을 왜 묻는가:** `redirect_uri`는 `도메인 + 배포경로 + /oauth/callback`으로 만들어지고,
> 이 값은 **담당자에게 미리 등록**해야 한다(B 참고). 배포 경로를 틀리게 추측하면 등록된 주소와
> 어긋나 로그인이 깨지고, 담당자에게 재등록을 요청하는 왕복이 생긴다. 실제로 레퍼런스
> 프로젝트에서 `redirect_uri`에 sub-path가 빠져 콜백이 404 났던 사고가 있었다.
> 질문 하나가 그 왕복보다 싸므로, **불확실하면 반드시 묻는다.**
>
> ③(미정)을 답했다면 일단 `base: "/"`로 두고 구현하되, **"배포처가 GitHub Pages 프로젝트
> 저장소로 정해지면 `vite.config.ts`의 `base`를 `/저장소이름/`으로 바꾸고 `redirect_uri`를
> 담당자에게 다시 등록해야 한다"**는 점을 사용자에게 명확히 남긴다.

**B. 구현은 먼저 하되, 실행 전에 사용자가 채워야 할 것 (Claude가 대신 만들어낼 수 없음)**

**아래 3개 값은 전부 MIMIC 인증 담당자에게 받는다.** `.env.example`에 자리만 만들어두고
사용자에게 요청 문구를 안내한 뒤, **값을 기다리지 말고 구현을 계속 진행한다.**

- `VITE_UNIFIED_LOGIN_URL` — 통합 로그인 페이지 주소
- `VITE_MIMIC_API_URL` — 토큰 교환을 요청할 MIMIC 서버 주소
- `VITE_MIMIC_CLIENT_ID` — 이 앱의 식별자

**Claude가 값을 추측하거나 다른 프로젝트에서 복사해 넣지 않는다.** 세 값 모두 환경(로컬/스테이징/
운영)마다 다르고, 다른 저장소에 적혀 있는 값이 잠정치(`TBD`)이거나 이미 바뀐 값일 수 있다.
clientId는 특히 관례로 유추하면 안 된다 (`mimic-web` / `mimic-admin` 같은 이름을 임의로 넣지 말 것)
— 실제 등록값과 다르면 로그인이 조용히 실패하고, 그 증상(`400119` 또는 리다이렉트 거부)은
비개발자가 원인을 짚기 가장 어려운 종류다.

**사용자에게 안내할 요청 문구** (담당자에게 한 번에 묶어 보내도록):

```
[서비스명]에 MIMIC 통합 로그인을 붙이려고 합니다. 아래를 부탁드립니다.
1. 이 프로젝트는 (일반 유저용 / 직원 전용)입니다 — 여기에 맞는 client_id를 알려주세요.
2. 위 client_id에 아래 redirect_uri 등록을 부탁드립니다.
   - 배포용: <A-3 답변으로 계산한 값, 예: https://xxx.github.io/repo/oauth/callback>
   - 로컬 개발용: http://localhost:<포트>/oauth/callback
3. 통합 로그인 페이지 URL과 MIMIC API base URL을 (개발/스테이징/운영) 환경별로 알려주세요.
4. (accessToken 자동 갱신도 구현할 경우에만) 위 client_id의 client_secret도 함께 알려주세요.
   — 서버 전용 환경변수에만 저장하고 프론트 번들에는 절대 넣지 않습니다.
```

> 로컬 개발용 `redirect_uri`도 함께 등록해두지 않으면 배포 전에 로그인을 테스트할 수 없다.
> 포트는 그 프로젝트의 dev 서버 포트를 확인해 채운다.

- **로그인(코드→토큰 교환)만 구현할 때는 `clientSecret`을 요청하지 않는다** — 이 흐름은 필요
  없음(1번 참고). **accessToken 자동 갱신(4.6)까지 구현할 때만** 4번 항목으로 함께 요청한다.

> 참고: clientId는 **비밀이 아니다.** 로그인 리다이렉트 URL의 `?client_id=`에 그대로 실려 나가고
> 프론트 번들에도 포함되므로, `.env`나 저장소에 들어가는 것 자체는 문제가 아니다. 담당자에게 받는
> 이유는 기밀 유지가 아니라 **정확한 값 확인과 `redirect_uri` 등록** 때문이다.

**A-4. 기존 로그인 페이지가 있을 때만 추가로 물어볼 것 (없으면 묻지 않는다)**

라우트/파일을 `login`, `signin`, `sign-in`, `auth` 키워드로 먼저 검색한다.
- **없으면** → 묻지 말고 새로 만든다 (진입점 버튼까지 함께 — 4.3 경우 ①).
- **있으면** → 기존 로그인 방식을 **없애고 MIMIC으로 교체**할지, **남겨두고 MIMIC을 추가**할지
  사용자에게 묻는다. 코드로 판단할 수 없는 정책 결정이다 (4.3 경우 ②/③).
- 교체하기로 했다면 **지우기 전에 무엇을 지우는지 보고하고 확인받는다** — 기존 폼/API 호출을
  조용히 삭제하지 않는다. 회원가입·비밀번호 찾기 같은 별개 기능은 손대지 않는다 (4.3 참고).

**C. Claude가 스스로 판단하고, 절대 사용자에게 묻지 않는 것**

- **프레임워크/라우터**: `package.json`을 읽어서 자동 판단 (React/Vue/Next 등, wouter/RR6/next-router 등).
- **로그인/콜백 페이지 경로**: **항상** `BASE_URL + /login`, `BASE_URL + /oauth/callback`으로
  고정한다 (프로젝트마다 다르게 두지 않고, 앞에 다른 세그먼트도 붙이지 않는다). 기존 로그인
  페이지가 `/signin` 등에 있었다면 MIMIC 로그인은 `/login`에 두고 옛 경로는 `/login`으로
  리다이렉트를 남긴다 — 4.3의 "경로 규약" 참고.
- **`redirect_uri`/`cancel_url` 값 자체**: 사람에게 물어볼 대상이 아니다. 코드가 항상
  `origin + BASE_URL + "/oauth/callback"`, `"/login"` 공식으로 계산한다 (4.2 참고).
  프로젝트마다 이 공식을 커스터마이징하지 않는다.
  (단, 이 공식의 **입력값인 배포 경로**는 판별 안 되면 물어본다 — A-3 참고.)
- **로그인 실패 시 UI**: 이 앱 화면에 렌더링하지 않고 통합 로그인 페이지로 리다이렉트하는 게
  고정 정책이다 (3번 "실패 처리 정책" 참고). "에러 화면을 만들어 달라"는 요청이 없어도 만들지 않는다.
- **PKCE 적용 여부**: 항상 적용한다 (보안 기본값, 3번 참고). 사용자가 빼달라고 명시적으로
  요청하지 않는 한 생략하지 않는다.
- **accessToken 자동 갱신 방식**: 항상 401 인터셉터 하나로만 처리한다 (4.6 참고). 만료 전
  미리 갱신하는 별도 타이머는 추가하지 않는다 — 이미 검토 후 뺀 설계 결정이라 사용자에게
  다시 묻지 않는다.
- **밴 감지 heartbeat 주기**: 1시간 고정 (4.7 참고). 사용자가 다른 주기를 명시적으로
  요청하지 않는 한 그대로 둔다.

---

## 0.2 Claude가 비개발자에게 절대 묻지 말아야 할 것

**원칙**: 질문하기 전에 "비개발자가 실제로 답할 수 있는 질문인가?"를 자문한다. 답은 셋 중
하나다 — ① 코드/설정 파일을 읽어 Claude가 스스로 판단, ② 검증 방법을 바꿔서(아래 참고)
질문 자체를 없앰, ③ 그래도 안 되면 **묻지 않고 넘어간 뒤, 최종 확인은 비개발자가 실제
서비스에서 직접 써보며 하도록 남긴다.**

**절대 묻지 않는 것 (전부 개발자 전용 지식이라 비개발자가 답을 모른다):**
- DB/서버에 테스트·시드 계정이 실제로 들어가 있는지, 어떤 계정으로 로그인해야 하는지
- 터미널에서 `curl`을 날려본 결과, 로그 파일 내용, 프로세스가 떠 있는 포트 번호
- 백엔드 코드의 구체적인 구현 방식 (예: "이 필드가 optional인가요?")

> **실제 사례**: 어떤 세션이 "로그인 마지막 단계(토큰 교환 → 헤더 갱신 → 400119 케이스)를
> 끝까지 검증하려면 유효한 계정이 필요합니다. 시드 계정이 로컬 DB에 실제로 들어가 있는지
> 확인이 안 됩니다(로그인 시도 시 '가입되지 않은 계정' 응답). 어떻게 할까요?" 라고 사용자에게
> 물은 적이 있다. **이건 잘못된 질문이다.** 비개발자는 DB 시드 여부를 알 도리가 없고, 애초에
> 실제 로그인 성공까지 확인하는 건 구현 완료 조건도 아니다.

**왜 "실제 로그인 성공"이 검증 조건이 아닌가**: 실패하더라도 통합 로그인 페이지가 모든
에러 케이스를 자체적으로 표시하도록 이미 설계돼 있다(3번 "실패 처리 정책"). 즉 우리 구현이
맞는지는 ① 리다이렉트 URL의 파라미터가 정확한지, ② 콜백에서 토큰 교환 요청이 올바른
필드로 나가는지, ③ 실패 시 에러 코드가 통합 로그인 페이지로 잘 전달되는지 — 이 세 가지를
코드/Network 탭으로 확인하면 충분하다. **실제 계정으로 끝까지 로그인이 성공하는지는 별개
문제이고, 그건 비개발자가 나중에 실제 서비스에서 직접 눌러보며 확인할 몫이다.** Claude가
그 확인을 대신하려고 계정을 찾거나 DB를 뒤지거나 사용자에게 계정 상태를 캐물으면 안 된다.

**Claude가 스스로 못 끝내는 검증을 만났을 때 할 일**: "여기까지는 코드로 확인했고, 실제
로그인 성공 여부는 (본인 MIMIC 계정으로) 직접 로그인해서 확인해주세요"라고 안내하고
넘어간다. 비밀번호를 대신 입력하거나, 계정을 대신 찾거나, 우회 방법(테스트 토큰 발급 등)을
찾으려 하지 않는다.

---

## 1. 사전 준비물 (전부 MIMIC 인증 담당자에게 받는다)

| 항목                   | 설명                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `clientId`             | 이 애플리케이션 식별자. 프로젝트마다 다르고, **유저용/직원용이 여기서 갈린다** |
| `redirect_uri` 등록    | 이 앱의 콜백 주소를 위 clientId의 허용 목록에 등록 요청 (값은 Claude가 계산 — 4.2.1 참고) |
| 통합 로그인 페이지 URL | 사용자를 리다이렉트할 로그인 페이지 (환경별로 다름)                  |
| MIMIC API base URL     | 토큰 교환을 요청할 MIMIC 서버 주소 (환경별로 다름)                   |

> 네 항목을 **한 번에 묶어** 요청하면 된다 — 요청 문구 예시는 0.1의 B 참고.
> 다른 저장소의 `.env`에서 값을 베껴오지 말 것: 환경별로 다르고, 잠정치(`TBD`)나 이미 바뀐
> 값일 수 있다.

> `clientSecret`은 로그인(코드→토큰 교환)엔 필요 없다. 이 흐름은 공개 클라이언트(브라우저 SPA)
> 전제이며, 코드 탈취 방어는 `clientSecret` 대신 **PKCE**(3번 참고)가 담당한다.
> **단, accessToken 자동 갱신(4.6)을 구현한다면 `clientSecret`이 그때는 필요하다** — 담당자에게
> clientId와 함께 요청하되, 이 값은 **절대 프론트 `.env`(`VITE_` 접두사)에 넣지 않고 서버 전용
> 환경변수로만 보관한다** (4.6 참고).

### ★ 핵심: 직원용 vs 유저용은 clientId로 갈린다 (코드 분기 없음)

- MIMIC 인증 서버는 **애플리케이션(clientId)마다 "직원 전용 / 일반 유저 허용"을 서버 측에 등록**한다.
- **"직원 전용" 앱**에 일반 유저가 로그인하면 서버가 `code 400119`로 거부한다.
- 따라서 새 프로젝트를 시작할 때 **그 프로젝트가 직원용인지 유저용인지에 맞는 clientId를 넣는 것**이 전부다. 코드 분기는 필요 없다 — 자격이 맞지 않으면 서버가 알아서 거부하고, 우리는 그 에러 코드를 메시지로 보여준다.
- 그래서 Claude는 이 질문(0.1의 A-2)의 답으로 **코드를 바꾸지 않는다.** 사용자가 담당자에게
  올바른 clientId를 요청할 수 있도록 확정해두는 용도다.
- ⚠️ **clientId 이름을 관례로 추측해 넣지 말 것** (`mimic-web` / `mimic-admin` 등). 실제 등록된
  값과 다르면 로그인이 조용히 실패하고, 원인 진단이 가장 어려운 종류의 오류가 된다. 이 저장소가
  `mimic-web`을 쓰는 것은 이 프로젝트에 그 값이 등록돼 있기 때문일 뿐, 다른 프로젝트에 그대로
  쓸 수 있다는 뜻이 아니다.

---

## 2. 환경변수

프론트(`VITE_` 접두사 = 브라우저 번들에 포함됨):

`.env.example`은 아래처럼 **빈 자리로** 만든다. 예시 값을 채워두면 그대로 쓰이거나 잠정치가
굳어버리므로, 담당자에게 받은 값만 각 환경의 `.env`에 넣는다.

```bash
# ↓ 아래 3개는 MIMIC 인증 담당자에게 받아 채운다 (1번 참고). 값을 임의로 추측하지 말 것.

# 통합 로그인 페이지 URL (환경별로 다름)
VITE_UNIFIED_LOGIN_URL=

# MIMIC API base — 토큰 교환(/v1/auth/token) 요청 대상 (환경별로 다름)
VITE_MIMIC_API_URL=

# 이 프로젝트용 식별자 (유저용/직원용에 맞는 값을 담당자에게 확인)
VITE_MIMIC_CLIENT_ID=

# 로그인 페이지에 표시될 서비스 이름 (사용자에게 물어본 값 — 0.1의 A-1)
VITE_SERVICE_NAME=우리서비스
```

> `/v1/auth/token`은 `clientSecret`을 요구하지 않는다 (공개 클라이언트 전제). 대신 **PKCE**로
> 코드 탈취를 방어한다 — 자세한 내용은 3번/4.2번 참고. `clientSecret`을 프론트 번들에 넣는
> 과거 관행은 폐기됐으니 새 프로젝트에 이식할 때 `VITE_MIMIC_CLIENT_SECRET`을 추가하지 않는다.

---

## 3. 동작 흐름

```
[로그인 버튼 클릭]
      │  state 생성 → sessionStorage 저장
      │  PKCE: code_verifier(비밀) 생성 → sessionStorage 저장
      │        code_challenge = base64url(SHA-256(code_verifier))
      ▼
[통합 로그인 페이지로 리다이렉트]
      │  ?client_id=...&redirect_uri=/oauth/callback&state=...
      │  &code_challenge=...&code_challenge_method=S256
      │  (verifier는 리다이렉트 URL에 절대 포함하지 않는다 — 여기(클라이언트)에만 보관)
      ▼
[사용자가 MIMIC 계정으로 인증]
      │
      ▼
[/oauth/callback?code=xxx&state=xxx 로 되돌아옴]
      │  ① state 일치 검증 (CSRF 방지)
      │  ② sessionStorage에서 code_verifier 꺼내기 (1회성 — 꺼내며 바로 제거)
      │     없으면 ①과 동일하게 실패 처리
      │  ③ POST {MIMIC_API_URL}/v1/auth/token  { code, clientId, codeVerifier }
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

> **PKCE(RFC 7636)를 쓰는 이유**: `code`는 1회용이지만 URL(redirect_uri)에 평문으로 노출된다.
> 코드만 가로채면 만료 전(보통 2분 TTL) 누구든 `/v1/auth/token`으로 교환할 수 있다.
> `code_verifier`는 절대 URL에 실리지 않고 클라이언트(이 앱)에만 보관되므로, 코드를 가로채도
> verifier 없이는 토큰 교환이 실패한다. `code_challenge` 검증(저장/대조)은 MIMIC 인증 서버
> 책임이며 이 문서는 클라이언트 측 구현만 다룬다.

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
export const OAUTH_PKCE_VERIFIER_KEY = "hh:oauth-pkce-verifier";

// ★ 아래 두 경로는 모든 프로젝트에서 동일한 고정 규약이다. 절대 바꾸지 말 것 (4.3 참고).
//   로그인 페이지  = BASE_URL + "login"
//   콜백 페이지    = BASE_URL + "oauth/callback"
// 프로젝트마다 다르게 두면 이 파일을 매번 수정해야 하고, 담당자에게 등록한 redirect_uri와도 어긋난다.
const LOGIN_PATH = "login";
const CALLBACK_PATH = "oauth/callback";

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

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE code_verifier 생성 (32바이트 난수 → base64url, 43자 — RFC 7636 조건 만족). */
function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** PKCE code_challenge = base64url(SHA-256(verifier)). */
async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(digest));
}

/** 저장해둔 PKCE verifier를 1회성으로 꺼낸다 (읽는 즉시 제거). 콜백에서 사용. */
export function consumePkceVerifier(): string | null {
  const verifier = sessionStorage.getItem(OAUTH_PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_PKCE_VERIFIER_KEY);
  return verifier;
}

/** 통합 로그인 페이지로 리다이렉트. error를 주면 ?error=로 함께 전달한다. */
export async function redirectToUnifiedLogin(error?: string): Promise<void> {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const unifiedLoginUrl = String(env?.VITE_UNIFIED_LOGIN_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "");
  const serviceName = String(env?.VITE_SERVICE_NAME ?? "");

  // state = CSRF 방지용 1회성 난수. sessionStorage에 저장했다가 콜백에서 대조.
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  // PKCE: verifier는 여기(클라이언트)에만 보관하고 challenge만 로그인 페이지에 전달.
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(OAUTH_PKCE_VERIFIER_KEY, verifier);
  const challenge = await sha256Base64Url(verifier);

  // redirect_uri / cancel_url은 항상 이 공식으로 계산한다 (공식 자체는 커스터마이징하지 않는다):
  //   origin(도메인) + BASE_URL(배포 sub-path) + CALLBACK_PATH | LOGIN_PATH
  // base: 이 앱이 배포된 sub-path (예: GitHub Pages project page면 "/repo-이름/").
  // 도메인 루트에 배포되면 "/" — window.location.origin은 path를 포함하지 않으므로
  // sub-path 배포 시 반드시 BASE_URL을 함께 붙여야 한다 (자세한 설명은 4.2.1 참고).
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const redirectUri = new URL(CALLBACK_PATH, base).href;
  const cancelUrl = new URL(LOGIN_PATH, base).href; // 사용자가 취소 시 돌아올 곳
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    cancel_url: cancelUrl,
    service_name: serviceName, // 로그인 페이지에 표시될 서비스명 (env로 주입 — 하드코딩 금지)
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (error) params.set("error", error); // ← 실패 메시지를 통합 로그인 페이지로 전달
  window.location.href = `${unifiedLoginUrl}?${params.toString()}`;
}
```

> 새 에러 코드를 만나면 `ERROR_MESSAGES`에 `"코드": "문구"` 한 줄만 추가하면 된다.
> ⚠️ `error` 파라미터 이름(`error`)은 **통합 로그인 페이지가 읽어 표시하는 규약에 맞춰야 한다.** 페이지 규약이 다르면 이름만 바꾸면 된다.
> ⚠️ `code_challenge`/`code_challenge_method`, 토큰 교환 body의 `codeVerifier` 필드명은
> **MIMIC 인증 서버와 맞춰야 하는 계약이다.** 서버가 다른 이름을 쓴다면 이 파일의 `params`
> 키와 `OAuthCallback`의 body 키만 바꾸면 된다 (4.4 참고).

### 4.2.1 배포 sub-path(base) 판단 — 설정 파일로 먼저, 안 되면 사용자에게 묻는다

`redirect_uri`/`cancel_url`은 항상 실제 서빙되는 경로와 정확히 일치해야 한다. 문제는 `window.location.origin`이
도메인까지만 알려주고, 그 앱이 도메인의 루트(`/`)에 있는지 서브패스(`/repo-이름/`) 아래에 있는지는 알려주지 못한다는 점이다.
이 서브패스 값은 **빌드 도구(Vite면 `base` 설정)에서 가져와야** 하고, `base` 값 자체는 "어디에 배포하는지"에 따라 결정된다.

> **즉, 사용자에게 물어봐야 하는 건 `redirect_uri`/`cancel_url`이 아니라 (그건 4.2의 공식으로
> 자동 계산됨), 그 입력값인 배포 sub-path 하나뿐이다.** 아래 1·2번으로 판별되면 묻지 않고,
> 3번(판별 근거 없음)이면 **추측하지 말고 반드시 묻는다** — 0.1의 A-3 참고.

**판단 순서 (배포 설정 파일을 읽어서 결정):**

1. **GitHub Pages의 "project repo"로 배포하는가?**
   (`.github/workflows/*.yml`에서 `gh-pages` 브랜치 배포 / `external_repository` 설정 확인.
   `<org>.github.io` 이외의 일반 저장소면 여기 해당)
   → GitHub Pages 규칙상 실제 URL이 항상 `https://<org>.github.io/<repo-이름>/` 형태이므로,
     `vite.config.ts`에 **repo 이름을 그대로 반영**한다:
     ```ts
     base: mode === "staging" ? "/<repo-이름>/" : "/"
     ```
   저장소 이름이 `<org-or-user>.github.io` 자체(유저/조직 전용 page repo)라면 서브패스가 없으므로 `base: "/"`.

2. **그 외 호스팅(Vercel, Netlify, Cloudflare Pages, 일반 서버 등)의 설정 파일이 있는가?**
   (`vercel.json`, `netlify.toml`, Dockerfile, nginx 설정 등 확인)
   → 이들은 대부분 도메인 루트에 배포되므로 `base: "/"`로 둔다.

3. **위 파일들이 아예 없거나, 있어도 서빙 경로를 알 수 없는가?**
   (배포 설정이 아직 없는 새 프로젝트 — **흔한 경우다** — 또는 리버스 프록시로 특정 서브패스
   뒤에 물리는 특수 배포)
   → **`base: "/"`로 임의 단정하지 말고 사용자에게 묻는다** (질문 문구는 0.1의 A-3).
     그 답의 경로 부분을 `base`에 넣는다. "아직 미정"이면 `"/"`로 두되, 배포처 확정 시
     `base`와 `redirect_uri` 재등록이 필요하다는 점을 사용자에게 남긴다.

이 판단은 **한 프로젝트당 한 번, `vite.config.ts`의 `base` 값을 정하는 순간에만** 필요하다.
일단 정해지면 `unifiedLogin.ts`의 `import.meta.env.BASE_URL` 기반 코드(4.2)는 그대로 재사용되며,
프로젝트마다 로그인 헬퍼 코드를 다시 고칠 필요가 없다.

> ⚠️ 여기서 정한 최종 `redirect_uri`(예: `https://org.github.io/repo/oauth/callback`)는
> **MIMIC 인증 서버에 허용 목록으로 등록돼 있어야 한다.** 등록된 값과 다르면 로그인 페이지가
> 리다이렉트를 거부한다. `base`를 정한 뒤 사용자에게 "이 redirect_uri를 MIMIC 인증팀에
> 등록 요청해주세요"라고 최종 값을 알려줄 것.

> 참고: wouter를 쓴다면 `Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}` 로 라우터에도 같은 값을 전달해야
> `/login`, `/oauth/callback` 라우트가 서브패스 아래에서도 정상 매칭된다.

### 4.3 로그인 페이지 — 기존 페이지가 있는지에 따라 갈린다

**먼저 프로젝트에 로그인 페이지가 이미 있는지 확인한다.** 라우트 정의와 파일명을
`login`, `signin`, `sign-in`, `auth` 키워드로 검색한다 (`/login`이 아니라 `/signin`,
`/auth/login` 같은 경로를 쓰는 프로젝트가 많다).

결과에 따라 아래 세 경우로 갈린다.

#### 경우 ① 로그인 페이지가 없다 → 새로 만든다

아래 코드로 페이지를 만들고, **진입점도 함께 추가한다** — 헤더/네비게이션에 "로그인" 버튼이
없으면 사용자가 이 페이지에 도달할 방법이 없다. 기존 헤더 컴포넌트를 찾아 로그인 버튼을 넣고,
버튼은 로그인 페이지로 이동시킨다 (`redirectToUnifiedLogin()`을 헤더에서 직접 호출해도 되지만,
로그인 페이지를 경유하는 편이 `cancel_url`로 돌아올 곳이 생겨 자연스럽다).

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

#### 경우 ② 로그인 페이지가 있고, 기존 로그인 방식을 MIMIC으로 **교체**한다

기존 페이지의 이메일/비번 폼과 그 폼이 호출하던 인증 API 호출을 **"MIMIC 계정으로 로그인"
버튼 하나로 대체**한다. 레이아웃·로고·스타일은 기존 것을 최대한 유지하고, 폼 자리에 버튼만 넣는다.

> ⚠️ **이건 남의 코드를 지우는 파괴적 변경이다. 조용히 삭제하지 말 것.**
> 지우기 전에 사용자에게 **무엇을 지우는지 먼저 보고하고 확인을 받는다.** 보고할 내용:
> - 지울 대상 (예: 이메일/비번 폼, `POST /api/login` 호출, 유효성 검증 로직)
> - **함께 지워지면 안 되는 것이 있는지** — 회원가입 링크, 비밀번호 찾기, 다른 소셜 로그인
>   버튼, "자동 로그인" 체크박스 등은 별개 기능이므로 손대지 않는다.
> - 그 폼이 호출하던 API가 다른 화면에서도 쓰이는지 (쓰이면 API 코드 자체는 남겨둔다)

교체 후 남은 것이 버튼 하나뿐이라 페이지가 비어 보이더라도 **에러 표시 UI는 추가하지 않는다**
(실패는 통합 로그인 페이지가 표시 — 3번 정책).

#### 경우 ③ 기존 로그인 방식을 **유지**하고 MIMIC 로그인을 추가한다

기존 방식(예: 사내 SSO, 다른 소셜 로그인)을 계속 써야 하는 프로젝트라면 폼을 지우지 말고
"MIMIC 계정으로 로그인" 버튼을 **하나 더 추가**한다. ②와 ③ 중 어느 쪽인지 애매하면
**사용자에게 물어본다** — 이건 코드로 판단할 수 없는 정책 결정이다.

#### ★ 경로 규약 (고정) — 로그인 페이지는 **항상** `BASE_URL + /login`

| 페이지 | 경로 | 비고 |
| --- | --- | --- |
| 로그인 | `BASE_URL` + `/login` | **모든 프로젝트 동일. 예외 없음** |
| 콜백 | `BASE_URL` + `/oauth/callback` | 담당자에게 등록한 `redirect_uri`와 일치 |

**앞에 다른 세그먼트를 붙이지 않는다** (`/auth/login`, `/users/signin` 금지). 프로젝트마다
경로가 다르면 `unifiedLogin.ts`를 매번 고쳐야 하고, 담당자에게 등록한 `redirect_uri` 규약도
흐트러진다. 경로를 고정해두면 로그인 코드를 **무수정으로** 재사용할 수 있다.

**기존 로그인 페이지가 다른 경로(`/signin` 등)에 있었다면** — MIMIC 로그인 페이지는 `/login`에
두고, **옛 경로는 `/login`으로 리다이렉트만 남긴다.** 기존 링크·북마크가 살아있으면서 경로 규약도
지켜진다.

```tsx
// 예: 기존 /signin 을 쓰던 프로젝트 (wouter)
<Route path="/login"><Login /></Route>
<Route path="/signin">{() => { navigate("/login", { replace: true }); return null; }}</Route>
```

> 옛 경로를 참조하는 코드(헤더 링크, 리다이렉트, 가드 등)가 여러 곳이면 **그것들도 `/login`으로
> 바꾸는 편이 낫다.** 리다이렉트는 외부에서 들어오는 링크(북마크·메일 등)를 위한 안전망이다.

### 4.4 콜백 페이지 — `OAuthCallback.tsx`

`code` 수신 → `state` 검증 → 토큰 교환 → 쿠키 저장. **실패하면 우리 화면에 표시하지 않고, 메시지를 매핑해 통합 로그인 페이지로 리다이렉트**한다.

```tsx
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { setTokens } from "./auth";
import {
  OAUTH_STATE_KEY,
  consumePkceVerifier,
  redirectToUnifiedLogin,
  resolveErrorMessage,
} from "../lib/unifiedLogin";

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

    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    const codeVerifier = consumePkceVerifier(); // PKCE: 1회성으로 꺼내며 즉시 제거

    // ① state 검증 — 불일치면 CSRF 의심. verifier가 없어도(세션 만료 등) 동일하게 취급.
    //    통합 로그인 페이지로 되돌려 재시도.
    if (!code || !state || state !== savedState || !codeVerifier) {
      redirectToUnifiedLogin(resolveErrorMessage("oauth_failed"));
      return;
    }

    // ② 토큰 교환 — codeVerifier로 이 코드가 진짜 이 브라우저가 시작한 로그인인지 증명한다.
    fetch(`${apiBase}/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, clientId, codeVerifier }),
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
<Route path="/login"><Login /></Route>                   {/* 경로 고정 — 예외 없음 */}
<Route path="/oauth/callback"><OAuthCallback /></Route>   {/* 경로 고정 — 항상 새로 추가 */}
```

`redirect_uri`(`/oauth/callback`)와 `cancel_url`(`/login`)이 **실제 라우트와 정확히 일치해야 한다.**

- 기존 로그인 라우트가 `/signin` 등이었다면 로그인 페이지를 `/login`으로 옮기고, 옛 경로에는
  `/login`으로 가는 리다이렉트를 남긴다 (4.3의 "경로 규약"). **로그인 화면이 두 경로에 각각
  살아있게 두지 않는다** — 중복 페이지가 된다.
- `/oauth/callback`은 이 흐름에만 쓰는 새 라우트라 항상 추가한다. 같은 경로가 이미 있으면
  (드물지만) 사용자에게 알리고 어떻게 할지 확인한다.
- 라우터의 base도 `BASE_URL`과 맞춰야 서브패스 배포에서 이 라우트들이 매칭된다 (4.2.1 각주 참고).

### 4.6 세션 유지 ① — accessToken 자동 갱신 (401 인터셉터)

로그인 흐름만 구현하면 accessToken(보통 1일)이 만료됐을 때 refreshToken이 있어도 그냥
로그아웃된다. 이 절은 그걸 막는 자동 갱신을 추가한다. **선택 사항이지만, 하루 이상 켜두는
서비스라면 사실상 필수다.**

#### ★ 왜 반드시 자기 서버(백엔드)를 거쳐야 하는가

로그인(4.4)의 `/v1/auth/token`과 달리, **`/v1/auth/refresh`는 `clientSecret`을 요구한다**
(MIMIC 서버 쪽 필수 검증 — swagger 문서엔 optional로 잘못 표기돼 있을 수 있으니 실제
호출로 확인할 것). `clientSecret`은 절대 브라우저에 넣을 수 없으므로(1번 참고), **이
갱신 요청만은 브라우저가 MIMIC을 직접 부르지 않고 이 프로젝트의 자기 백엔드를 거쳐야 한다.**

다행히 어렵지 않다 — 4.1의 `setTokens`가 이미 `refreshToken`을 **일반 쿠키**(httpOnly 아님,
우리 JS가 직접 관리)로 저장해뒀다. 그래서 브라우저는 자기 도메인의 백엔드 엔드포인트를
같은 origin으로 호출하기만 하면 되고(별도 설정 없이 쿠키가 자동으로 실린다), **그 백엔드가**
그 쿠키 값을 MIMIC의 실제 `/v1/auth/refresh`에 `Cookie` 헤더로 수동 구성해 서버 간
전달하면서 `clientSecret`을 붙인다. 브라우저는 MIMIC의 쿠키 정책을 신경 쓸 필요가 전혀 없다.

**Claude 판단 (사용자에게 묻지 않는다, 코드로 확인)**: 이 프로젝트에 이미 백엔드(Express/
Fastify/Next API Route 등)가 있는지 `package.json`/API 라우트 폴더로 확인한다.
- **있으면** → 거기에 라우트 하나만 추가한다 (아래 4.6.1).
- **완전히 없다면**(정적 사이트뿐) → 이건 코드로 판단할 수 없는 정책 결정이라 사용자에게
  묻는다: "자동 갱신 기능은 서버가 있어야 구현할 수 있는데 지금 이 프로젝트엔 서버가 없습니다.
  ① 작은 서버를 새로 만들지, ② 자동 갱신 없이(accessToken 만료 시 재로그인) 갈지 정해주세요."
  이건 비개발자도 이해하고 답할 수 있는 질문이다 (0.2 원칙에 어긋나지 않음).

> ⚠️ **백엔드가 있어도, 그게 실제로 배포돼 인터넷에 떠 있는지 별도로 확인한다.** 로컬
> `pnpm dev` 등으로만 띄우는 서버라면 이 갱신 기능은 **로컬에서만 동작**하고 실제 배포
> 환경에선 조용히 작동하지 않는다. 배포 여부는 CI 설정 파일(`.github/workflows/*.yml`,
> `Dockerfile`, `fly.toml`, `render.yaml` 등)로 확인하고, 확인 안 되면 사용자에게 "이
> 백엔드가 실제로 어디에 배포돼 있나요?"라고 물어본다 — 이것도 비개발자가 답할 수 있는
> 질문이다(자기 서비스가 어디서 도는지는 알거나, 담당 개발자에게 물어볼 수 있음).

#### 4.6.1 백엔드 — refresh 라우트 (Express 예시)

```ts
// 기존 백엔드에 라우트 하나만 추가. 프레임워크가 다르면 개념은 동일 —
// "쿠키에서 refresh_token 읽기 → clientSecret과 함께 MIMIC에 서버 간 전달 → 응답 relay".
router.post("/auth/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ code: "40110" }); // EMPTY_REFRESH_TOKEN — MIMIC 호출 없이 즉시 반환
    return;
  }
  try {
    const upstream = await fetch(`${process.env.MIMIC_API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 서버 간 호출이라 브라우저 쿠키 정책과 무관 — Cookie 헤더를 직접 구성해도 된다.
        Cookie: `refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({
        clientId: process.env.MIMIC_CLIENT_ID,
        clientSecret: process.env.MIMIC_CLIENT_SECRET, // 서버 전용 env — 프론트 .env엔 절대 없음
      }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) { res.status(upstream.status).json(data); return; }
    res.json(data); // { accessToken } — MIMIC은 refresh 응답에 새 refreshToken을 주지 않는다
  } catch {
    res.status(502).json({ error: "refresh failed" });
  }
});
```

**필요한 선행 작업 (Express 기준 — 다른 프레임워크면 그 프레임워크의 동급 기능으로):**
- 이 백엔드가 `.env` 파일을 실제로 읽는지 먼저 확인한다. `dotenv` 같은 라이브러리 호출이
  코드에 없으면 `.env`에 값을 적어도 `process.env`엔 안 들어온다 — **흔히 빠뜨리는 지점이다.**
- 쿠키 파싱 미들웨어(Express면 `cookie-parser`)가 등록돼 있는지 확인, 없으면 추가한다.
  `req.cookies`가 계속 `undefined`라면 이게 원인이다.

#### 4.6.2 프론트 — 401 인터셉터

공통 fetch 래퍼(이 문서의 4.1~4.4에서 쓰는 것과 같은 함수)에 갱신 로직을 추가한다.

```ts
let inFlightRefresh: Promise<boolean> | null = null;

/** 동시에 여러 곳에서 호출돼도 실제 요청은 하나만 나가도록 single-flight로 묶는다. */
export function refreshAccessToken(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = doRefresh().finally(() => { inFlightRefresh = null; });
  return inFlightRefresh;
}

async function doRefresh(): Promise<boolean> {
  try {
    // 상대경로 고정 — 이 fetch 래퍼의 다른 baseUrl 설정(MIMIC 직접 호출용)과 절대 공유하지
    // 않는다. 공유하면 나중에 그 baseUrl이 바뀔 때 이 호출이 엉뚱한 곳(MIMIC 도메인)으로 샌다.
    const res = await fetch("/api/auth/refresh", { method: "POST" }); // same-origin → 쿠키 자동 첨부
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (data as { code?: string } | null)?.code;
      if (code === "40110" || code === "40107" || code === "40108") {
        clearTokens(); // 재로그인 필요 — 4.1의 clearTokens
        window.dispatchEvent(new CustomEvent("mimic:signed-out"));
      } else if (code === "40104") {
        console.error("[auth] clientId/clientSecret 설정 오류 — 서버 env 확인 필요", data);
      }
      return false;
    }
    setTokens((data as { accessToken: string }).accessToken); // 4.1의 setTokens, 2번째 인자 생략 → refresh 쿠키는 그대로 유지
    return true;
  } catch {
    return false;
  }
}

// 기존 fetch 래퍼 안에서:
//   응답이 401이고, 이 요청 자체가 /api/auth/refresh가 아니라면
//     → refreshAccessToken() 호출 → 성공 시 원 요청을 동일 옵션으로 1회만 재시도
//     → 실패 시 기존처럼 에러 처리
```

> **왜 만료 전에 미리 갱신하는 타이머를 안 두는가**: 검토는 했지만 뺐다. 401 인터셉터
> 하나만으로도 정상 동작에 문제없고(만료된 요청 하나가 "401→갱신→재시도"로 한 번 더
> 왕복하는 정도), 방치된 탭에서도 계속 도는 별도 타이머보다 단순하다. 다시 추가하지 말 것.

### 4.7 세션 유지 ② — 밴(정지) 감지 heartbeat

계정이 정지되면 accessToken 자체는 아직 안 만료됐을 수 있어서 401 인터셉터로는 못 잡는다
(만료가 아니라 계정 상태 문제라서). 그래서 별도로 주기적으로 확인해야 한다.

`clientSecret`이 필요 없는 호출이라 (로그인의 `/v1/auth/token`과 동일하게) **브라우저가
MIMIC을 직접 호출**한다 — 4.6과 달리 백엔드를 거치지 않는다.

```ts
const BAN_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간 고정. 로그인 상태인 동안 무조건.

async function checkSession(): Promise<"ok" | "invalid" | "banned"> {
  const token = /* 4.1의 쿠키에서 accessToken 읽기 */;
  if (!token) return "invalid"; // 로그아웃 상태면 호출 자체를 안 한다

  const res = await fetch(`${MIMIC_API_URL}/v1/auth/check?token=${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${token}` }, // query param + 헤더 둘 다 보낸다
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = (data as { code?: string } | null)?.code;
    return code === "400026" ? "banned" : "invalid"; // 밴 코드는 실제 호출로 재확인할 것 — 아래 참고
  }
  return data === true ? "ok" : "invalid"; // 200 + false는 무시(로그아웃 안 시킴) — 401 인터셉터가 처리
}

function forceLogoutForBan(): void {
  /* 4.1의 clearTokens() */
  window.dispatchEvent(new CustomEvent("mimic:signed-out"));
  // 고정 경로 규약: BASE_URL + /login (4.3의 "경로 규약")으로 하드 리다이렉트
}

setInterval(async () => {
  if (!/* accessToken 쿠키 존재 여부 */) return; // 로그아웃 상태면 건너뜀 — 요청 자체가 안 나감
  if ((await checkSession()) === "banned") forceLogoutForBan();
}, BAN_CHECK_INTERVAL_MS);
```

> ⚠️ **밴 응답의 실제 status/body 형태는 이 문서 작성 시점에 swagger로 확인이 안 됐다**
> (해당 엔드포인트의 에러 응답이 문서화돼 있지 않았음). 위 `400026` 판별은 백엔드 팀이 준
> 명세 기준 추정값이다. 실제 밴 계정으로 한 번 호출해보고 실제 값과 다르면 이 판별 조건만
> 고치면 된다. 다만 **밴 계정 여부를 확인하려고 DB를 뒤지거나 사용자에게 캐묻지 말 것** —
> 이건 0.2 원칙에 해당한다. 검증 안 됐으면 검증 안 됐다고 남기고 넘어간다.

> **번들러가 HMR(Hot Module Replacement)을 지원하면**(Vite의 `import.meta.hot.dispose` 등),
> 이 `setInterval`을 dispose 훅에서 정리하도록 등록해둔다. 안 그러면 개발 중 이 파일을 고칠
> 때마다 interval이 중복으로 쌓여, 실제로는 정상인데 로그인 상태에서 heartbeat가 여러 개
> 동시에 도는 것처럼 보이는 혼란이 생긴다 (실제로 겪은 증상). 프로덕션 빌드엔 HMR이 없으니
> 영향 없다 — 스택이 HMR을 안 쓰면 생략해도 무방하다.

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

- [ ] **배포 위치를 확인했는가** — 설정 파일로 판별했거나 사용자에게 물어봤음 (근거 없이 `/`로 단정하지 않았음 — 0.1의 A-3)
- [ ] 배포 대상에 맞게 `vite.config.ts`의 `base` 값 설정 확인 (GitHub Pages project repo면 `/repo-이름/`, 그 외 대부분 `/` — 4.2.1 참고)
- [ ] `.env`에 4개 값(`VITE_UNIFIED_LOGIN_URL`, `VITE_MIMIC_API_URL`, `VITE_MIMIC_CLIENT_ID`, `VITE_SERVICE_NAME`) 채움 — `clientSecret`은 필요 없음
- [ ] 프로젝트 성격(직원용/유저용)에 맞는 clientId를 담당자에게 확인받아 입력 (관례로 추측한 값 금지)
- [ ] `service_name`이 하드코딩이 아니라 `VITE_SERVICE_NAME`에서 오는지 확인 (다른 프로젝트 이름이 남아있으면 안 됨)
- [ ] 최종 `redirect_uri`(= `origin + base + /oauth/callback`)를 MIMIC 인증팀에 등록 요청 완료
- [ ] 로그인 페이지 처리 확인 — 없으면 새로 만들고 **진입점(헤더 로그인 버튼)까지** 추가했는지 / 있으면 교체·추가 여부를 사용자에게 확인받았는지 (4.3)
- [ ] 로그인 페이지가 **`BASE_URL + /login`** 에 있는지 (`/auth/login` 같은 추가 세그먼트 없음, `LOGIN_PATH`/`CALLBACK_PATH` 상수를 수정하지 않았음)
- [ ] 기존 로그인 경로가 있었다면 옛 경로 → `/login` 리다이렉트를 남겼는지 (로그인 화면이 두 곳에 중복되지 않았는지)
- [ ] `/login` + `/oauth/callback` 라우트 등록
- [ ] 로그인 버튼 클릭 → 통합 로그인 페이지로 이동, 리다이렉트 URL에 `code_challenge`/`code_challenge_method=S256`이 포함됨
- [ ] 로그인 버튼 클릭 직후 sessionStorage에 `code_verifier`(43자 base64url)가 저장됨
- [ ] 인증 후 `/oauth/callback` 복귀 → 토큰 교환 요청 body에 `codeVerifier`가 포함됨 (Network 탭 확인)
- [ ] sessionStorage에 verifier가 없는 상태로 `/oauth/callback?code=...&state=...`에 직접 진입 시 토큰 교환을 시도하지 않고 통합 로그인 페이지로 되돌아감
- [ ] 실패 케이스에서 통합 로그인 페이지로 `error` 파라미터와 함께 리다이렉트됨 (우리 앱에 에러 UI 없음)
- [ ] 통합 로그인 페이지가 `error`를 받으면 **자동 재로그인하지 않고 멈춰서 표시**하는지 확인 (무한 리다이렉트 방지)
- [ ] **(비개발자가 직접 확인)** 실제 MIMIC 계정으로 로그인 성공 → 홈으로 이동 + `accessToken` 쿠키 저장 확인. 직원 전용 앱이면 일반 계정으로 시도 시 `400119` 메시지가 뜨는지도 확인. **Claude는 이 항목을 대신 확인하려 하지 않는다 — 계정/DB를 찾지 않는다 (0.2 참고).**

**accessToken 자동 갱신 + 밴 heartbeat를 구현했다면 (4.6/4.7, 선택):**

- [ ] 백엔드에 `.env` 로딩(`dotenv` 등) + 쿠키 파싱 미들웨어(`cookie-parser` 등)가 실제로 등록돼 있는지 확인 (없으면 `MIMIC_CLIENT_SECRET`이 항상 빈 값으로 읽힘)
- [ ] `MIMIC_CLIENT_SECRET`이 서버 전용 env에만 있고 `VITE_` 접두사 변수·프론트 코드 어디에도 없는지 확인
- [ ] 이 백엔드가 실제로 배포돼 있는지, 배포 안 됐다면(로컬 전용) 그 사실을 사용자에게 명확히 남겼는지
- [ ] accessToken을 강제로 만료시킨 뒤 아무 API 호출 → 자동으로 `/api/auth/refresh` 갱신 후 원 요청이 1회 재시도되는지 (Network 탭)
- [ ] `refresh_token` 쿠키가 없는 상태로 갱신 트리거 → 재로그인 필요 처리(`mimic:signed-out`)로 이어지는지
- [ ] 밴 heartbeat가 로그아웃 상태에선 아예 요청을 안 보내는지 (로그아웃 직후 잠깐의 "막차" 요청 한두 개는 정상 — 계속 반복되면 버그)
- [ ] **(비개발자가 직접 확인)** 실제 밴 계정으로 heartbeat가 실제로 강제 로그아웃시키는지. **Claude는 밴 계정을 찾거나 만들려 하지 않는다.**

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
| 토큰 교환 시 `INVALID_LOGIN_CODE`/verifier 관련 에러 | 서버가 기대하는 PKCE 필드명이 이 문서의 가정(`code_challenge`/`code_challenge_method`/`codeVerifier`)과 다를 수 있다. MIMIC 인증 서버 스펙(Swagger 등)에서 실제 필드명을 확인해 4.2/4.4의 키 이름만 맞추면 된다. |
| `crypto.subtle`가 `undefined` | Web Crypto의 `subtle`은 secure context(HTTPS 또는 `localhost`)에서만 동작한다. HTTP로 배포된 non-localhost 환경에서 테스트하면 발생 — HTTPS로 접속해 확인. |
| 로그인 페이지가 리다이렉트를 거부 / `redirect_uri` 관련 에러 | 우리가 보낸 `redirect_uri`가 MIMIC 인증 서버 허용 목록에 없음. 4.2.1의 최종 값을 인증팀에 등록 요청. 로컬 개발용 `http://localhost:<포트>/oauth/callback`도 별도로 등록해야 할 수 있다. |
| 로그인 페이지에 다른 서비스 이름이 표시됨 | `service_name`을 하드코딩한 채로 복붙한 것. `VITE_SERVICE_NAME`에서 읽도록 수정 (4.2). |
| `/api/auth/refresh`에서 `clientSecret`이 항상 빈 값/오류 | 백엔드가 `.env`를 실제로 읽는 코드(`dotenv` 등)가 없는 경우가 흔하다. `.env` 파일에 값을 적었다고 자동으로 `process.env`에 들어오지 않는다 — 4.6.1의 "필요한 선행 작업" 참고. |
| `/api/auth/refresh`에서 `req.cookies`가 `undefined` | 쿠키 파싱 미들웨어(`cookie-parser` 등) 미등록. 4.6.1 참고. |
| 갱신 요청이 MIMIC 도메인(404)으로 나감 | `refreshAccessToken()`이 공통 fetch 래퍼의 공유 baseUrl 로직(MIMIC 직접 호출용)을 타버린 것. 4.6.2처럼 이 호출만 상대경로로 고정해 분리해야 한다. |
| 로그인 검증 도중 "테스트 계정이 DB에 있는지 확인이 안 된다"는 식의 막힘 | **이건 질문하면 안 되는 것이다.** 0.2 참고 — 실제 로그인 성공 여부는 비개발자가 직접 확인할 몫이지 Claude가 계정/DB를 뒤져서 뚫을 일이 아니다. 여기까지 코드가 맞다는 것만 확인하고 넘어간다. |
| 밴 heartbeat가 로그아웃 후에도 계속 도는 것처럼 보임 | 개발 중 이 파일을 직접 고칠 때 HMR로 모듈이 재평가되면서 이전 `setInterval`이 정리 안 돼 중복으로 쌓인 경우가 실제로 있었다. 4.7의 HMR dispose 등록 여부 확인. 로그아웃 직후 "막차" 요청 한두 개는 타이밍상 정상. |
| 밴 감지가 안 됨 (계정이 밴돼도 그냥 로그인 상태 유지) | `checkSession()`의 밴 판별 조건(`400026` 등)이 실제 MIMIC 응답과 다를 수 있다 (swagger에 이 엔드포인트 에러가 문서화 안 돼 있었음). 4.7의 경고 참고 — 실제 값 확인은 비개발자/백엔드 담당자를 통해서 하고, DB를 직접 뒤지지 않는다. |

---

## 8. 이 모노레포(@hh/*)에서 쓸 때의 차이

`holdem-hub` 내부에서는 위 유틸이 이미 공통 패키지로 존재하므로 새로 만들 필요 없다:

- `setTokens` / `clearTokens` → `@hh/shared`의 `packages/shared/src/auth/mimic.ts`
- fetch 래퍼 `apiFetch` / `ApiError` → `@hh/shared`의 `packages/shared/src/api/client.ts`
- 통합 로그인 헬퍼 + 에러 매핑 (`redirectToUnifiedLogin` / `resolveErrorMessage` / `ERROR_MESSAGES`) → `apps/hub/src/lib/unifiedLogin.ts`
- 로그인/콜백 페이지 → `apps/hub/src/pages/Login.tsx`, `OAuthCallback.tsx`
- 이 레포의 `apiFetch`는 baseUrl을 자동 결정하므로, 토큰 교환은 `apiFetch<TokenResponse>("/v1/auth/token", …)`로 호출하고 실패 시 `err instanceof ApiError`로 분기해 `ApiError.data`의 `code`/`failReason`을 `resolveErrorMessage`에 넘긴다.
- `VITE_SERVICE_NAME`은 `.env.example`에 정의돼 있고, hub는 미설정 시 `"플레이랩"`으로 폴백한다
  (`VITE_MIMIC_CLIENT_ID`가 `"mimic-web"`으로 폴백하는 것과 같은 패턴).
- **accessToken 자동 갱신(4.6)** → `packages/shared/src/api/client.ts`의 `refreshAccessToken`
  (single-flight) + `apiFetch`의 401 처리. 백엔드 라우트는 `services/api/src/routes/auth.ts`의
  `POST /refresh` (기존 `POST /token`과 같은 파일). `services/api`가 `.env`를 실제로 읽도록
  `dotenv`(`src/index.ts` 최상단 `import "dotenv/config"`)와 `cookie-parser`(`app.ts`)를
  이 작업에서 함께 추가했다 — 전에는 이 서버에 `.env` 로딩 코드 자체가 없었다.
- **밴 감지 heartbeat(4.7)** → `packages/shared/src/auth/session.ts`(신규 파일)의 `checkSession`
  / `startSessionKeepAlive`. `packages/shared/src/auth/resolver.ts`의 `mimic` provider 활성화
  분기에서 1회 호출.
- ⚠️ **`services/api`는 이 저장소에서 현재 어디에도 배포돼 있지 않다** (`.github/workflows/deploy.yml`은
  `apps/hub`만 GitHub Pages에 배포). 즉 accessToken 자동 갱신은 로컬 dev에서만 동작하고,
  스테이징/운영에 반영하려면 `services/api`를 배포하는 별도 인프라 작업이 먼저 필요하다.
- 검토 후 뺀 설계: exp 임박 시 미리 갱신하는 proactive 타이머는 만들지 않는다. 401 인터셉터
  하나로 충분하다고 판단했다 (4.6.2 참고) — 다시 추가하지 말 것.
