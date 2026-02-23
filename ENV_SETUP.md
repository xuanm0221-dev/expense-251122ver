# 환경 변수 설정 가이드

비용 계정 상세 분석 표의 **계산근거·설명 편집** 및 **예산구조진단 보고서 편집·저장** 기능을 사용하려면 아래 환경 변수를 설정해야 합니다.

---

## 저장 방식 (환경별)

| 환경 | 저장 위치 |
|---|---|
| Vercel (Redis 설정 시) | Redis (Upstash) — 배포된 대시보드의 최종본 |
| 로컬 (Redis 미설정) | `data/cost-descriptions/` 폴더 및 `data/report-html.json` |

로컬에서 수정해도 Vercel(Redis)의 데이터를 덮어쓰지 않습니다.

---

## 1. 편집 비밀번호 (`EDIT_PASSWORD`)

계산근거, 설명, 보고서 내용 저장 시 요구하는 비밀번호입니다.

### Vercel 설정

1. Vercel 프로젝트 대시보드 → **Settings** → **Environment Variables**
2. 다음 변수 추가:
   - Key: `EDIT_PASSWORD`
   - Value: (사용할 비밀번호)
   - Environment: Production, Preview, Development 모두 체크
3. **Save** 클릭

### 로컬 설정

`.env.local` 파일에 추가:

```env
EDIT_PASSWORD=사용할비밀번호
```

---

## 2. Redis 설정 (`KV_REST_API_URL` / `KV_REST_API_TOKEN`)

Vercel 배포 환경에서 설명·계산근거가 영구 저장되려면 Redis(Upstash) 설정이 필요합니다.

1. [Upstash](https://upstash.com) 접속 → Redis 데이터베이스 생성
2. Vercel 프로젝트 **Settings** → **Environment Variables**에서 추가:
   - Key: `KV_REST_API_URL` / Value: Upstash REST API URL
   - Key: `KV_REST_API_TOKEN` / Value: Upstash REST API Token
3. **Save** 후 재배포

---

## 3. 환경 변수 체크리스트

### Vercel (배포 환경)

- `EDIT_PASSWORD` — 필수
- `KV_REST_API_URL` — Redis 사용 시 필수
- `KV_REST_API_TOKEN` — Redis 사용 시 필수

### 로컬 (개발 환경, `.env.local`)

- `EDIT_PASSWORD` — 필수
- Redis 변수는 설정하지 않으면 파일 저장 모드로 동작

---

## 4. 주의사항

- `EDIT_PASSWORD`는 보안이 중요하다면 추측하기 어려운 값으로 설정하세요.
- 환경 변수는 절대 Git에 커밋하지 마세요. (`.env.local`은 `.gitignore`에 포함됨)
- 로컬에서 Redis 변수를 설정하지 않으면 `data/cost-descriptions/` 폴더에 파일로 저장되며, 배포된 Vercel(Redis) 데이터와는 독립적으로 동작합니다.
