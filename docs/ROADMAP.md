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
- 화자 구분 불가 (Web Speech API 한계)
- 녹음 저장/조회 불가 (DB 미사용)
- Web Speech 세션이 가끔 끊김 → 자동 재연결로 완화

---

## 🎯 Phase 1 — 회의 저장/조회 (1~2주)

노션의 **Meeting Database** 수준. 생성한 회의록을 저장하고 다시 찾아볼 수 있게 함.

### Issues
- [ ] **#1 Prisma 연결 + 마이그레이션 파이프라인**
  - `src/lib/db.ts` 싱글톤 Prisma 클라이언트
  - 첫 마이그레이션 생성 (`prisma migrate dev`)
  - Dockerfile에 `prisma migrate deploy` 추가
  - Meeting 스키마에 `attendees` (String[]), `tags` (String[]) 필드 추가
- [ ] **#2 회의 저장 API**
  - `POST /api/meetings` — transcript + markdown 저장
  - `GET /api/meetings` — 목록 조회 (최신순, 페이지네이션)
  - `GET /api/meetings/[id]` — 상세
  - `PUT /api/meetings/[id]` — markdown 편집 저장
  - `DELETE /api/meetings/[id]`
- [ ] **#3 MinutesViewer에 "저장" 버튼**
  - 생성된 회의록 현재 세션에서 저장 → 토스트 알림
  - 저장 성공 시 `/meetings/[id]` 링크 제공
- [ ] **#4 회의 목록 페이지** (`/meetings`)
  - 카드 그리드 (제목, 날짜, 앞 2줄 미리보기, 태그)
  - 빈 상태 UI ("첫 회의를 녹음해보세요")
- [ ] **#5 회의 상세 페이지** (`/meetings/[id]`)
  - Transcript + Markdown 렌더링
  - 인라인 편집 (markdown editor 도입 — 아래 #6)
  - 삭제 버튼
- [ ] **#6 Markdown 렌더링 라이브러리 도입**
  - `marked` + `isomorphic-dompurify`
  - 기존 커스텀 파서(`export-minutes.ts`) 교체 — 표/리스트/인라인 스타일 정상 렌더
- [ ] **#7 전역 검색**
  - Postgres `tsvector` 전체 텍스트 인덱스 (transcript + markdown)
  - `/api/meetings?q=...` 엔드포인트
  - 헤더에 검색 바 추가

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

### #15 화자 구분 (Speaker Diarization)
Web Speech API는 화자 구분을 지원하지 않음. 후처리 전략이 필요.

**접근 방법 비교:**

| 방법 | 정확도 | 비용 | 한국어 | 실시간 |
|---|---|---|---|---|
| **Gemini 2.5 Flash (오디오 입력)** | 중 | 무료 (RPM 한도 내) | 좋음 | ❌ 후처리만 |
| **AssemblyAI** | 매우 높음 | $0.15/hr (5hr/월 무료) | 좋음 | ✅ 가능 |
| **Deepgram Nova-2** | 높음 | $0.43/hr ($200 무료 크레딧) | 보통 | ✅ 가능 |
| **Google Cloud STT** | 높음 | $1.44/hr | 좋음 | ✅ 가능 |

**권장 구조 — 하이브리드:**
```
[클라이언트]
  ├─ Web Speech API → 실시간 미리보기 (기존)
  └─ MediaRecorder → audio blob 누적 (신규)

[녹음 종료]
  └─ POST /api/transcribe-with-speakers (audio blob)
     └─ Gemini 2.5 Flash OR AssemblyAI
        └─ 화자 라벨 붙은 최종 transcript
           └─ 기존 /api/summarize 파이프라인 재사용
```

**이점:**
- 녹음 중에는 지금처럼 빠른 미리보기 유지
- 종료 후 고품질 화자 구분 transcript로 최종 회의록 생성
- 개인용이면 Gemini 2.5로 무료 처리 가능

**세부 이슈:**
- [ ] **#15a** 클라이언트에 MediaRecorder 병행 녹음 (WebM/Opus)
- [ ] **#15b** `/api/transcribe-with-speakers` — Gemini 2.5 Flash audio input
- [ ] **#15c** 화자 라벨 transcript 뷰 (화자별 색상 배지)
- [ ] **#15d** AssemblyAI 어댑터 (옵션, 정확도 업그레이드 경로)

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
