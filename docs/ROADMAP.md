# Meeting Minutes — ROADMAP

노션의 AI Meeting Notes 기능을 참고한 단계별 개발 계획. 개인/소규모 팀 사용 기준으로 범위 조정됨.

---

## ✅ Phase 0 — 기반 (완료)

### 구현됨
- [x] Web Speech API 기반 실시간 전사 (Chrome `ko-KR`)
- [x] 파일 업로드 검증 (MP3/WAV/WebM/M4A/OGG/FLAC, 최대 500MB)
- [x] 단순 변환 / Gemini AI 요약 두 모드
- [x] Markdown / HTML 내보내기, 클립보드 복사
- [x] Gemini 롤링 실시간 요약 (30초 간격, 25/40단어 게이트)
- [x] 녹음 종료 시 최종 회의록 자동 생성
- [x] 429 쿼터 초과 자동 쿨다운 + 지수 백오프
- [x] Gemini 실패 시 단순 변환 자동 폴백
- [x] 네트워크 에러 자동 재연결 (최대 8회)
- [x] 좌우 분할 UI (실시간 텍스트 / 실시간 회의록)
- [x] 자동 스크롤, 진행률 바, 쿨다운 카운터
- [x] Docker Compose (app + db + test profile)
- [x] 단위 테스트 38개 통과
- [x] Prisma 7 호환 스키마 (아직 미사용)

### 알려진 제약
- Chrome 전용 (Web Speech API)
- 화자 구분 불가 — 의도적 비지원 (Non-goal)
- 녹음 저장/조회 불가 (DB 미사용)
- Web Speech 세션이 가끔 끊김 → 자동 재연결로 완화

---

## ✅ Phase 0.5 — 템플릿 + 강도 조절 (완료)

사용자가 회의록 외 다양한 용도로 쓸 수 있도록 템플릿 시스템과 강도 조절 도입.

### 구현됨
- [x] 6개 프리셋 템플릿 (회의록, 강의·세미나, 1:1 미팅, 브레인스토밍, 인터뷰, 원문 정리)
- [x] 커스텀 프롬프트 옵션 (파워 유저용 자유 입력)
- [x] 3단계 강도 조절 (간결 / 표준 / 상세)
- [x] 템플릿별 기본 강도 프리셋 (예: 강의는 상세, 회의록은 표준)
- [x] 템플릿별 라이브 요약 지원 플래그 (raw/interview는 종료 시 한 번만)
- [x] Gemini 모드에서만 노출, 단순 변환은 기존 동작 유지
- [x] 라이브 요약도 동일 템플릿/강도 적용
- [x] 프롬프트 빌더 단위 테스트 19개

---

## ✅ Phase 1.5 — 웹 기반 API 키 설정 (완료)

`.env`를 만지지 않고도 브라우저에서 Gemini 키를 설정할 수 있도록 함.

### 구현됨
- [x] `/settings` 페이지 — 키 입력 / 저장 / 삭제 / 마스킹된 현재 키 표시
- [x] LocalStorage 저장 (서버 DB에 보관 X — 개인용/단일 인스턴스 가정)
- [x] `/api/settings/status` — 환경변수 키 존재 여부 (값 노출 X)
- [x] `/api/settings/test` — 키로 가벼운 Gemini 호출 시도 → 200/401/429 등 분류
- [x] `resolveGeminiApiKey()` 우선순위: 요청 body 키 → 환경변수 → null
- [x] summarize / summarize-live 라우트가 body의 `apiKey` 사용
- [x] 단위 테스트 14개 (api-keys 7 + api-key-storage 7)

### 의도된 비목표
- 다중 사용자 / 권한 관리 — 개인용 단일 인스턴스
- 키 암호화 — 평문 LocalStorage (현재 .env 신뢰 모델과 동일)

---

## ✅ Phase 1 — 회의 저장/조회 (완료)

노션의 **Meeting Database** 수준. 생성한 회의록을 저장하고 다시 찾아볼 수 있음.

### Issues
- [x] **#1 Prisma 연결 + 마이그레이션 파이프라인** — PR `feat/phase-1-foundation`
  - [x] `src/lib/db.ts` 싱글톤 Prisma 클라이언트 (Prisma 7 driver adapter 경유)
  - [x] 첫 마이그레이션 생성 (`prisma migrate dev`)
  - [x] docker-compose `tools` 프로필에 `migrate` 서비스 추가
  - [x] Meeting 스키마 확장 (attendees/tags/template/depth/summaryMode/customPrompt)
- [x] **#2 회의 저장 API** — PR `feat/phase-1-foundation`
  - [x] `POST /api/meetings` — transcript + markdown 저장
  - [x] `GET /api/meetings` — 목록 조회 (최신순, 페이지네이션, q 부분검색)
  - [x] `GET /api/meetings/[id]` — 상세
  - [x] `PUT /api/meetings/[id]` — markdown/title/attendees/tags 편집
  - [x] `DELETE /api/meetings/[id]`
- [x] **#3 MinutesViewer에 "저장" 버튼** — PR `feat/phase-1-ui`
  - [x] 생성된 회의록 세션에서 저장 → 배너 + 상세 링크
  - [x] 미리보기 / 원문 토글
- [x] **#4 회의 목록 페이지** (`/meetings`) — PR `feat/phase-1-ui`
  - [x] 카드 그리드 (제목, 날짜, preview, 태그, 참석자, 템플릿 배지)
  - [x] 빈 상태 UI
  - [x] 페이지네이션
