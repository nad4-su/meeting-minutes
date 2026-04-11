# Meeting Minutes - 회의록 자동 작성 서비스

음성 녹음을 텍스트로 변환하고, 구조화된 회의록을 자동 생성하는 웹 서비스입니다.

## 주요 기능

- **실시간 녹음** — 브라우저에서 바로 음성 인식 (Web Speech API, Chrome 권장)
- **파일 업로드** — MP3, WAV, WebM, M4A, OGG, FLAC 지원 (최대 500MB)
- **두 가지 변환 모드** — 단순 STT→마크다운 변환 / Gemini AI 요약 비교
- **내보내기** — 마크다운(.md), HTML(.html) 다운로드 및 클립보드 복사
- **회의록 저장** — PostgreSQL 데이터베이스 영속 저장

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 + TypeScript |
| STT | Web Speech API (무료) |
| AI 요약 | Gemini API (무료 티어) |
| DB | PostgreSQL 16 + Prisma ORM |
| 테스트 | Vitest (31개 테스트, 96% 커버리지) |
| 배포 | Docker Compose |

## Docker로 실행하기

### 사전 요구사항

- [Docker](https://docs.docker.com/get-docker/) 및 [Docker Compose](https://docs.docker.com/compose/install/) 설치

### 1. 저장소 클론

```bash
git clone git@github.com:nad4-su/meeting-minutes.git
cd meeting-minutes
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 필요한 값을 수정합니다:

```env
# PostgreSQL (기본값 사용 가능)
DATABASE_URL="postgresql://meetinguser:meetingpass@db:5432/meetingminutes"
POSTGRES_USER=meetinguser
POSTGRES_PASSWORD=meetingpass
POSTGRES_DB=meetingminutes

# Gemini API (선택사항 - AI 요약 기능에 필요)
# https://aistudio.google.com/apikey 에서 무료 발급
GEMINI_API_KEY=여기에_API_키_입력
```

> Gemini API 키가 없어도 **단순 변환** 모드는 정상 동작합니다.

### 3. Docker Compose 실행

```bash
docker compose up -d
```

처음 실행 시 이미지 빌드에 시간이 걸릴 수 있습니다.

### 4. DB 마이그레이션

```bash
docker compose exec app npx prisma migrate deploy
```

### 5. 접속

브라우저에서 [http://localhost:3000](http://localhost:3000)에 접속합니다.

### 서비스 관리

```bash
# 로그 확인
docker compose logs -f app

# 서비스 중지
docker compose down

# 서비스 중지 + DB 데이터 삭제
docker compose down -v

# 이미지 재빌드 (코드 변경 후)
docker compose up -d --build
```

## 로컬 개발 (Docker 없이)

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다.

### 테스트

```bash
npm test                # 전체 테스트
npm run test:watch      # 워치 모드
npm run test:coverage   # 커버리지 리포트
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts         # 파일 업로드 API
│   │   └── summarize/route.ts      # 회의록 생성 API
│   ├── page.tsx                    # 메인 UI
│   └── layout.tsx
├── lib/
│   ├── audio-validation.ts         # 오디오 파일 검증
│   ├── upload-handler.ts           # 업로드 처리
│   ├── transcript-formatter.ts     # STT 결과 포매팅
│   ├── minutes-generator.ts        # 회의록 생성 (단순/Gemini)
│   └── export-minutes.ts           # MD/HTML 내보내기
├── hooks/
│   └── useSpeechRecognition.ts     # 실시간 음성 인식 훅
├── components/
│   ├── upload/AudioUploader.tsx
│   ├── recorder/LiveRecorder.tsx
│   └── minutes/MinutesViewer.tsx
└── __tests__/                      # 31개 테스트
```
