# 🔒 Security

이 문서는 Meeting Minutes의 **위협 모델, 알려진 한계, 안전한 사용 방법**을 정리합니다. 보안 취약점을 발견했다면 [신고 방법](#-취약점-신고)을 참고해주세요.

---

## 📑 목차

- [위협 모델](#-위협-모델)
- [신뢰 모델](#-신뢰-모델)
- [데이터 흐름과 외부 송출](#-데이터-흐름과-외부-송출)
- [구현된 보안 조치](#-구현된-보안-조치)
- [알려진 한계](#-알려진-한계)
- [배포 권장 사항](#-배포-권장-사항)
- [취약점 신고](#-취약점-신고)

---

## 🎯 위협 모델

이 프로젝트는 **개인용 단일 인스턴스**를 가정합니다. 위협 모델은 다음과 같습니다:

### In-scope (방어 대상)
- 같은 LAN/Wifi에 있는 다른 사용자가 사용자의 노트북에 접근하는 시나리오
- 공유 PC에서 잠시 자리를 비웠을 때 다른 사람이 데이터에 접근하는 시나리오
- 마크다운에 삽입된 악성 HTML/스크립트로 인한 XSS
- 클라이언트가 보낸 비정상 입력 (큰 텍스트, 잘못된 MIME 등)

### Out-of-scope (방어하지 않음)
- **다중 사용자 / 인증** — 단일 사용자 가정으로 인증 시스템 미구현
- **호스트 OS / 디스크 암호화** — 운영체제와 디스크 암호화 설정에 위임
- **클라우드 환경 배포** — localhost 전용으로 설계됨
- **물리적 접근 통제** — 사용자 PC에 대한 물리적 보안

---

## 🔐 신뢰 모델

| 신뢰 수준 | 항목 |
|---|---|
| **신뢰** | 호스트 OS, Docker, 사용자가 발급한 Gemini API 키, npm 패키지 (`marked`, `DOMPurify`, Prisma 등) |
| **반신뢰** | 사용자 입력 transcript / markdown (DOMPurify로 sanitize) |
| **신뢰 안 함** | 같은 네트워크의 다른 장치, 외부 HTTP 요청, Web Speech API 결과 |

---

## 📡 데이터 흐름과 외부 송출

| 데이터 | 저장 위치 | 외부 송출 |
|---|---|---|
| 회의 transcript / 회의록 | PostgreSQL (`meetings.markdownMinutes`, `rawTranscript`) | AI 요약 활성화 시 transcript가 **선택한 프로바이더**로 전송 |
| 액션 아이템 | PostgreSQL (`action_items`) | 외부 송출 없음 |
| API 키 | 브라우저 LocalStorage 또는 `.env` | 요청 시 선택한 프로바이더에만 전송 |
| 음성 데이터 | 메모리 (실시간), `/app/uploads` (파일 업로드) | **Chrome Web Speech API → Google 서버** ⚠️ |

### ⚠️ 주의: Web Speech API의 음성 외부 전송

Chrome의 `SpeechRecognition` API는 **음성 데이터를 Google 서버로 전송하여 처리**합니다. 이는 Chrome 자체의 동작이며 우리 서버를 경유하지 않습니다. 다음의 경우 사용을 재고하세요:

- 회의가 회사 기밀, 인사 정보, 환자 정보 등을 포함
- 사내 컴플라이언스 정책이 외부 클라우드 음성 전송을 금지
- GDPR / HIPAA 등 규제 환경

이 경우 **파일 업로드 탭**도 같은 한계가 있으므로(현재 업로드 후 전사는 미구현, Phase 4에서 자체 STT 검토 예정), 이 도구의 사용을 보류하는 것을 권장합니다.

### 🔴 주의: 서버 전사(STT)는 회의 **원음**을 외부로 보냅니다

"원본 오디오로 다시 전사" 또는 파일 업로드 전사를 실행하면, 회의 오디오 파일이
**통째로** 선택한 프로바이더 서버로 전송됩니다.

이것은 이 앱에서 가장 민감도가 높은 데이터 흐름입니다. 전사 텍스트는 Web Speech가
대부분 놓치지만, **오디오에는 회의에서 오간 모든 말과 목소리가 그대로 담겨 있습니다.**

| 프로바이더 | 오디오가 가는 곳 |
|---|---|
| Gemini | Google 서버 |
| OpenAI | OpenAI 서버 |
| OrcaRouter 등 중계 | 중계사 → 실제 모델 제공사 (2단계) |
| **로컬 whisper** | **나가지 않음** (whisper.cpp / faster-whisper 등을 `LLM_BASE_URL`로 지정) |

**외부 전송이 곤란한 회의라면 로컬 whisper 서버를 쓰세요.** 설정 → 프로바이더에서
"로컬 모델"을 고르고 base URL을 로컬 whisper 엔드포인트로 지정하면 오디오가
머신 밖으로 나가지 않습니다.

전사는 사용자가 버튼을 눌러야만 실행됩니다. 녹음만으로는 오디오가 전송되지 않습니다.

### ⚠️ 주의: AI 프로바이더 선택에 따른 전송 경로

`/settings`에서 고른 프로바이더에 따라 **회의 전문이 지나가는 회사가 달라집니다.**

| 선택 | transcript를 보게 되는 주체 |
|---|---|
| Google Gemini (기본) | Google |
| OpenAI | OpenAI |
| OrcaRouter 등 중계 라우터 | **라우터 운영사 + 라우터가 고른 실제 모델 제공사** (2단계) |
| 로컬 모델 (Ollama / LM Studio / vLLM) | **없음** — 요청이 내 머신 밖으로 나가지 않음 |

- 중계 라우터는 요청을 대신 전달하는 구조상 **평문 프롬프트를 볼 수 있는 주체가 한 곳 늘어납니다.** 로깅·보관 정책은 각 서비스 약관을 직접 확인하세요.
- 사내 컴플라이언스가 외부 전송을 제한한다면 **로컬 모델** 프리셋을 사용하세요.

### base URL은 서버가 대신 호출합니다 (SSRF 주의)

OpenAI 호환 프리셋의 base URL은 브라우저가 아니라 **Next.js Route Handler(서버)** 가 fetch 합니다.

- `http` / `https` 스킴만 허용합니다 (`normalizeBaseUrl`).
- 그 외 호스트 제한은 없습니다. 이 앱은 `127.0.0.1` 단일 사용자 실행을 전제로 하므로 의도된 설계이지만,
  **앱을 LAN이나 인터넷에 노출하면 요청자가 서버 내부망 주소를 base URL로 넣어 스캔할 수 있습니다.**
- 노출 배포가 필요하다면 리버스 프록시에서 egress를 제한하거나, `LLM_BASE_URL`을 환경변수로 고정하고
  요청 body의 `baseUrl`을 무시하도록 수정하세요.

---

## ✅ 구현된 보안 조치

### 인프라
- **Postgres 포트 미노출** — `db` 컨테이너는 `app`만 내부 네트워크로 접근, 호스트 포트 안 열림
- **App 포트 localhost 바인딩** — `127.0.0.1:3000` (LAN의 다른 장치는 접근 불가)
- **DB 비밀번호 fallback 제거** — `.env`에서 명시적으로 설정해야 docker-compose 시작됨
- **Prisma adapter 사용** — Prisma 7 `@prisma/adapter-pg`로 안전한 PostgreSQL 연결

### 응답 헤더
`next.config.ts`에서 다음 헤더 적용:
- `X-Content-Type-Options: nosniff` — MIME sniffing 차단
- `X-Frame-Options: DENY` — 클릭재킹 방지
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=(), interest-cohort=()`

### 입력 검증
- **마크다운**: `marked` → `isomorphic-dompurify` 통과
  - `USE_PROFILES: { html: true }`
  - `FORBID_TAGS: ['style']`, `FORBID_ATTR: ['style']`
  - `<script>`, `onerror=`, `javascript:` URL 등 제거
- **/api/summarize**: transcript 100,000자 상한, 초과 시 413
- **/api/summarize-live**: transcript 40,000자 상한 (뒤쪽만 사용)
- **파일 업로드**: 500MB 상한, MIME allowlist (단, [한계](#-알려진-한계) 참고)

### API 키 보호
- `/api/settings/status`: 키 존재 여부만 응답 (값 노출 X)
- `/api/settings/test`: 401/403/429 분류, 업스트림 응답 본문을 그대로 돌려주지 않음
- 키는 GET 요청에 절대 포함 안 함 (body 전송만)
- `maskApiKey()`: UI에 표시 시 `AIza••••XYZ12` 형태로 마스킹
- Gemini는 `x-goog-api-key` 헤더, OpenAI 호환은 `Authorization: Bearer` 헤더 — **키를 URL에 넣지 않음** (로그/리퍼러 유출 방지)

---

## ⚠️ 알려진 한계

### MEDIUM — 인증 부재
**현황**: `/api/*` 엔드포인트에 인증이 없습니다. `127.0.0.1:3000` 바인딩으로 LAN 노출은 차단되지만, 같은 머신의 다른 사용자나 잠금 해제된 PC에서는 접근 가능합니다.

**완화**:
- 1인 1머신 + 잠금 해제 시 PC를 떠나지 않음
- 추가 보호가 필요하면 reverse proxy(nginx, Caddy)에 Basic Auth 추가
- 회사 환경에서는 SSO 통합이 필요하지만 현재 비목표

### MEDIUM — 회의 원음이 디스크에 평문으로 남습니다

**현황**: 실시간 녹음을 시작하면 회의 오디오 원본이 `uploads/recordings/`에 저장됩니다
(Docker에서는 `uploads` 볼륨). 암호화하지 않은 평문 오디오이며, 회의에서 오간
말이 그대로 들어 있습니다. **전사 텍스트보다 민감도가 높습니다** — 텍스트는
Web Speech가 대부분 놓치지만 오디오에는 전부 남습니다.

이 저장은 의도된 설계입니다. Web Speech의 포착률이 낮아(실측 10% 안팎) 원음을
남기지 않으면 놓친 발화를 복구할 방법이 없습니다.

**완화**:
- 디스크 암호화(FileVault / BitLocker)가 켜진 머신에서 운용
- 불필요해진 녹음은 `uploads/recordings/`에서 직접 삭제
- `RECORDINGS_DIR` 환경변수로 저장 위치를 별도 암호화 볼륨으로 지정 가능
- 녹음 파일 자동 만료/삭제는 **미구현** — 수동 관리가 필요합니다

**세션 ID 추측**: 녹음 조회·추가 API는 128비트 난수 ID만으로 접근을 가릅니다.
인증이 없으므로, 같은 머신에서 앱에 접근 가능한 주체는 ID를 알면 오디오를
내려받을 수 있습니다. 단일 사용자 로컬 실행 전제입니다.

### MEDIUM — 파일 업로드 매직 바이트 미검증
**현황**: `audio-validation.ts`는 `file.type`(클라이언트 제공)과 파일명 확장자만 검사. 매직 바이트 검증 없음.

**완화**: 업로드된 파일은 현재 어디에도 서빙되지 않으며 Phase 4까지 활용되지 않음. 디스크에 저장만 됨.

### MEDIUM — 서버 측 레이트 리미팅 부재
**현황**: 클라이언트 측에 백오프/쿨다운은 있으나 서버는 IP당 요청 수 제한 없음.

**완화**:
- localhost 바인딩으로 외부 abuse 차단
- Gemini 호출은 사용자 본인 키로 본인 quota 소진 → 본인 비용

### LOW — npm audit moderate 6건
**현황**:
- `@hono/node-server`, `hono`, `postcss` (모두 dev 의존성)
- 프로덕션 번들 미포함, 실제 공격 가능성 낮음

**완화**: 정기적으로 `npm audit fix` 실행

### LOW — LocalStorage 키 노출
**현황**: 브라우저 개발자 도구로 `localStorage.getItem('meeting-minutes:gemini-api-key')` 실행 시 키 노출.

**완화**: 동일 출처 정책으로 다른 사이트에서 접근 불가. 사용 후 🗑️ 삭제 버튼으로 즉시 제거.

---

## 🚀 배포 권장 사항

### ✅ 권장 (개인용)
```bash
# 강력한 비밀번호로 .env 작성
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env

# 로컬 머신에서만 접근
docker compose up -d
# → 127.0.0.1:3000 (LAN 노출 X)
```

### ⚠️ 비권장 (현재 미구현 보안 통제 필요)
- 클라우드 인스턴스(EC2, GCP 등) 배포
- 회사 LAN의 공용 서버 배포
- HTTPS 없이 외부 도메인에 노출

### 🔧 추가 보호 (선택)
**Reverse proxy + Basic Auth** (예: Caddy)
```caddyfile
meeting.example.com {
  basic_auth {
    user $2a$14$...  # bcrypt 해시
  }
  reverse_proxy 127.0.0.1:3000
}
```

**VPN 뒤에서만 접근**: 회사 VPN/Tailscale 등 + 호스트 IP 제한

**디스크 암호화**: macOS FileVault, Linux LUKS, Windows BitLocker

---

## 🚨 취약점 신고

보안 취약점을 발견하면:

1. **공개 이슈 X** — GitHub Issues에 공개로 올리지 마세요
2. 메인테이너에게 직접 연락 또는 [GitHub Security Advisory](https://github.com/nad4-su/meeting-minutes/security/advisories) 사용
3. 다음을 포함:
   - 영향받는 버전 / 컴포넌트
   - 재현 방법
   - 영향 범위
   - 가능한 완화책

응답 시간 목표: **72시간 이내 1차 응답**.

---

## 📚 참고

- [위협 모델 OWASP](https://owasp.org/www-community/Threat_Modeling)
- [DOMPurify 보안 가이드](https://github.com/cure53/DOMPurify/wiki)
- [Next.js 보안 헤더](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

---

**최종 업데이트**: 2026-04-28
