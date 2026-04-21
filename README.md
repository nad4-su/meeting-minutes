# Meeting Minutes — 실시간 AI 회의록

음성 녹음을 실시간으로 텍스트·요약으로 변환하고, 구조화된 회의록을 자동 생성하는 웹 서비스.

향후 로드맵 — 노션 AI Meeting Notes 수준의 워크스페이스: [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## 현재 기능 (Phase 0)

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

### 화면
- 녹음 시 **좌(실시간 텍스트) · 우(실시간 회의록)** 분할 뷰
- 확정 전 interim 텍스트는 회색 이탤릭 + 깜빡이는 커서
- 새 내용 도착 시 자동 스크롤
- 진행률 바 (첫 요약까지 단어 수), 쿨다운 카운터

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) + TypeScript |
| STT (실시간) | Web Speech API — Chrome 내장, 무료 |
| AI 요약 | Gemini 2.5 Flash Lite — 무료 등급 15 RPM / 1000 RPD |
| DB | PostgreSQL 16 + Prisma 7 (스키마 준비, Phase 1에서 활용 예정) |
| 테스트 | Vitest (38 tests, jsdom) |
| 배포 | Docker Compose (app + db + test profile) |

---

## 빠른 시작 (Docker Compose)

### 1. 준비

```bash
git clone git@github.com:nad4-su/meeting-minutes.git
cd meeting-minutes
cp .env.example .env
```

`.env`에서 **`GEMINI_API_KEY`** 설정 ([Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급).
> 키가 없어도 "단순 변환" 모드는 정상 동작.

### 2. 기동

```bash
docker compose up -d --build
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 → **Chrome 권장** (Web Speech API).

### 3. 확인 방법

1. 회의 제목 입력 (선택)
2. **Gemini AI 요약** 모드 (기본값)
3. **녹음 시작** → 마이크 권한 허용
4. 말하기 시작 → 좌측 실시간 텍스트, 25단어 이상 쌓이면 우측에 중간 회의록 생성
5. **녹음 중지** → 최종 회의록이 페이지 하단에 자동 생성됨

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
│   │   └── summarize-live/route.ts      # 실시간 중간 요약
│   ├── page.tsx                         # 메인 UI
│   └── layout.tsx
├── lib/
│   ├── audio-validation.ts
│   ├── upload-handler.ts
│   ├── transcript-formatter.ts
│   ├── minutes-generator.ts             # 최종 요약 생성
│   ├── live-summary.ts                  # 롤링 요약 생성
│   └── export-minutes.ts
├── hooks/
│   ├── useSpeechRecognition.ts          # Web Speech API + 네트워크 재시도
│   └── useLiveSummary.ts                # 30s 폴링 + 429 쿨다운 + 증분 게이트
├── components/
│   ├── upload/AudioUploader.tsx
│   ├── recorder/LiveRecorder.tsx        # 좌우 분할 뷰
│   └── minutes/MinutesViewer.tsx
└── __tests__/                           # 38 tests

docs/
├── ROADMAP.md                           # 개발 로드맵 (Phase 0~4)
└── CREATE_ISSUES.sh                     # gh CLI용 이슈 자동 생성 스크립트

prisma/
└── schema.prisma                        # Meeting 모델 (Phase 1에서 활용)
```

---

## 로드맵 요약

상세: [`docs/ROADMAP.md`](docs/ROADMAP.md)

| Phase | 내용 | 상태 |
|---|---|---|
| **0** | 실시간 전사 + 롤링 요약 + 자동 최종 생성 | ✅ 완료 |
| **1** | 회의 저장/조회/검색 워크스페이스 | 📋 기획됨 |
| **2** | 구조화된 액션 아이템 (Gemini JSON + 체크리스트) | 📋 기획됨 |
| **3** | 참석자 + 태그 시스템 | 📋 기획됨 |
| **4** | 차별화 기능 (화자 구분, 캘린더, AI Q&A, 블록 에디터) | 💡 선택 |

### 진행 관리
1. `gh auth login` 후 `bash docs/CREATE_ISSUES.sh` — 4개 epic issue 자동 생성
2. 이슈당 1 브랜치 1 PR 원칙
3. PR 머지 전 `docker compose --profile tools run --rm test` 필수
4. 완료 시 `docs/ROADMAP.md` 체크박스 업데이트

---

## 알려진 제약

- **Chrome 전용**: Web Speech API 비표준 — Safari/Firefox는 제한적 (Phase 4 #15에서 서버 사이드 전사로 해결 예정)
- **화자 구분 불가**: Web Speech API가 지원하지 않음. Phase 4 #15에서 Gemini 2.5 오디오 입력 또는 AssemblyAI 경로 계획됨
- **녹음 저장 없음**: 현재 페이지 세션 내에서만 유지됨. Phase 1에서 DB 영속화
- **Gemini 무료 등급**: 15 RPM / 1000 RPD — 개인 사용에 충분하나 팀 단위는 유료 전환 권장
