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

## ✅ 보안 강화 — 공개 저장소 전환 준비 (완료)

회사 직원이 각자 로컬에서 사용할 수 있도록 보안 검토 및 강화 작업.

### 구현됨
- [x] **C-1 대응**: 발급된 Gemini 키 `.env`에서 제거하도록 사용자 안내 (Google AI Studio 폐기 + .env 정리)
- [x] **C-2 대응**: docker-compose의 DB 비밀번호 fallback 제거 → `:?` 강제 환경변수
- [x] **C-3 대응**: Postgres 포트 `5432` 호스트 노출 제거 (컨테이너 내부 네트워크 전용)
- [x] **H-1 대응**: App 포트 `127.0.0.1:3000`로 바인딩 (LAN 노출 차단)
- [x] **H-2 대응**: `/api/summarize`에 transcript 100,000자 상한 추가
- [x] **H-4 대응**: `next.config.ts`에 보안 응답 헤더 4종 적용
- [x] **H-5 대응**: `/settings` 페이지에 공유 PC 경고 + Web Speech 외부 송출 안내 추가
- [x] **H-6 대응**: `db.ts`에서 `DATABASE_URL` 누락 시 명시적 경고 로그
- [x] **M-3 대응**: DOMPurify에 `FORBID_TAGS: ['style']`, `FORBID_ATTR: ['style']` 추가
- [x] **문서화**: `SECURITY.md` 작성 (위협 모델, 신뢰 모델, 한계, 신고 방법)
- [x] **MIT LICENSE** 추가

### 확인됨 (현재 비목표)
- M-1 (Web Speech → Google) — 구조적 한계, 문서화로 처리
- M-2 (npm audit moderate 6건) — dev 의존성, 자동 수정 가능한 것 0건
- H-3 (파일 업로드 매직 바이트) — 업로드된 파일 미사용/미서빙으로 위험 낮음
- 인증 시스템 — 단일 사용자 가정 (의도된 비목표)

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

## ✅ Phase 2 — 구조화된 액션 아이템 (완료)

회의가 끝나면 **"내 할 일"이 자동으로 추출되어 체크리스트로 남음**.

### 구현됨
- [x] **#8 액션 아이템 추출** — Gemini JSON 재구성 대신 마크다운 휴리스틱 채택
  (모든 템플릿이 이미 `- [ ]` 출력 → 추가 호출 비용 0, 후속에 JSON 모드 가능)
- [x] **#9 ActionItem 테이블** — `Meeting` ↔ `ActionItem` 1:N (cascade delete)
  - 필드: `id`, `meetingId`, `task`, `isDone`, `position`, `createdAt`, `updatedAt`
  - assignee/dueDate는 추후 JSON 출력 모드 도입 시 추가
- [x] **#10 체크리스트 UI** — 상세 페이지 별도 섹션
  - 체크박스 토글 (낙관적 업데이트) → `PATCH /api/action-items/[id]`
  - 개별 삭제 (hover 시 ✕ 노출)
  - 🔄 재추출 버튼 (마크다운 변경 후 수동 동기화)
- [x] **#11 대시보드 위젯** — `/meetings` 상단에 "내 미완료 액션 (최근 5)"
  - 회의 카드 우상단에 미완료 카운트 배지
  - 홈 페이지 자체 승격은 보류 (현재 녹음 UI 유지)
- [x] **부가** — Google Docs 호환 서식 복사 (`text/html` + `text/plain` ClipboardItem)
  - MinutesViewer / MeetingDetail 둘 다 `📋 Docs용` 버튼

### 비목표 (이번 단계)
- Gemini JSON 출력 + zod 검증 — 정확도 부족 시 후속 도입
- assignee/dueDate 필드 — JSON 출력 도입과 함께
- 홈 페이지 대시보드 승격 — 녹음 흐름 보존이 우선

---

## 🔴 실사용 진단 (2026-09-08 대면 회의)

46분 대면 회의를 실제로 녹음해 본 결과다. 로드맵의 우선순위를 바꾼 근거.

