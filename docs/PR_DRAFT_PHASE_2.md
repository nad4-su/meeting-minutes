# Phase 2 — 액션 아이템 추출/체크리스트 + Google Docs 호환 복사

ROADMAP Phase 2 (#8~#11) + 사용자 추가 요청.

## Base
- 🧱 **Base**: `feat/web-api-key-settings` (PR #3 위에 스택)

## 설계 결정 — 휴리스틱 vs Gemini JSON

ROADMAP은 Gemini JSON 출력 + zod 검증을 명시했지만 **마크다운 체크박스 휴리스틱**으로 갈음:

| 방식 | 장점 | 단점 |
|---|---|---|
| **휴리스틱 (채택)** | Gemini 호출 0, 모든 템플릿 호환, 즉시 동작 | assignee/dueDate 미추출 |
| Gemini JSON | 구조화된 출력, 정확한 메타 | 호출 추가, 프롬프트 재작성, zod 검증 |

후속에 정확도 부족 체감 시 JSON 모드로 업그레이드 가능 (테이블 스키마는 이미 확장 가능).

## 변경

### 신규 파일
- `prisma/migrations/20260428071709_add_action_items/`
- `src/lib/action-items.ts` — `parseActionItems(markdown)`
- `src/app/api/action-items/[id]/route.ts` — PATCH/DELETE
- `src/app/api/meetings/[id]/reparse-action-items/route.ts` — POST
- `src/components/meeting/ActionItemList.tsx` — 체크리스트 UI
- `src/__tests__/action-items.test.ts` — 8 tests

### 수정
- `prisma/schema.prisma` — ActionItem 모델
- `src/app/api/meetings/route.ts` — POST 시 자동 추출, GET에 미완료 카운트
- `src/app/api/meetings/[id]/route.ts` — actionItems include
- `src/app/meetings/page.tsx` — 미완료 위젯 (최근 5)
- `src/app/meetings/[id]/page.tsx` — actionItems 전달
- `src/components/meeting/MeetingCard.tsx` — 미완료 배지
- `src/components/meeting/MeetingDetail.tsx` — ActionItemList 통합 + 📋 Docs용 버튼
- `src/components/minutes/MinutesViewer.tsx` — 📋 Docs용 버튼
- `src/lib/markdown.ts` — `copyMarkdownAsRichText()` 추가

## API 시그니처

```http
POST /api/meetings
{ title, markdownMinutes, ... }
→ 201 { ...meeting, actionItems: [{ id, task, isDone, position }] }

PATCH /api/action-items/[id]
{ isDone?: boolean, task?: string }
→ 200 { ...item }

DELETE /api/action-items/[id]
→ 204

POST /api/meetings/[id]/reparse-action-items
→ 200 { actionItems: [...], replaced: N }
```

## UX 흐름

1. 회의록 생성 → `📌 저장` → 마크다운의 `- [ ]` 자동 추출
2. `/meetings/[id]` 상세 → 본문 아래 ✅ **액션 아이템** 섹션
3. 체크박스 클릭 (낙관적 업데이트, 서버 PATCH)
4. 본문 편집 후 새 항목 추가 시 → `🔄 재추출` 버튼으로 동기화
   ⚠️ 재추출은 토글 상태를 모두 초기화 (confirm 표시)
5. `/meetings` 상단에서 "내 미완료 액션 (최근 5)" 한눈에 파악

## Google Docs 복사 (사용자 추가 요청)

`copyMarkdownAsRichText(markdown)`:
- 1차: `navigator.clipboard.write([new ClipboardItem({ 'text/html', 'text/plain' })])` (모던 브라우저)
- 폴백: 임시 contenteditable + `document.execCommand('copy')`

→ Google Docs / Word / Notion에 붙여넣으면 **헤딩/리스트/굵게/코드/표 서식 유지**.

버튼 라벨링 정리:
- `📋 .md` — 마크다운 원문 복사
- `📋 Docs용` — 서식 유지 복사 (파랑색 강조)
- `⬇ .md` / `⬇ .html` — 파일 다운로드

## 테스트
- 102 tests passing (이전 94 + 8 action-items)

## 확인 방법

```bash
# 마이그레이션 적용 (action_items 테이블 추가)
docker compose --profile tools run --rm migrate

# 빌드 + 기동
docker compose up -d --build app
```

체크 시나리오:
1. 회의 녹음 → 마크다운에 `- [ ] 항목` 자동 포함된 상태로 생성
2. 📌 저장 → /meetings/[id] 이동
3. 체크박스 토글 → 진행률 변화, 새로고침해도 유지
4. 본문 편집 → `- [ ] 새 항목` 추가 → 저장 → 🔄 재추출 → 새 항목 등장
5. 📋 Docs용 → Google Docs에 붙여넣어 서식 확인
6. /meetings → 카드 배지 + 상단 위젯 노출 확인

## Breaking changes
- 마이그레이션 필요 (`action_items` 테이블)
- 기존 회의록은 액션 아이템이 비어있음 — 상세에서 🔄 재추출 한 번 누르면 채워짐

## 후속 (이 PR 범위 아님)
- Gemini JSON 출력 모드 (assignee/dueDate 정확 추출)
- 홈 페이지를 대시보드로 승격
- 액션 아이템 직접 추가 (체크리스트 UI에서 +)
