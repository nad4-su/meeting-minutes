# 🎙️ 5분만에 시작하기

> 회의 녹음 한 번으로 회의록까지 자동 작성하는 개인용 도구입니다. **본인 노트북에서 직접 실행**하며, 데이터는 본인 머신에만 저장됩니다.

## 사전 준비 (1분)

- [Docker Desktop](https://docs.docker.com/get-docker/) 설치
- Chrome 브라우저 (Web Speech API 필요)
- (선택) Gemini API 키 — 없어도 단순 변환은 동작

## 설치 (3분)

```bash
# 1. 코드 받기
git clone https://github.com/nad4-su/meeting-minutes.git
cd meeting-minutes

# 2. 환경 설정 — .env 파일 생성하고 비밀번호만 채우면 끝
cp .env.example .env

cat <<EOF >> .env

# 자동 생성된 강력한 비밀번호
EOF
PASS=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)
echo "POSTGRES_PASSWORD=$PASS" >> .env
echo "DATABASE_URL=postgresql://meetinguser:$PASS@localhost:5432/meetingminutes" >> .env

# 3. DB 초기화 + 앱 기동
docker compose --profile tools run --rm migrate
docker compose up -d
```

브라우저 → http://127.0.0.1:3000

## Gemini AI 요약 켜기 (1분, 선택)

1. https://aistudio.google.com/apikey 접속 (Google 계정 필요)
2. **Create API Key** 클릭 → 키 복사
3. 앱 우상단 **⚙️ 설정** → 키 붙여넣기 → 💾 저장 → 🧪 테스트 호출

> 🔒 키는 **본인 브라우저에만** 저장됩니다 (서버 DB / 다른 사람과 공유 X). 무료 등급 한도는 개인 사용에 충분합니다 (분당 15건, 일일 1000건).

## 기본 사용법

| 화면 | 단축 액션 |
|---|---|
| `/` (홈) | 🎤 녹음 시작 → 자동 텍스트화 → 자동 요약 → 📌 저장 |
| `/meetings` | 저장된 회의록 목록, 검색, 미완료 액션 위젯 |
| `/meetings/[id]` | ✅ 액션 체크 토글, ✏️ 편집, 📋 Docs용 복사, 🗑️ 삭제 |
| `/settings` | API 키 관리 |

### 추천 흐름
1. 홈에서 제목 입력 (선택)
2. 템플릿 선택 — 회의록 / 강의 / 1:1 / 브레인스토밍 / 인터뷰 / 원문 정리
3. **🎤 녹음 시작** → 발화 → 좌측에 텍스트 쌓이고 우측에 30초마다 중간 회의록 갱신
4. **녹음 중지** → 최종 회의록 자동 생성
5. **📌 저장** → 액션 아이템 자동 추출되어 체크리스트 등장
6. 필요하면 **📋 Docs용** 버튼으로 Google Docs에 서식 그대로 붙여넣기

## ⚠️ 사용 전 알아둘 것 — 개인정보 / 보안

### 외부로 전송되는 데이터
- **음성** → Chrome Web Speech API → **Google 서버** (Chrome 자체 동작)
- **transcript** → Gemini AI 요약 활성화 시 → **Google 서버**
- 데이터는 본인 머신과 Google 외에는 어디에도 가지 않음

### 사내 정책 확인 필요
다음 내용이 회의에 포함되면 **사용 보류 또는 단순 변환 모드만 사용**:
- 미공개 사업 정보 / 전략
- 인사 / 평가 정보
- 고객 개인정보
- 보안 / 컴플라이언스 데이터

### 단순 변환 모드 (오프라인 안전)
- API 키 없이도 동작 — 변환 모드에서 **`단순 변환`** 선택
- transcript를 마크다운 형식으로 정리만 함, 외부 호출 없음
- 단, **녹음 자체는 Chrome이 Google로 보냄** — 완전 오프라인이 필요하면 이 도구 사용 안 권장

## 자주 쓰는 명령

```bash
# 로그 보기
docker compose logs -f app

# 잠깐 끄기 (데이터 유지)
docker compose down

# 다시 켜기
docker compose up -d

# 코드 업데이트 받기
git pull
docker compose --profile tools run --rm migrate  # 마이그레이션 있을 시
docker compose up -d --build

# 데이터 백업
docker compose exec db pg_dump -U meetinguser meetingminutes > backup-$(date +%Y%m%d).sql

# 완전 삭제 (회의록 모두 잃음)
docker compose down -v
```

## 도움 / 피드백

- 👤 메인테이너: [@nad4-su](https://github.com/nad4-su)
- 🐛 이슈 / 기능 제안: [GitHub Issues](https://github.com/nad4-su/meeting-minutes/issues)
- 📋 **실사용 피드백 (적극 환영)**: [Issue #10](https://github.com/nad4-su/meeting-minutes/issues/10)
- 📖 자세한 보안 모델: [SECURITY.md](../SECURITY.md)
- 🗺️ 로드맵: [docs/ROADMAP.md](ROADMAP.md)

---

**한 줄 요약**: 본인 노트북에서 `docker compose up`만 하면 시작. 회의 데이터는 본인 머신에만 저장. 민감 회의는 사내 정책 먼저 확인.