| 지표 | 값 |
|---|---|
| 회의 길이 | 46분 6초 |
| 총 청크 | 122개 |
| 총 어절 | **489** |
| 분당 어절 | **10.6** (한국어 대화 통상 100~150) |
| 추정 포착률 | **7~10%** |
| 30초 이상 공백 | 26곳 / 합계 26분 29초 (회의의 57%) |
| 빈 텍스트 청크 | 19개 (16%) |

**빈 청크 19개가 결정적 증거다.** Chrome이 `isFinal: true`에 `transcript: ""`를
준 경우로, "소리는 감지했으나 인식 실패"를 뜻한다. 마이크 입력 문제가 아니라
Web Speech가 원거리·다인 한국어를 못 알아듣고 버린 것이다.

**결론: Web Speech API는 회의 전사에 쓸 수 없다.** 재시작 갭을 메우고 interim을
flush해서 7%를 20~30%로는 올려도 90%로는 못 간다. 구현 결함이 아니라 엔진의 한계다.

---

## 🎯 P0 — 유실을 멈춘다

- [x] **오디오 원본 녹음** — `MediaRecorder`로 회의 원음을 파일로 보관
  - [x] 15초 조각 단위로 서버에 append → 탭/서버가 죽어도 그때까지는 남음
  - [x] 서버 실패해도 녹음 계속 + 브라우저 사본 내려받기
  - [x] 0바이트일 때 "보관됨"이라고 하지 않음
  - [x] 캡처 제약에서 노이즈 억제·에코 제거 해제 (원거리 화자 보존)
  - [x] 회의록 저장 시 `audioFileName`/`audioMimeType`/`audioDuration` 연결
- [x] **서버 STT 파이프라인** — 녹음 파일 → Whisper / Gemini audio → transcript
  - [x] `/api/upload`를 막다른 길에서 본선 경로로 승격 (업로드 → recordingId → 전사)
  - [x] 프로바이더 레이어에 `/v1/audio/transcriptions` 추가 (#12 구조 확장)
  - [x] Gemini 오디오 inline 입력 (webm 미지원은 명시적으로 안내)
  - [x] `verbose_json`으로 실제 오디오 타임스탬프 확보
  - [x] 참석자·용어 힌트를 전사 프롬프트로 전달
  - [x] 녹음 비트레이트 32kbps로 하향 — 46분 회의가 11MB로 API 상한 안에 들어옴
  - [ ] 같은 오디오로 Web Speech vs STT 포착률 실측 비교 ← **다음 회의에서**
  - [ ] 상한 초과 회의 분할 전사 (Whisper 25MB / Gemini inline 14MB)
  - [ ] Gemini Files API 경로 (큰 파일 + webm 우회)
  - [ ] Web Speech를 "실시간 미리보기"로 명시적 강등 (현재는 둘 다 노출)
- [ ] **빈 청크 필터링** — 빈 발화 19개가 요약 프롬프트를 오염시키고 있음
- [ ] **타임스탬프 실측화** — `useSpeechRecognition.ts`의 `startTime: now - 2` 하드코딩 제거
- [ ] **10만 자 하드 실패 → 분할 요약** — 긴 회의가 마지막에 통째로 실패함

## 🎯 P1 — 입력단 개선

- [ ] 대면 회의용 USB 전방향 마이크 도입 (코드로 못 푸는 물리적 한계)
- [ ] 원격 회의용 `echoCancellation` 재활성 경로 분리

## 🎯 P2 — 화자 분리 재설계

- [ ] **PR #17은 현재 형태로 머지 보류** — 실사용에서 46분 회의를 화자 1명으로
      판정했고, 5개 청크는 배정조차 실패했다. `assignSpeakers()`가 쓰는 시간축이
      가짜(`now - 2`)라 diarization의 실제 타임라인과 맞지 않는다
- [ ] 서버 STT 도입 후 재설계 — Whisper의 단어 단위 실제 타임스탬프 위에서
      diarization을 돌리면 그때 비로소 겹침 기반 배정이 의미를 갖는다
- [ ] #17의 sherpa-onnx 래퍼·모델 셋업 스크립트는 그때 재활용
- [ ] 참석자 수 힌트는 유지 (#17 실측에서 효과 확인됨)
- [ ] PR #16(dual-stream)은 원격 회의 전용으로 분리 검증

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
