# 🎙️ Meeting Minutes

**음성을 텍스트로, 텍스트를 회의록으로** — 브라우저 기반 실시간 AI 회의록 자동 작성 도구.

녹음 시작 한 번이면 끝. Gemini AI가 30초마다 회의록을 갱신하고, 종료 시 자동으로 최종 문서를 생성합니다. 회의록 외에도 강의 노트, 1:1 미팅, 브레인스토밍 등 6가지 템플릿을 제공하며, Google Docs에 서식 그대로 붙여넣기까지 한 번에.

```bash
git clone https://github.com/nad4-su/meeting-minutes.git
cd meeting-minutes && cp .env.example .env
# ⚠️ .env 파일을 열어 POSTGRES_PASSWORD를 강력한 값으로 채워주세요
#    예: echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
docker compose --profile tools run --rm migrate
docker compose up -d
# → http://127.0.0.1:3000 (Chrome 권장, localhost 전용)
```

> ⚠️ **보안 주의**: 회의 내용에 민감 정보가 있다면 [SECURITY.md](SECURITY.md)의 위협 모델 섹션을 먼저 읽어주세요. 실시간 녹음은 Chrome Web Speech API를 사용하여 음성을 Google 서버로 전송합니다.
>
> 👥 **직원/팀원에게 공유할 때**: [docs/EMPLOYEE_QUICKSTART.md](docs/EMPLOYEE_QUICKSTART.md) — 5분 시작 가이드 (사내 정책 안내 포함)

---

## 📑 목차

