# Meeting Minutes — 실시간 AI 회의록

음성 녹음을 실시간으로 텍스트·요약으로 변환하고, 구조화된 회의록을 자동 생성하는 웹 서비스.

향후 로드맵 — 노션 AI Meeting Notes 수준의 워크스페이스: [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## 현재 기능 (Phase 0 + 0.5 + 1 + 1.5)

### 녹음 & 전사
- 브라우저 실시간 음성 인식 (Web Speech API · Chrome `ko-KR`)
- 네트워크 끊김 시 **자동 재연결** (최대 8회) — 누적 transcript 보존
- 파일 업로드: MP3, WAV, WebM, M4A, OGG, FLAC (최대 500MB)
- 인식된 텍스트는 textarea에서 직접 편집 가능

### AI 요약 (Gemini)
- **실시간 회의록**: 녹음 중 30초 간격으로 Gemini가 중간 요약 갱신 (25단어 이상, 40단어 증분 게이트)
- **최종 회의록**: 녹음 중지 시 자동 생성
- 모델: `gemini-2.5-flash-lite` (개인 무료 등급에서 여유있게 동작)
- 429 쿼터 초과 시 **60초 쿨다운** + UI 안내, 그 외 실패는 지수 백오프
- Gemini 실패 시 **단순 변환 마크다운으로 자동 폴백** — 결과물은 항상 보장
- 내보내기: Markdown(.md), HTML(.html), 클립보드 복사

### 템플릿 & 강도 조절 (Phase 0.5)
용도에 맞게 출력 구조와 요약 깊이를 조절할 수 있음.

| 템플릿 | 생성되는 구조 | 기본 강도 | 라이브 요약 |
|---|---|---|---|
| 🗂️ 회의록 | 요약 / 논의 / 액션 / 결정 | 표준 | ✅ |
| 🎓 강의·세미나 노트 | 핵심 개념 / 예시 / 인용 / 후속 질문 | 상세 | ✅ |
| 🤝 1:1 미팅 | 주제 / 고민 / 피드백 / 다음 액션 | 표준 | ✅ |
| 💡 브레인스토밍 | 카테고리별 아이디어 / 즉시 시도 / 보류 | 상세 | ✅ |
| 🎤 인터뷰 | Q&A 포맷 / 인상적 발언 / 종합 | 표준 | ❌ |
| 📝 원문 정리 | 요약 없이 문단화·오탈자 정리만 | 상세 고정 | ❌ |
| ⚙️ 커스텀 | 자유 프롬프트 입력 | - | ✅ |

강도 3단계:
- **간결** — 각 섹션 3줄 이내
- **표준** — 맥락이 이해될 정도
- **상세** — 세부사항·수치 누락 없이 보존

### Gemini 키 웹 설정 (Phase 1.5)
- **`/settings` 페이지** — 헤더 ⚙️ 링크로 진입
- 브라우저 LocalStorage에 저장 (서버 DB 미사용)
- 마스킹된 현재 키 표시 (`AIza••••XYZ12`), 보이기/숨기기 토글
- **🧪 테스트 호출** — 가벼운 Gemini 응답으로 키 유효성 검증
- 우선순위: 브라우저 키 → 환경변수 → 단순 변환 폴백
- 키 미설정 시에도 단순 변환 모드로 회의록은 항상 생성됨

### 저장·조회 워크스페이스 (Phase 1)
- **`📌 저장` 버튼** — 생성된 회의록을 DB에 영속 저장
- **`/meetings` 목록 페이지** — 카드 그리드, 페이지네이션, 빈 상태 UI
- **`/meetings/[id]` 상세 페이지** — Markdown 렌더 + 인라인 편집 + 삭제
  - 편집 모드는 좌(textarea) · 우(live preview) 분할
  - 참석자/태그도 상세 페이지에서 편집
- **검색 바** — 제목·transcript·본문 부분 검색 (300ms debounce, URL 동기화)
- **Markdown 라이브러리** — `marked` + `isomorphic-dompurify`로 안전한 HTML 렌더 (표/리스트/인용 등 모두 정상)

### 화면
- 녹음 시 **좌(실시간 텍스트) · 우(실시간 회의록)** 분할 뷰
- 확정 전 interim 텍스트는 회색 이탤릭 + 깜빡이는 커서
- 새 내용 도착 시 자동 스크롤
- 진행률 바 (첫 요약까지 단어 수), 쿨다운 카운터
- 템플릿/강도 변경 시 라이브 요약도 즉시 반영
- 메인 화면 상단 우측 `📚 저장된 회의록` 링크 → 목록으로 이동

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) + TypeScript |
| STT (실시간) | Web Speech API — Chrome 내장, 무료 |
| AI 요약 | Gemini 2.5 Flash Lite — 무료 등급 15 RPM / 1000 RPD |
| DB | PostgreSQL 16 + Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Markdown | `marked` + `isomorphic-dompurify` |
| 테스트 | Vitest (94 tests, jsdom) |
| 배포 | Docker Compose (app + db + test profile) |

