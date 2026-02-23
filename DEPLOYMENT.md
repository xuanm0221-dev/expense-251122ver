# 배포 및 운영 가이드

F&F China Expense Dashboard의 실무 운영 워크플로우를 정리한 문서입니다.

---

## 목차

1. [데이터 업데이트 및 배포](#1-데이터-업데이트-및-배포)
2. [코드 변경 및 배포](#2-코드-변경-및-배포)
3. [환경 변수](#3-환경-변수)
4. [Vercel 설정](#4-vercel-설정)
5. [문제 해결](#5-문제-해결)

---

## 1. 데이터 업데이트 및 배포

### 데이터 흐름

```
파일/ (CSV 원본)
  └─ python scripts/preprocess_expense.py (로컬 실행)
       └─ data/aggregated-expense.json
            └─ git push → Vercel 자동 배포
                 └─ /api/expense-data (JSON 직접 반환)
```

> **중요**: Vercel 서버리스 환경에서는 Python 실행이 불가합니다.  
> `aggregated-expense.json`은 반드시 로컬에서 생성 후 git에 커밋해야 합니다.

### 업데이트 절차

```bash
# 1. 파일/ 폴더의 CSV 파일 최신화 후 전처리 실행
run_preprocess.bat
# 또는: python scripts/preprocess_expense.py

# 2. (선택) 로컬 개발 서버에서 데이터 확인
npm run dev
# http://localhost:3000

# 3. 빌드 테스트
npm run build

# 4. 커밋 & 푸시
git add data/aggregated-expense.json
git commit -m "데이터 업데이트: YYYY-MM"
git push origin main
```

Vercel이 `main` 브랜치 푸시를 감지하여 자동 재배포합니다.

---

## 2. 코드 변경 및 배포

```bash
# 1. 빌드 오류 사전 확인
npm run build

# 2. 커밋 & 푸시
git add .
git commit -m "변경 내용 요약"
git push origin main
```

### Git 저장소 정보

- **GitHub**: `https://github.com/xuanm0221-dev/expense-251122ver`
- **배포 브랜치**: `main`

---

## 3. 환경 변수

자세한 내용은 [ENV_SETUP.md](./ENV_SETUP.md) 참고.

### 필수 환경 변수 (Vercel)

| 변수명 | 용도 |
|---|---|
| `EDIT_PASSWORD` | 설명·계산근거·보고서 편집 비밀번호 |
| `KV_REST_API_URL` | Redis(Upstash) URL |
| `KV_REST_API_TOKEN` | Redis(Upstash) Token |

### 로컬 (.env.local)

```env
EDIT_PASSWORD=비밀번호
# Redis 변수는 로컬에서는 설정 불필요 (파일로 저장)
```

### 설명·계산근거 저장 방식

| 환경 | 저장 위치 |
|---|---|
| Vercel (Redis 설정 시) | Redis (Upstash) |
| 로컬 또는 Redis 미설정 | `data/cost-descriptions/` 폴더 |

---

## 4. Vercel 설정

### 프로젝트 설정

| 항목 | 값 |
|---|---|
| Framework | Next.js (자동 감지) |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Root Directory | `./` |

### 환경 변수 추가 방법

1. Vercel 프로젝트 대시보드 접속
2. **Settings** → **Environment Variables**
3. 각 변수 추가 후 **Save**
4. 재배포 (자동 또는 수동 Redeploy)

---

## 5. 문제 해결

### Vercel 빌드 실패

1. 로컬에서 먼저 확인:
   ```bash
   npm run build
   ```
2. Vercel 대시보드 → Deployments → 실패 배포 → Build Logs 확인
3. 일반적인 원인:
   - TypeScript 타입 오류
   - `data/aggregated-expense.json` 누락 또는 형식 오류
   - 패키지 의존성 문제

### 데이터가 업데이트되지 않음

- `data/aggregated-expense.json`이 최신 데이터로 커밋됐는지 확인
- Vercel 배포가 완료됐는지 확인 (배포 중에는 이전 데이터 표시)

### 설명·계산근거가 저장되지 않음

- Vercel 환경 변수 `EDIT_PASSWORD`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` 설정 확인
- [ENV_SETUP.md](./ENV_SETUP.md) 참고

### 자동 배포가 실행되지 않음

- Vercel 프로젝트 Settings → Git → Production Branch가 `main`인지 확인
- GitHub 연결 상태 확인

---

## 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Upstash Redis](https://upstash.com)