- [✨ 주요 기능](#-주요-기능)
  - [🎤 실시간 녹음 & 전사](#-실시간-녹음--전사)
  - [🗣️ 화자 분리](#️-화자-분리)
  - [🤖 AI 회의록 (6 템플릿 × 3 강도)](#-ai-회의록-6-템플릿--3-강도)
  - [⚡ 실시간 롤링 요약](#-실시간-롤링-요약)
  - [💾 회의록 저장/조회/검색](#-회의록-저장조회검색)
  - [✅ 액션 아이템 자동 추출](#-액션-아이템-자동-추출)
  - [🔑 AI 프로바이더 & API 키 설정](#-ai-프로바이더--api-키-설정)
  - [📋 Google Docs 호환 복사](#-google-docs-호환-복사)
- [🚀 시작하기](#-시작하기)
  - [Docker Compose (권장)](#docker-compose-권장)
  - [로컬 개발 환경](#로컬-개발-환경)
- [🛠️ 기술 스택](#️-기술-스택)
- [📁 프로젝트 구조](#-프로젝트-구조)
- [🗺️ 로드맵](#️-로드맵)
- [🔒 보안 모델](#-보안-모델)
- [⚠️ 알려진 제약](#️-알려진-제약)
- [🤝 기여하기](#-기여하기)
- [📄 라이선스](#-라이선스)

---

## ✨ 주요 기능

### 🎤 실시간 녹음 & 전사

브라우저 내장 Web Speech API(Chrome `ko-KR`)로 마이크 입력을 실시간 텍스트로 변환합니다.

**특징**
- 즉시 시작 — 별도 STT 서버나 키 없이 작동
- **자동 재연결** — 네트워크 끊김 시 최대 8회 재시도, 누적 transcript 보존
- 확정 전 텍스트는 회색 이탤릭 + 깜빡이는 커서로 시각화
- 녹음 중 `🔴 N단어 · M개 구간` 실시간 카운터

**사용**
1. 홈에서 **🎤 녹음 시작** 클릭
2. 마이크 권한 허용
3. 발화 → 좌측 패널에 텍스트가 쌓임
4. **녹음 중지** → 텍스트가 textarea로 이동, 직접 편집 가능

---

### 🤖 AI 회의록 (6 템플릿 × 3 강도)

회의 외에도 다양한 용도에 맞춰 출력 구조를 선택할 수 있습니다.

| 템플릿 | 생성되는 구조 | 기본 강도 | 라이브 요약 |
|---|---|---|---|
| 🗂️ 회의록 | 요약 / **내용 기반 주제 섹션** / 액션 / 결정 | 표준 | ✅ |
| 🎓 강의·세미나 노트 | 핵심 개념 / 예시 / 인용 / 후속 질문 | 상세 | ✅ |
| 🤝 1:1 미팅 | 요지 / **내용 기반 주제 섹션** / 고민 / 피드백 / 다음 액션 | 표준 | ✅ |
| 💡 브레인스토밍 | 카테고리별 아이디어 / 즉시 시도 / 보류 | 상세 | ✅ |
| 🎤 인터뷰 | Q&A 포맷 / 인상적 발언 / 종합 | 표준 | ❌ |
| 📝 원문 정리 | 요약 없이 문단화·오탈자 정리만 | 상세 고정 | ❌ |
| ⚙️ 커스텀 | 자유 프롬프트 입력 | - | ✅ |

**내용 기반 주제 섹션**

회의록·1:1 템플릿은 `## 주요 논의 사항` 같은 고정 제목을 쓰지 않습니다. 그 회의가 실제로 무엇을
다뤘는지에 따라 AI가 섹션 제목을 직접 짓습니다 — 예를 들어 `## 단계별 개발 계획`,
`## 수익화 방안`, `## 기술적 고려사항` 처럼. 제목만 훑어도 회의 내용이 파악됩니다.

**액션 아이템 담당자**

발화에서 담당자가 파악되면 `- [ ] (김지훈) 경쟁 사이트 리스트업 — 5/17까지` 형태로 이름과 기한이 붙습니다.
담당자가 정해지지 않은 항목도 버리지 않고 그대로 수집합니다.

**강도 3단계**
- **간결** — 각 섹션 3줄 이내
- **표준** — 맥락이 이해될 정도
- **상세** — 세부사항·수치 누락 없이 보존

**사용**
1. 변환 모드 = `Gemini AI 요약` 선택
2. 템플릿 선택 (예: `🎓 강의·세미나 노트`)
3. 강도 선택
4. 녹음 또는 텍스트 입력 → **회의록 생성**

---

### 🗣️ 화자 분리

누가 무슨 말을 했는지 구분해 기록합니다. 회의 환경에 따라 두 가지 방식을 씁니다.

| 모드 | 방식 | 정확도 | 준비물 |
|---|---|---|---|
| **원격 회의** | 내 마이크와 시스템(탭) 오디오를 **별도 트랙**으로 받아 트랙별로 전사 | **100%** — 추론 없음 | 없음 |
| **대면 회의** | 마이크 한 트랙을 **내 PC에서** 분석해 화자를 나눔 | DER 12~15% | 모델 1회 설치 |

**원격 회의**는 트랙이 곧 화자라 틀릴 수가 없습니다. 시작할 때 화면 공유 대화상자에서
**"탭 오디오 공유"를 반드시 켜야** 합니다. 켜지 않으면 마이크 단독 녹음으로 넘어가고
화자 라벨이 붙지 않습니다 (틀린 라벨을 붙이지 않습니다).

**대면 회의**는 `pyannote-segmentation-3.0` + `3D-Speaker CAM++` ONNX 모델을 로컬
Next.js 프로세스에서 실행합니다. **오디오가 외부로 나가지 않습니다.** GPU도 파이썬
런타임도 필요 없고, 노트북 CPU에서 실시간의 수십 배 속도로 처리됩니다.

```bash
# 최초 1회 — 모델 약 34MB 내려받기
npm run setup:diarization
```

> 💡 **참석자 수를 정확히 입력하세요.** 자동 추정은 화자 수를 잘못 세는 것이 주 실패
> 모드입니다. 실측에서 4인 오디오가 자동 모드로는 5명, 참석자 수를 알려주면 4명으로
> 정확히 나왔습니다.

대면 모드는 녹음이 끝난 뒤 **전체 오디오에 한 번** 분석을 돌립니다. 구간을 잘라
반복 실행하면 실행마다 화자 번호가 달라져 이어 붙일 수 없기 때문입니다. 따라서
녹음 중 실시간 화자 표시는 없고, 종료 시 원문 전체에 화자가 붙습니다.

---

### ⚡ 실시간 롤링 요약

녹음 중 **30초마다** Gemini가 그동안의 발화를 분석해 중간 회의록을 자동 갱신합니다.

**동작**
- 첫 갱신 조건: 25단어 이상
- 이후 갱신 조건: 직전 요약 후 40단어 증가
- 화면 우측에 진행률 바 + 갱신 시각 표시
- 429 쿼터 초과 시 60초 자동 쿨다운, UI에 카운트다운 노출
- 일반 실패 시 지수 백오프 (15s → 30s → 최대 120s)

**비용 가드 (Gemini Flash Lite 무료 등급 기준)**
- 15 RPM / 1000 RPD / 250K TPM
- 30초 폴링 + 증분 게이트 → 1시간 회의 ≤ 60회 호출, 발화량 적으면 훨씬 적음
- 개인 사용 시 일일 한도 도달 거의 불가

---

### 💾 회의록 저장/조회/검색

생성한 회의록을 PostgreSQL에 영속 저장하고 나중에 다시 조회/편집/검색할 수 있습니다.

**기능**
- **`📌 저장`** 버튼 → DB에 저장 → 상세 페이지 링크 제공
- **`/meetings`** 카드 그리드 — 제목 / 날짜 / 템플릿 배지 / 미완료 액션 카운트
- **검색** — 300ms debounce, 제목·transcript·본문 부분 매칭, URL 동기화
- **`/meetings/[id]`** 상세 — Markdown 렌더링 + 인라인 편집 (좌 textarea / 우 미리보기)
- **참석자 / 태그** 편집 (목록 필터링은 Phase 3 예정)
- 삭제 (확인 다이얼로그)

**API**
| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET` | `/api/meetings` | 목록 + 검색 (`?q=`) + 페이지네이션 |
| `POST` | `/api/meetings` | 새 회의록 저장 (액션 아이템 자동 추출 동반) |
| `GET` | `/api/meetings/[id]` | 상세 (actionItems 포함) |
| `PUT` | `/api/meetings/[id]` | 본문/메타 편집 |
| `DELETE` | `/api/meetings/[id]` | 삭제 |

---

### ✅ 액션 아이템 자동 추출

회의록 저장 시 마크다운의 `- [ ]` / `- [x]` 항목을 **자동으로 구조화** 추출하여 별도 체크리스트로 관리합니다.

**기능**
- 저장 시 자동 추출 (Gemini 추가 호출 0 — 휴리스틱 파싱)
- 상세 페이지에 **✅ 액션 아이템** 섹션
- 체크박스 토글 (낙관적 업데이트, 즉시 반영)
- 진행률 배지 (`완료/전체`)
- 개별 삭제 (hover ✕)
- **🔄 재추출** — 마크다운 편집 후 동기화 (확인 후 토글 상태 초기화)
- `/meetings` 상단 위젯 "내 미완료 액션 (최근 5건)"
- 회의 카드에 미완료 카운트 배지

**API**
| 메서드 | 경로 | 용도 |
|---|---|---|
| `PATCH` | `/api/action-items/[id]` | 토글 / task 수정 |
| `DELETE` | `/api/action-items/[id]` | 개별 삭제 |
| `POST` | `/api/meetings/[id]/reparse-action-items` | 마크다운 재파싱 |

---

### 🔑 AI 프로바이더 & API 키 설정

`.env`를 만지지 않고 `/settings` 페이지에서 프로바이더·모델·키를 선택하고 검증할 수 있습니다.

**선택 가능한 프로바이더**

| 프리셋 | 엔드포인트 | 비고 |
|--------|-----------|------|
| **Google Gemini** (기본) | Google 직접 호출 | 무료 티어가 있어 가장 간단 |
| **OpenAI** | `https://api.openai.com/v1` | Chat Completions |
| **OrcaRouter** | `https://api.orcarouter.ai/v1` | 하나의 키로 여러 제공사 모델 |
| **로컬 모델** | `http://localhost:11434/v1` | Ollama · LM Studio · vLLM — 회의 내용이 외부로 나가지 않음 |
| **직접 입력** | 사용자 지정 | OpenAI 호환이면 무엇이든 |

Gemini 외 프리셋은 모두 동일한 **OpenAI Chat Completions** 어댑터를 사용합니다
(`src/lib/providers/openai-compatible.ts`). base URL과 모델 ID만 바꾸면 새 서비스가 붙습니다.

**저장 위치**
- 브라우저 LocalStorage (서버 DB에 저장되지 않음)
- 요청 body로 함께 전송되어 일회성으로 사용

**우선순위**
```
1. 요청 body의 provider/apiKey/baseUrl/model  (브라우저 LocalStorage)
       ↓ 없으면
2. 서버 환경변수  (GEMINI_API_KEY 또는 LLM_PROVIDER / LLM_BASE_URL / LLM_MODEL / LLM_API_KEY)
       ↓ 없으면
3. summarize → 단순 변환 폴백 (warning 표시)
   summarize-live → 503 + 안내
```

**기능**
- 마스킹된 현재 키 표시 (`AIza••••XYZ12`)
- 보이기/숨기기 토글
- **🧪 테스트 호출** — 가벼운 응답으로 즉시 설정 검증 (사용된 모델명 표시)
- 현재 소스 배지 (`브라우저` / `환경변수` / `없음`)
- 기존에 Gemini 키만 저장해둔 사용자는 **재입력 없이 그대로 동작** (자동 승계)

**보안**
- HTTPS 권장 (LocalStorage는 동일 출처 정책 의존)
- GET 응답에 절대 풀 키 노출 안 함
- base URL은 `http`/`https`만 허용 — 자세한 내용은 [SECURITY.md](SECURITY.md)

---

### 📋 Google Docs 호환 복사

서식(헤딩/리스트/굵게/코드/표)을 유지한 채 클립보드에 복사 → Google Docs / Word / Notion에 그대로 붙여넣기.

**원리**
- `navigator.clipboard.write([new ClipboardItem({ 'text/html', 'text/plain' })])`
- 미지원 브라우저는 `contenteditable` + `execCommand('copy')` 폴백

**버튼 라벨링**
- `📋 .md` — 마크다운 원문 복사
- `📋 Docs용` — 서식 유지 복사 (파랑 강조)
- `⬇ .md` / `⬇ .html` — 파일 다운로드

---

## 🚀 시작하기

### Docker Compose (권장)

#### 사전 요구사항
- [Docker Desktop](https://docs.docker.com/get-docker/) 또는 Docker Engine + Compose v2
- Chrome 브라우저 (Web Speech API)

#### 1. 저장소 클론

```bash
git clone https://github.com/nad4-su/meeting-minutes.git
cd meeting-minutes
```

#### 2. 환경 변수 (필수)

```bash
cp .env.example .env
```

`.env` 파일을 열어 다음 값을 채워주세요:

```bash
POSTGRES_USER=meetinguser           # 임의 사용자명
POSTGRES_DB=meetingminutes
POSTGRES_PASSWORD=<강력한_임의_값>   # openssl rand -base64 24
DATABASE_URL=postgresql://meetinguser:<위와_같은_비번>@localhost:5432/meetingminutes
```

> ⚠️ `POSTGRES_PASSWORD`를 비워두면 docker compose가 명시적 에러로 실패합니다. 보안을 위한 의도된 동작.

> 💡 **AI 프로바이더 설정은 두 가지 방법 중 선택**
>
> - **(A) 웹 UI** — 앱 기동 후 `/settings`에서 프로바이더 선택 + 키 입력 (브라우저 LocalStorage, 추천)
> - **(B) `.env` 환경변수** — `GEMINI_API_KEY=AIza...` 또는 `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`
>
> 기본값인 Gemini 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 무료로 발급.
> 설정이 없어도 "단순 변환" 모드는 동작.

#### 3. DB 마이그레이션 (최초 1회)

```bash
docker compose --profile tools run --rm migrate
```

`db` 컨테이너를 자동 기동 후 `prisma migrate deploy`로 테이블 생성.

#### 4. 앱 기동

```bash
docker compose up -d
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

#### 서비스 관리

```bash
docker compose logs -f app                # 로그
docker compose restart app                # 재시작 (데이터 유지)
docker compose down                       # 중지
docker compose down -v                    # 중지 + 볼륨 삭제 (데이터 초기화)
docker compose up -d --build              # 코드 변경 후 재빌드
```

#### 데이터 백업

```bash
docker compose exec db pg_dump -U meetinguser meetingminutes > backup-$(date +%Y%m%d).sql
```

#### 테스트

```bash
docker compose --profile tools run --rm test
```

별도 Node 설치 불필요. `tools` 프로필이 vitest를 컨테이너에서 실행 (102 tests).

---

### 로컬 개발 환경

```bash
npm install

# 별도 PostgreSQL 필요
docker compose up -d db
npx prisma migrate dev

# 개발 서버
npm run dev               # http://localhost:3000
npm test                  # 전체 테스트
npm run test:watch        # 워치 모드
npm run test:coverage     # 커버리지 리포트
```

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) + React 19 + TypeScript |
| STT (실시간) | Web Speech API — Chrome 내장, 무료 |
| AI 요약 | Gemini 3.5 Flash Lite (기본) · OpenAI 호환 엔드포인트 선택 가능 |
| DB | PostgreSQL 16 + Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Markdown | `marked` + `isomorphic-dompurify` |
| 스타일 | Tailwind CSS v4 |
| 화자 분리 | pyannote-segmentation-3.0 + CAM++ (ONNX Runtime, CPU) |
| 테스트 | Vitest 4 (jsdom, 184 tests) |
| 배포 | Docker Compose + standalone Next.js 빌드 |

---

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts                       # 파일 업로드
│   │   ├── summarize/route.ts                    # 최종 회의록 (Gemini + simple fallback)
│   │   ├── summarize-live/route.ts               # 실시간 중간 요약
│   │   ├── meetings/
│   │   │   ├── route.ts                          # GET 목록 / POST 저장
│   │   │   └── [id]/
│   │   │       ├── route.ts                      # GET / PUT / DELETE
│   │   │       └── reparse-action-items/route.ts # 마크다운 재파싱
│   │   ├── action-items/
│   │   │   └── [id]/route.ts                     # PATCH / DELETE
│   │   └── settings/
│   │       ├── status/route.ts                   # 환경변수 키 존재 여부
│   │       └── test/route.ts                     # 키 유효성 검증
│   ├── meetings/
│   │   ├── page.tsx                              # 목록 + 검색 + 미완료 위젯
│   │   └── [id]/page.tsx                         # 상세 + 편집
│   ├── settings/page.tsx                         # 키 설정
│   ├── page.tsx                                  # 메인 (녹음/요약)
│   └── layout.tsx
├── lib/
│   ├── providers/                                # AI 프로바이더 어댑터
│   │   ├── index.ts                              #   complete() 디스패치
│   │   ├── types.ts                              #   ProviderSettings / CompletionResult
│   │   ├── presets.ts                            #   설정 UI용 프리셋 목록
│   │   ├── gemini.ts                             #   Google Generative Language API
│   │   └── openai-compatible.ts                  #   OpenAI Chat Completions 호환
│   ├── db.ts                                     # Prisma 싱글톤 (pg adapter)
│   ├── markdown.ts                               # marked + DOMPurify + Docs용 복사
│   ├── action-items.ts                           # - [ ] 휴리스틱 파서
│   ├── api-keys.ts                               # 서버: 요청 설정 → env fallback
│   ├── api-key-storage.ts                        # 클라: LocalStorage + 마스킹 + 프로바이더 설정
│   ├── templates.ts                              # 템플릿 레지스트리 + 프롬프트 빌더
│   ├── minutes-generator.ts                      # 최종 요약 생성 (프로바이더 무관)
│   ├── live-summary.ts                           # 롤링 요약 생성 (프로바이더 무관)
│   ├── transcript-formatter.ts
│   ├── audio-validation.ts
│   ├── upload-handler.ts
│   └── export-minutes.ts
├── hooks/
│   ├── useSpeechRecognition.ts                   # Web Speech + 네트워크 재시도
│   └── useLiveSummary.ts                         # 30s 폴링 + 429 쿨다운
├── components/
│   ├── upload/AudioUploader.tsx
│   ├── recorder/LiveRecorder.tsx                 # 좌우 분할 뷰
│   ├── minutes/MinutesViewer.tsx                 # 미리보기 / 원문 / 저장
│   └── meeting/
│       ├── MeetingCard.tsx
│       ├── MeetingSearchBar.tsx
│       ├── MeetingDetail.tsx
│       └── ActionItemList.tsx
└── __tests__/                                    # 102 tests / 13 files

docs/
├── ROADMAP.md                                    # 단계별 계획
├── CREATE_ISSUES.sh                              # gh CLI용 epic 이슈 생성
└── PR_DRAFT_*.md                                 # PR 본문 히스토리

prisma/
├── schema.prisma                                 # Meeting + ActionItem
└── migrations/                                   # 2개 (init, add_action_items)
```

---

## 🗺️ 로드맵

상세는 [`docs/ROADMAP.md`](docs/ROADMAP.md) 또는 [GitHub Milestones](https://github.com/nad4-su/meeting-minutes/milestones).

| Phase | 내용 | 상태 |
|---|---|---|
| **0** | 실시간 전사 + Gemini 롤링 요약 + 자동 최종 | ✅ 완료 |
| **0.5** | 6 템플릿 + 3 강도 + 커스텀 프롬프트 | ✅ 완료 |
| **1** | 회의 저장/조회/검색 워크스페이스 | ✅ 완료 |
| **1.5** | 웹에서 Gemini API 키 설정 (LocalStorage) | ✅ 완료 |
| **2** | 액션 아이템 추출/체크리스트 + Google Docs 복사 | ✅ 완료 |
| **3** | 참석자 + 태그 시스템 (목록 필터) | 📋 [`#7`](https://github.com/nad4-su/meeting-minutes/issues/7) |
| **v0.1.0** | MVP + Phase 3 + 폴리시 | 🚧 [`#6`](https://github.com/nad4-su/meeting-minutes/issues/6) |
| **4** | 캘린더 / AI Q&A / 후속 메일 / 블록 에디터 | 💡 [`#8`](https://github.com/nad4-su/meeting-minutes/issues/8) |

### 의도된 비목표 (Non-goals)
- **화자 구분** — 유료 API 비용 / 복잡도 대비 개인용 범위에 과함
- **공동 편집 (CRDT)** — 단일 사용자 가정
- **권한 관리 / 다중 사용자** — 1인 1인스턴스 모델
- **모바일 네이티브 앱** — 웹 PWA로 충분

---

## 🔒 보안 모델

> 이 프로젝트는 **개인용 단일 인스턴스 사용을 가정**합니다. 회사 직원이 사용할 경우 각자 본인 머신에서 별도 인스턴스를 실행하는 방식을 권장합니다.

### 신뢰 모델
- 인증 시스템 없음 — `localhost:3000`에 접근하는 사용자는 모든 데이터에 접근 가능
- 같은 머신을 다른 사람과 공유하지 않는 것을 가정
- 회의 transcript / 회의록은 평문으로 PostgreSQL에 저장됨 (디스크 암호화는 호스트 OS에 위임)

### API 키
- LocalStorage 저장 (브라우저 동일 출처 정책으로 보호)
- 서버 DB에 저장되지 않음
- 요청 시점에만 body로 전송, 일회성 사용
- HTTPS 환경 권장 (HTTP는 localhost 한정)

### 외부 데이터 송출
- **Web Speech API** — Chrome이 마이크 오디오를 Google 서버로 전송하여 전사 (Chrome 자체 동작, 우리 서버 경유 X)
- **AI 요약 API** — 사용자가 명시적으로 활성화한 경우에만 transcript를 선택한 프로바이더로 전송
  - Gemini / OpenAI 직접 호출 → 해당 회사 서버 1곳
  - OrcaRouter 등 중계 라우터 → **라우터 운영사 + 실제 모델 제공사** 양쪽
  - 로컬 모델 (Ollama / LM Studio / vLLM) → **외부 전송 없음**
- **그 외** — 외부 호출 없음 (텔레메트리 / 분석 도구 미설치)

> ⚠️ **회사 회의 등 민감 정보가 외부 클라우드로 송출되는 점에 유의.** 사내 컴플라이언스 정책 확인 후 사용 권장.
> 외부 전송이 곤란하다면 `/settings`에서 **로컬 모델**을 선택하세요.

### 권장 배포 방식

**1인 1인스턴스 (권장)**
- 직원 각자 본인 머신에 `docker compose up`
- 데이터는 각 머신에 격리됨
- 키 / 회의록 / 액션 아이템 모두 본인만 접근

**중앙 서버 배포는 권장하지 않음** — 인증 / 권한 / 격리 미구현

### 보안 체크리스트 (배포 전)
- [ ] `.env`에 강력한 `POSTGRES_PASSWORD` 설정
- [ ] `docker-compose.yml`의 Postgres 포트 노출 (`5432:5432`) 사용 환경에 맞게 검토 (외부 노출 불필요 시 제거)
- [ ] HTTPS reverse proxy 추가 (사외 접속 시)
- [ ] 방화벽 / VPN 뒤에서만 접근 가능하도록 구성
- [ ] 정기 백업 (`pg_dump`)

자세한 보안 검토 결과는 [`SECURITY.md`](SECURITY.md) 참고.

---

## ⚠️ 알려진 제약

| 제약 | 설명 | 대응 |
|---|---|---|
| **Chrome 전용** | Web Speech API는 비표준 — Safari / Firefox는 제한적 | Phase 4에서 서버 사이드 전사 검토 |
| **화자 구분 없음** | 의도적 비지원 (Non-goal) | — |
| **Gemini 무료 등급 한도** | 15 RPM / 1000 RPD | 한도 초과 시 자동 쿨다운, 단순 변환 폴백 |
| **단일 사용자** | 인증 없음, 데이터 격리 없음 | 1인 1인스턴스로 운용 |
| **마크다운 검색** | PostgreSQL `ILIKE` (수천 건 이상에서 느려질 수 있음) | 필요 시 `tsvector` 인덱스 추가 |
| **모바일 UX** | 데스크톱 우선 | 기본 동작은 가능, 폴리시 미흡 |

---

## 🤝 기여하기

이슈 / PR 환영합니다. 기여 전 다음을 확인해주세요:

1. [`docs/ROADMAP.md`](docs/ROADMAP.md)와 [Issues](https://github.com/nad4-su/meeting-minutes/issues)에서 중복 / 진행 중 항목 확인
2. **테스트 통과 필수** — `docker compose --profile tools run --rm test`
3. **빌드 통과 필수** — `docker compose build app`
4. 기능 추가 시 단위 테스트 동반 권장

### 개발 가이드

```bash
# 변경 후 검증
docker compose --profile tools run --rm test
docker compose build app

# DB 스키마 변경 시
# 1. prisma/schema.prisma 편집
# 2. 마이그레이션 생성
docker compose --profile tools run --rm \
  --entrypoint "" migrate \
  sh -c "npm ci && npx prisma migrate dev --name <변경_이름>"
```

### 커밋 컨벤션
- `feat:` 새 기능
- `fix:` 버그 수정
- `refactor:` 리팩터링
- `docs:` 문서
- `test:` 테스트
- `chore:` 빌드/설정

---

## 📄 라이선스

[MIT License](LICENSE) © 2026 nad4-su
