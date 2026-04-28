# Phase 1 Foundation — Prisma 연동 + 회의록 CRUD API

ROADMAP Phase 1의 #1 (Prisma 셋업), #2 (회의 저장 API) 완료.

## 포함된 변경

### 🔧 인프라
- `src/lib/db.ts` — Prisma 클라이언트 싱글톤 (dev HMR 대응)
- `prisma/schema.prisma` — Meeting 모델 확장
  - `attendees`, `tags`: `String[]` (Phase 3에서 UI 노출 예정)
  - `template`, `depth`, `summaryMode`, `customPrompt`: 생성 당시 설정 보존 (재생성/디버깅용)
  - `createdAt` 인덱스 (목록 쿼리 최적화)
- 첫 마이그레이션 `20260421104750_init` 생성·커밋
- `docker-compose.yml` — `tools` 프로필에 `migrate` 서비스 추가
  (app 이미지에 prisma CLI를 포함시키지 않고 독립 실행)

### 🔌 API
- `GET /api/meetings`
  - 쿼리 파라미터: `q` (제목/transcript/markdown 부분 검색), `limit` (default 20, max 100), `offset`
  - 응답: `{ meetings, total, limit, offset }` (카드 렌더용 필드만 select)
- `POST /api/meetings`
  - 필수: `title`, `markdownMinutes`
  - 선택: `rawTranscript`, `summaryMode`, `template`, `depth`, `customPrompt`, `attendees[]`, `tags[]`
  - 배열 타입 외 값은 빈 배열로 정규화
- `GET /api/meetings/[id]` — 상세, 404
- `PUT /api/meetings/[id]` — `title`/`markdownMinutes`/`attendees`/`tags`만 편집 허용
- `DELETE /api/meetings/[id]` — 204 / 404

### ✅ 테스트
- `src/__tests__/meetings-api.test.ts` — Prisma mock 기반 14개 케이스 추가
- 전체: **71 tests passing** (이전 57 + 14)

### 📝 문서
- `README.md` — "DB 마이그레이션 실행" 단계 추가
- `docs/ROADMAP.md` — Phase 1 #1/#2 체크박스 완료 표시

## 확인 방법

```bash
# 1. DB 기동
docker compose up -d db

# 2. 마이그레이션 적용 (최초 1회)
docker compose --profile tools run --rm migrate

# 3. 테스트
docker compose --profile tools run --rm test

# 4. 앱 기동
docker compose up -d --build app
```

`curl`로 API 스모크 테스트:
```bash
# 빈 목록
curl http://localhost:3000/api/meetings

# 생성
curl -X POST http://localhost:3000/api/meetings \
  -H 'Content-Type: application/json' \
  -d '{"title":"테스트","markdownMinutes":"# 내용"}'

# 조회 / 수정 / 삭제
curl http://localhost:3000/api/meetings/<id>
```

## 이 PR에 없는 것 (다음 PR 예정)

- [ ] #3 `marked` + `DOMPurify` 도입 (기존 커스텀 markdown 파서 교체)
- [ ] #4 MinutesViewer에 "저장" 버튼 — 생성 결과를 DB에 저장하는 UI
- [ ] #5 `/meetings` 목록 페이지
- [ ] #6 `/meetings/[id]` 상세 + 인라인 편집
- [ ] #7 전역 검색 (tsvector 기반, 지금은 단순 `contains`)

## Breaking changes
없음. 기존 녹음/요약 흐름은 그대로 동작.

## 마이그레이션 주의
첫 실행 시 `meetings` 테이블이 생성됨. 기존 개발 DB가 있다면 `prisma migrate resolve` 또는 `docker compose down -v`로 초기화 필요.