---

## 빠른 시작 (Docker Compose)

### 1. 준비

```bash
git clone git@github.com:nad4-su/meeting-minutes.git
cd meeting-minutes
cp .env.example .env
```

**Gemini API 키 설정 — 두 가지 방법 중 선택**:
- (A) **웹 UI** — 앱 기동 후 `/settings` 페이지에서 입력 (브라우저 LocalStorage 저장, 추천)
- (B) **`.env` 환경변수** — `GEMINI_API_KEY=AIza...` 작성 ([Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급)

> 키가 없어도 "단순 변환" 모드는 정상 동작. Gemini 모드를 쓰려면 둘 중 하나는 필요.

### 2. DB 마이그레이션 (최초 1회 + 스키마 변경 시)

```bash
docker compose --profile tools run --rm migrate
```

이 명령은 `db` 컨테이너를 자동 기동하고 `prisma migrate deploy`로 테이블을 생성합니다.

### 3. 기동

```bash
docker compose up -d --build
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 → **Chrome 권장** (Web Speech API).

### 4. 확인 방법

1. 회의 제목 입력 (선택)
2. **Gemini AI 요약** 모드 + 원하는 **템플릿** / **강도** 선택
3. **녹음 시작** → 마이크 권한 허용
4. 말하기 시작 → 좌측 실시간 텍스트, 25단어 이상 쌓이면 우측에 중간 회의록 생성
5. **녹음 중지** → 최종 회의록이 페이지 하단에 자동 생성됨
6. **`📌 저장`** 버튼 → `/meetings/[id]`로 영속화
7. 상단 **`📚 저장된 회의록`** 링크 → 목록·검색·편집

### 서비스 관리

```bash
docker compose logs -f app           # 로그
docker compose restart app           # 재시작
docker compose down                  # 중지 (데이터 유지)
docker compose down -v               # 중지 + 볼륨 삭제
docker compose up -d --build         # 코드 변경 후 재빌드
```

### 테스트 (Docker)

```bash
docker compose --profile tools run --rm test
```

별도 Node 설치 불필요. `tools` 프로필 컨테이너에서 `vitest` 실행.

---

## 로컬 개발 (Docker 없이)

```bash
npm install
npm run dev               # http://localhost:3000
npm test                  # 전체 테스트
npm run test:coverage     # 커버리지 리포트
```

---

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts              # 파일 업로드
│   │   ├── summarize/route.ts           # 최종 회의록 (Gemini + simple fallback)
│   │   ├── summarize-live/route.ts      # 실시간 중간 요약
│   │   ├── meetings/
│   │   │   ├── route.ts                 # GET 목록 (q 검색) / POST 저장
│   │   │   └── [id]/route.ts            # GET / PUT / DELETE 상세
│   │   └── settings/
│   │       ├── status/route.ts          # 환경변수 키 설정 여부
│   │       └── test/route.ts            # 키 유효성 검증 (가벼운 Gemini 호출)
│   ├── meetings/
│   │   ├── page.tsx                     # 저장된 회의록 목록 + 검색
│   │   └── [id]/page.tsx                # 상세 + 편집 + 삭제
│   ├── settings/page.tsx                # 키 설정 페이지 (LocalStorage)
│   ├── page.tsx                         # 메인 UI (녹음/요약)
│   └── layout.tsx
├── lib/
│   ├── db.ts                            # Prisma 싱글톤 (pg adapter)
│   ├── markdown.ts                      # marked + DOMPurify 렌더 유틸
│   ├── api-keys.ts                      # 서버: 요청 키 → env fallback 우선순위
│   ├── api-key-storage.ts               # 클라이언트: LocalStorage 헬퍼 + 마스킹
│   ├── audio-validation.ts
│   ├── upload-handler.ts
│   ├── transcript-formatter.ts
│   ├── templates.ts                     # 템플릿 레지스트리 + 프롬프트 빌더
│   ├── minutes-generator.ts             # 최종 요약 생성 (템플릿 적용)
│   ├── live-summary.ts                  # 롤링 요약 생성 (템플릿 적용)
│   └── export-minutes.ts
├── hooks/
│   ├── useSpeechRecognition.ts          # Web Speech API + 네트워크 재시도
│   └── useLiveSummary.ts                # 30s 폴링 + 429 쿨다운 + 증분 게이트
├── components/
│   ├── upload/AudioUploader.tsx
│   ├── recorder/LiveRecorder.tsx        # 좌우 분할 뷰
│   ├── minutes/MinutesViewer.tsx        # 미리보기/원문 토글 + 저장
│   └── meeting/
│       ├── MeetingCard.tsx
│       ├── MeetingSearchBar.tsx         # debounce + URL 동기화
│       └── MeetingDetail.tsx            # 상세/편집 UI
└── __tests__/                           # 94 tests

docs/
├── ROADMAP.md                           # 개발 로드맵 (Phase 0~4)
└── CREATE_ISSUES.sh                     # gh CLI용 이슈 자동 생성 스크립트

prisma/
├── schema.prisma                        # Meeting 모델
└── migrations/                          # 마이그레이션 히스토리
```

---

## 로드맵 요약

상세: [`docs/ROADMAP.md`](docs/ROADMAP.md)

| Phase | 내용 | 상태 |
|---|---|---|
| **0** | 실시간 전사 + 롤링 요약 + 자동 최종 생성 | ✅ 완료 |
| **0.5** | 템플릿 (6종) + 강도 조절 (3단계) + 커스텀 프롬프트 | ✅ 완료 |
| **1** | 회의 저장/조회/검색 워크스페이스 | ✅ 완료 |
| **1.5** | 웹에서 Gemini 키 설정 (LocalStorage) | ✅ 완료 |
| **2** | 구조화된 액션 아이템 (Gemini JSON + 체크리스트) | 📋 기획됨 |
| **3** | 참석자 + 태그 시스템 | 📋 기획됨 |
| **4** | 차별화 기능 (캘린더, AI Q&A, 블록 에디터) | 💡 선택 |

### 진행 관리
1. `gh auth login` 후 `bash docs/CREATE_ISSUES.sh` — 4개 epic issue 자동 생성
2. 이슈당 1 브랜치 1 PR 원칙
3. PR 머지 전 `docker compose --profile tools run --rm test` 필수
4. 완료 시 `docs/ROADMAP.md` 체크박스 업데이트

---

## 알려진 제약

- **Chrome 전용**: Web Speech API 비표준 — Safari/Firefox는 제한적
- **화자 구분 불가**: 의도적 비지원 (개인용 범위를 넘음)
- **Gemini 무료 등급**: 15 RPM / 1000 RPD — 개인 사용에 충분하나 팀 단위는 유료 전환 권장
- **검색**: 현재 PostgreSQL `ILIKE`(contains) 방식. 수천 건 이상 저장 시 `tsvector` GIN 인덱스로 후속 업그레이드 예정