- [x] **#5 회의 상세 페이지** (`/meetings/[id]`) — PR `feat/phase-1-ui`
  - [x] Markdown 렌더링 (sanitize)
  - [x] 인라인 편집 (제목/본문/참석자/태그) + 좌우 미리보기
  - [x] 삭제 버튼
- [x] **#6 Markdown 렌더링 라이브러리 도입** — PR `feat/phase-1-ui`
  - [x] `marked` + `isomorphic-dompurify`
  - [x] `src/lib/markdown.ts` 공용 유틸
  - [x] 기존 커스텀 파서 교체, `.prose-minutes` 공통 스타일
- [x] **#7 전역 검색** — PR `feat/phase-1-ui`
  - [x] 검색 바 (debounce 300ms, URL query 동기화)
  - [x] `/api/meetings?q=...` 부분 검색 (title/transcript/markdown)
  - [ ] Postgres `tsvector` GIN 인덱스 — 현재 ILIKE로 개인용 규모 충분, 필요 시 후속

---

## 🎯 Phase 2 — 구조화된 액션 아이템 (1주)

회의가 끝나면 **"내 할 일"이 자동으로 추출되어 체크리스트로 남음**. 노션 AI의 핵심 가치.

### Issues
- [ ] **#8 Gemini 프롬프트 개선 — JSON 출력**
  - `generateGeminiMinutes`가 마크다운 대신 `{ summary, discussion, actionItems: [{ assignee, due, task }], decisions }` 반환
  - JSON schema validation (zod)
- [ ] **#9 ActionItem 테이블 + 관계**
  - `Meeting` ↔ `ActionItem` (1:N)
  - 필드: `id`, `meetingId`, `assignee`, `task`, `dueDate`, `isDone`, `createdAt`
- [ ] **#10 체크리스트 UI**
  - 회의 상세 페이지에 별도 섹션
  - 체크박스 토글 → `PATCH /api/action-items/[id]`
- [ ] **#11 대시보드 페이지** (`/`)
  - "내 미완료 액션 아이템" 리스트
  - 최근 회의 3건 미리보기
  - 홈으로 승격, 녹음 UI는 `/record`로 이동

---

## 🎯 Phase 3 — 참석자 + 태그 (3~5일)

### Issues
- [ ] **#12 참석자 입력 UI**
  - 녹음 시작 전 쉼표 구분 입력 ("이름1, 이름2")
  - 회의 상세에서 편집 가능
- [ ] **#13 태그 시스템**
  - 프리셋: `sprint`, `1on1`, `review`, `planning`, `retro`
  - 사용자 정의 태그 추가
  - 목록 페이지에 태그 필터
- [ ] **#14 Gemini에 참석자 컨텍스트 주입**
  - 프롬프트에 참석자 이름 포함 → 액션 아이템 담당자 배정 정확도 ↑

---

## 🎯 Phase 4 — 차별화 기능 (선택, 각 1~2주)

### #16 Google Calendar 연동 (1~2주)
- OAuth 플로우 (`next-auth` + Google provider)
- 오늘 회의 목록 표시
- 캘린더 이벤트 → 회의 페이지 프리셋 (제목, 참석자 자동 채움)
- 회의 종료 시 이벤트 설명에 회의록 링크 자동 추가

### #17 AI Q&A ("과거 회의 검색" - RAG) (2주)
- 회의별 embedding 생성 (Gemini embedding API 또는 OpenAI)
- pgvector 확장 설치
- `/api/ask` — 자연어 질문 → 관련 회의 검색 + Gemini 답변
- UI: 검색바에 "질문하기" 모드 추가

### #18 후속 이메일 초안 생성 (2일)
- `/api/meetings/[id]/follow-up-email` — Gemini 프롬프트로 요약 이메일 생성
- 복사/Gmail 열기 버튼

### #19 블록 기반 에디터 (2~4주)
- TipTap 또는 Lexical 도입
- `/` 슬래시 명령어, 다양한 블록 타입
- 우선순위 낮음 — 개인 사용에선 현재 markdown textarea로 충분

---

## ❌ 명시적 비목표 (Non-goals)

다음 기능은 개인 사용 목적에 부합하지 않아 **의도적으로 범위 밖**:

- **화자 구분 (Speaker Diarization)** — 유료 API 비용/복잡도 대비 개인용에 과함
- **실시간 공동 편집 (CRDT)** — Yjs/Liveblocks 도입 복잡도 대비 이득 없음
- **권한 관리 / 워크스페이스** — 단일 사용자 가정
- **모바일 네이티브 앱** — 웹 PWA로 충분
- **노션 수준의 전역 페이지 트리** — 회의록 전용 도구로 집중

---

## 진행 관리 규칙

1. **Phase 단위로 GitHub Issue 생성** (각 phase를 epic issue로, 세부 `#N`을 task로)
2. **이슈당 1 브랜치 1 PR**: `feat/1-prisma-setup`, `feat/2-meetings-api` …
3. **PR 머지 전**: `docker compose --profile tools run --rm test` 전체 통과 필수
4. **완료 시 ROADMAP 체크박스 업데이트** (이 파일을 single source of truth로 유지)

이슈 생성 커맨드는 `docs/CREATE_ISSUES.sh` 참고.
