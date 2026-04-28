# Phase 1.5 — 웹에서 Gemini API 키 설정 (LocalStorage)

`.env`를 만지지 않고도 브라우저 `/settings` 페이지에서 Gemini API 키를 입력·저장·테스트할 수 있도록 함.

## Base
- 🧱 **Base**: `feat/phase-1-ui` (PR #2 위에 스택)
- main 직접 머지 시 PR#1 / PR#2 / 본 PR 변경이 합쳐짐

## 설계 의도 (왜 LocalStorage?)
- **개인용 단일 인스턴스 가정** — 여러 사용자나 디바이스 간 동기화 불필요
- 키가 서버 DB에 남지 않음 → 백업·로그·덤프 노출 위험 없음
- 마이그레이션·테이블 추가 불필요
- 단점: 브라우저마다 다시 입력 / 시크릿 모드·캐시 정리 시 사라짐 (개인용으로 수용 가능)

DB 저장 + env fallback 방식은 의도적으로 선택하지 않음.

## 키 우선순위
```
1. 요청 body의 apiKey  (브라우저 LocalStorage에서 옴)
       ↓ 없으면
2. process.env.GEMINI_API_KEY  (서버 환경변수 fallback)
       ↓ 없으면
3. summarize → 단순 변환 폴백 (warning 표시)
   summarize-live → 503 (라이브 요약은 키 필수)
```

## 변경 파일

### 신규
- `src/lib/api-keys.ts` — `resolveGeminiApiKey()`, `isEnvKeyConfigured()`
- `src/lib/api-key-storage.ts` — `getStoredApiKey`, `setStoredApiKey`, `clearStoredApiKey`, `maskApiKey`
- `src/app/api/settings/status/route.ts` — 환경변수 키 존재 여부만 노출 (값 X)
- `src/app/api/settings/test/route.ts` — 키로 짧은 Gemini 호출 → 결과 분류
- `src/app/settings/page.tsx` — 입력/저장/삭제/테스트 UI
- `src/__tests__/api-keys.test.ts` — 7 tests
- `src/__tests__/api-key-storage.test.ts` — 7 tests

### 수정
- `src/app/api/summarize/route.ts` — `body.apiKey` 수용, 키 없을 시 단순 변환 폴백
- `src/app/api/summarize-live/route.ts` — `body.apiKey` 수용
- `src/hooks/useLiveSummary.ts` — 매 요청 시 LocalStorage 키 첨부
- `src/app/page.tsx` — generateMinutes에 LocalStorage 키 첨부 + 헤더에 ⚙️ 링크
- `README.md` / `docs/ROADMAP.md`

## UX

### 설정 페이지 (`/settings`)
- 현재 키 소스 배지: `브라우저 (LocalStorage)` / `환경변수 (서버)` / `없음`
- 마스킹된 현재 키 표시 (`AIza••••XYZ12`)
- 입력 필드 (보이기/숨기기 토글)
- 버튼: 💾 저장, 🧪 테스트 호출, 🗑️ 삭제
- 테스트 결과: ✓ 정상 / ✗ 401·403·429 등 분류된 메시지
- Google AI Studio 무료 발급 링크

### 안전장치
- 키 GET 응답에서 절대 풀 키 노출 안 함
- 테스트 호출은 `"OK"` 단어 한 개만 요청 → 토큰 거의 안 씀
- HTTPS 권장 안내 (localhost는 예외)

## 테스트
- 단위 테스트 14개 추가 (서버 헬퍼 7 + LocalStorage 7)
- 전체: **94 tests passing**

## 확인 방법
```bash
docker compose up -d --build app
```
1. `http://localhost:3000` → 헤더 `⚙️ 설정`
2. 키 입력 → 💾 저장 → 마스킹된 키가 "현재 키 소스 = 브라우저"로 표시
3. 🧪 테스트 호출 → "키가 정상적으로 동작합니다." + Gemini 응답 미리보기
4. 홈으로 돌아가 녹음 → Gemini 요약이 LocalStorage 키로 동작
5. 🗑️ 삭제 → 환경변수 fallback (있으면) 또는 단순 변환으로 자동 전환

## Breaking changes
없음. 기존 `.env` 사용자는 변경 없이 동작.

## 후속 (이 PR 범위 아님)
- 다중 키 (예: OpenAI 키 추가) — 동일 패턴으로 확장 가능
- 키 로테이션 알림 — Google이 만료 정책 도입 시
