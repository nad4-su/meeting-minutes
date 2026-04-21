# Phase 1 UI — 저장/목록/상세 + Markdown + 검색

ROADMAP Phase 1의 #3~#7 완료. PR #1 (`feat/phase-1-foundation`) 위에 스택됨.

## Base
- 🧱 **Base branch**: `feat/phase-1-foundation` (병합 전이라면 PR#1을 먼저 머지)
- Main에 직접 머지하고 싶다면 base를 `main`으로 바꾸면 두 PR의 변경이 합쳐져서 올라감

## 포함된 변경

### 📦 의존성
- `marked@^16.4.0`
- `isomorphic-dompurify@^2.29.0`
- `@prisma/adapter-pg@^7.7.0`, `pg@^8.13.1`, `@types/pg`
  (Prisma 7의 `prisma-client` 엔진은 driver adapter 필수)

### 🎨 Markdown 라이브러리 (#6)
- `src/lib/markdown.ts` — `renderMarkdownToSafeHtml`, `markdownToPlainText`
- 기존 커스텀 파서(`export-minutes.ts`) 교체
- 표/리스트/인용/코드블록 정상 렌더, XSS sanitize 테스트 포함
- `globals.css`에 `.prose-minutes` 공통 스타일

### 💾 저장 버튼 (#3)
- `MinutesViewer`에 `📌 저장` → `POST /api/meetings`
- 생성 당시 설정(template/depth/mode/customPrompt) 함께 저장
- 저장 성공 시 `/meetings/[id]` 이동 배너
- 미리보기 ↔ 원문 토글

### 📚 목록 페이지 `/meetings` (#4)
- 서버 컴포넌트 (Prisma 직접 조회)
- `MeetingCard` — 제목/날짜/템플릿 배지/참석자/태그/preview
- 빈 상태 UI (검색 시 vs 최초)
- prev/next 페이지네이션

### 📄 상세 페이지 `/meetings/[id]` (#5)
- 서버 컴포넌트 + 클라이언트 편집 island
- 제목/본문/참석자/태그 인라인 편집
- 편집 모드는 좌(textarea) · 우(live preview) 분할
- 삭제 confirm
- 원본 transcript는 `<details>`로 접어둠

### 🔍 검색 (#7)
- `MeetingSearchBar` 클라이언트 컴포넌트
- 300ms debounce + `useTransition` + URL query 동기화
- 서버에서 `ILIKE contains` — title/transcript/markdown
- `tsvector` GIN 인덱스는 후속 (개인용 규모에서 `ILIKE`로 충분)

### 🔧 Prisma 7 호환
- `generator client` → `prisma-client-js` (안정적)
- `@prisma/adapter-pg`로 driver adapter 사용
- `src/lib/db.ts`: `DATABASE_URL` 누락 시 placeholder fallback (build-time 안전)
- DB 접근 페이지/라우트에 `export const dynamic = 'force-dynamic'`
- Dockerfile에서 `src/generated` 복사 제거

### 🧪 테스트
- `src/__tests__/markdown.test.ts` 9개 추가 (렌더/sanitize/plain text)
- 전체: **80 tests passing** (이전 71 + 9)

## 확인 방법

```bash
# DB + migrate 전제 (PR#1 참고)
docker compose up -d db
docker compose --profile tools run --rm migrate

# 빌드 + 기동
docker compose up -d --build app
```

### 사용 흐름
1. `http://localhost:3000`에서 녹음/업로드 → 회의록 생성
2. `📌 저장` 버튼 클릭 → 배너에 `/meetings/[id]` 링크
3. 링크 클릭 → 상세 페이지 → `✏️ 편집` → 마크다운/참석자/태그 수정 → 저장
4. 상단 `← 목록으로` → `/meetings` 카드 그리드
5. 검색창에 키워드 입력 → 300ms 후 필터링
6. 삭제는 🗑️ 아이콘 (confirm 후 목록으로 복귀)

## 스크린샷

사용자가 직접 찍어서 추가 예정.

## Breaking changes
- 기존 녹음/요약 흐름은 유지
- Prisma 6에서 올라온 환경은 `@prisma/adapter-pg` 추가 설치 필요 (package.json에 이미 반영)
- Dockerfile의 `COPY src/generated` 제거 — 기존 이미지 캐시는 재빌드 필요

## 남은 Phase 1 후속 (이 PR 범위 아님)
- tsvector GIN 인덱스 (성능 이슈 체감 시)
- 태그/참석자 필터 UI (검색바 외 패싯) — Phase 3에서 다룰 예정
