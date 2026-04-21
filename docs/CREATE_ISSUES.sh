#!/usr/bin/env bash
# GitHub Issues 생성 스크립트
# 사전 조건: gh auth login 완료, 저장소 내에서 실행
# 사용: bash docs/CREATE_ISSUES.sh

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI가 필요합니다: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub 로그인이 필요합니다: gh auth login"
  exit 1
fi

# Epic 레이블 생성 (이미 있으면 무시)
gh label create "phase-1" --color "0e8a16" --description "Phase 1 — Workspace basics" 2>/dev/null || true
gh label create "phase-2" --color "1d76db" --description "Phase 2 — Action items" 2>/dev/null || true
gh label create "phase-3" --color "5319e7" --description "Phase 3 — Attendees & tags" 2>/dev/null || true
gh label create "phase-4" --color "b60205" --description "Phase 4 — Advanced (opt-in)" 2>/dev/null || true
gh label create "epic" --color "fbca04" --description "Phase-level epic" 2>/dev/null || true

# Epic issues (각 phase 하나씩)
gh issue create \
  --title "[Epic] Phase 1 — 회의 저장/조회 워크스페이스" \
  --label "epic,phase-1" \
  --body "$(cat <<'BODY'
노션 Meeting Database 수준 구현. 세부 내용은 [docs/ROADMAP.md](../blob/main/docs/ROADMAP.md) 참조.

## 하위 작업
- [ ] #1 Prisma 연결 + 마이그레이션 파이프라인
- [ ] #2 회의 저장 API (GET/POST/PUT/DELETE)
- [ ] #3 MinutesViewer 저장 버튼
- [ ] #4 회의 목록 페이지
- [ ] #5 회의 상세 페이지
- [ ] #6 Markdown 렌더링 라이브러리 도입 (marked + DOMPurify)
- [ ] #7 전역 검색 (Postgres tsvector)

## 완료 기준
- 녹음한 회의를 DB에 저장하고 나중에 재조회/편집 가능
- Markdown이 표·리스트·인라인 포맷 제대로 렌더됨
- 제목/transcript 검색 동작
BODY
)"

gh issue create \
  --title "[Epic] Phase 2 — 구조화된 액션 아이템" \
  --label "epic,phase-2" \
  --body "$(cat <<'BODY'
"회의 끝나면 내 할 일이 명확" 경험 제공. 세부: [docs/ROADMAP.md](../blob/main/docs/ROADMAP.md).

## 하위 작업
- [ ] #8 Gemini 프롬프트 JSON 출력 + zod 검증
- [ ] #9 ActionItem 테이블 + Meeting 관계
- [ ] #10 체크리스트 UI (체크박스 토글)
- [ ] #11 대시보드 페이지 (미완료 액션 + 최근 회의)

## 완료 기준
- 회의 생성 시 액션 아이템이 구조화 저장됨
- 사용자가 홈에서 미완료 할 일을 한눈에 확인
BODY
)"

gh issue create \
  --title "[Epic] Phase 3 — 참석자 + 태그" \
  --label "epic,phase-3" \
  --body "$(cat <<'BODY'
회의 메타데이터 관리 + 필터링. 세부: [docs/ROADMAP.md](../blob/main/docs/ROADMAP.md).

## 하위 작업
- [ ] #12 참석자 입력 UI
- [ ] #13 태그 시스템 (프리셋 + 커스텀)
- [ ] #14 Gemini 프롬프트에 참석자 컨텍스트 주입

## 완료 기준
- 회의 목록에서 참석자/태그로 필터링 가능
- 액션 아이템 담당자 자동 배정 정확도 개선
BODY
)"

gh issue create \
  --title "[Epic] Phase 4 — 차별화 기능 (캘린더, AI Q&A)" \
  --label "epic,phase-4" \
  --body "$(cat <<'BODY'
선택적 고급 기능. 각 이슈 단독 진행 가능. 세부: [docs/ROADMAP.md](../blob/main/docs/ROADMAP.md).

## 하위 작업
- [ ] #16 Google Calendar 연동
- [ ] #17 AI Q&A (RAG with pgvector)
- [ ] #18 후속 이메일 초안 생성
- [ ] #19 블록 기반 에디터 (우선순위 낮음)

## Non-goal
- 화자 구분은 개인용 범위에 과하여 비목표로 이전

## 완료 기준
각 sub-issue 독립 완료. 전체 Phase 4 완료는 #18 최소 달성 시 간주.
BODY
)"

echo ""
echo "✅ 4개 epic issue 생성 완료"
echo "세부 task 이슈는 해당 phase 작업 시작 시 개별 생성 권장"
