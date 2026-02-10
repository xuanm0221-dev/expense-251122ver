# 환경 변수 설정 가이드

## 계산근거·설명 편집 기능을 위한 환경 변수 설정

비용 계정 상세 분석 표에서 **계산근거**와 **설명**을 저장하려면 아래 환경 변수를 설정해야 합니다.

### 데이터 저장 방식 (환경별)

- **배포(Vercel)**: `KV_REST_API_URL`, `KV_REST_API_TOKEN`을 설정하면 **Redis(Upstash)**에 저장됩니다. 배포된 대시보드에 보이는 내용 = Redis = 외부에서 저장한 최종본입니다.
- **로컬**: Redis 환경 변수를 **설정하지 않으면** `data/cost-descriptions/` **파일**에만 저장됩니다. 로컬에서 수정해도 배포된 대시보드(Redis)를 덮어쓰지 않습니다.

---

### 1. 편집 비밀번호 설정

#### Vercel 대시보드에서 설정

1. Vercel 프로젝트 대시보드 접속
2. **Settings** → **Environment Variables** 선택
3. 다음 환경 변수 추가:
   - **Key**: `EDIT_PASSWORD`
   - **Value**: `1234` (또는 사용할 비밀번호)
   - **Environment**: Production, Preview, Development 모두 선택
4. **Save** 클릭

#### 로컬 개발 환경 설정

`.env.local` 파일에 추가:

```env
EDIT_PASSWORD=1234
```

로컬에서 **파일 저장만** 사용하려면 Redis 관련 변수(`KV_REST_API_URL`, `KV_REST_API_TOKEN`)는 넣지 마세요.

---

### 2. Redis 설정 (Vercel 배포 시 필수)

배포된 대시보드에서 계산근거·설명이 저장·조회되려면 Vercel에 Redis(Upstash) 환경 변수를 설정해야 합니다.

1. [Upstash](https://upstash.com)에서 Redis 데이터베이스 생성
2. Vercel 프로젝트 **Settings** → **Environment Variables**에서 추가:
   - **Key**: `KV_REST_API_URL`  
     **Value**: Upstash 대시보드의 REST API URL
   - **Key**: `KV_REST_API_TOKEN`  
     **Value**: Upstash 대시보드의 REST API Token
3. **Save** 후 재배포

이렇게 설정하면 배포된 사이트에서는 Redis에만 읽기/쓰기가 이루어지며, 외부에서 저장한 내용이 최종본으로 표시됩니다.

---

### 3. 환경 변수 확인

- ✅ **Vercel**: `EDIT_PASSWORD`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` 설정
- ✅ **로컬**: `EDIT_PASSWORD`만 설정 (Redis 변수는 제거 시 파일 저장만 사용)
- ✅ 로컬 파일 저장 시 `data/cost-descriptions/` 디렉토리는 자동 생성됨

---

### 4. 테스트

1. 대시보드 상세 페이지에서 계산근거 또는 설명 편집
2. 저장 버튼 클릭 시 비밀번호 모달이 나타나는지 확인
3. 올바른 비밀번호(예: 1234) 입력 시 저장되는지 확인
4. 잘못된 비밀번호 입력 시 "비밀번호가 올바르지 않습니다." 메시지가 표시되는지 확인

---

### 주의사항

- `EDIT_PASSWORD`는 배포 시 반드시 설정하세요. 보안이 중요하면 1234 대신 강력한 비밀번호를 사용하세요.
- 환경 변수는 Git에 커밋하지 마세요 (`.env.local`은 `.gitignore`에 포함됨).
- 로컬에서 Redis 변수를 제거하면 파일만 사용하므로, 배포된 대시보드(Redis) 데이터를 덮어쓰지 않습니다.
