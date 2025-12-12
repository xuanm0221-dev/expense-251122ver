# 환경 변수 설정 가이드

## 설명 편집 기능을 위한 환경 변수 설정

설명 편집 기능이 정상적으로 작동하려면 다음 환경 변수를 설정해야 합니다.

### 1. Vercel KV 설정

#### Vercel 대시보드에서 설정

1. Vercel 프로젝트 대시보드 접속
2. **Settings** → **Storage** → **Create Database** 선택
3. **KV (Upstash)** 선택
4. 데이터베이스 이름 입력 후 생성
5. 생성된 KV 데이터베이스의 환경 변수가 자동으로 추가됩니다:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

#### 로컬 개발 환경 설정

로컬에서 개발할 때는 `.env.local` 파일을 생성하고 다음을 추가하세요:

```env
# Vercel KV 환경 변수 (Vercel 대시보드에서 복사)
KV_URL=your-kv-url
KV_REST_API_URL=your-kv-rest-api-url
KV_REST_API_TOKEN=your-kv-rest-api-token
KV_REST_API_READ_ONLY_TOKEN=your-kv-read-only-token
```

### 2. 편집 비밀번호 설정

#### Vercel 대시보드에서 설정

1. Vercel 프로젝트 대시보드 접속
2. **Settings** → **Environment Variables** 선택
3. 다음 환경 변수 추가:
   - **Key**: `EDIT_PASSWORD`
   - **Value**: 편집에 사용할 비밀번호 (예: `my-secure-password-123`)
   - **Environment**: Production, Preview, Development 모두 선택
4. **Save** 클릭

#### 로컬 개발 환경 설정

`.env.local` 파일에 추가:

```env
EDIT_PASSWORD=my-secure-password-123
```

### 3. 환경 변수 확인

설정이 완료되면 다음을 확인하세요:

- ✅ Vercel KV 데이터베이스가 생성되었는지
- ✅ `EDIT_PASSWORD` 환경 변수가 설정되었는지
- ✅ 모든 환경(Production, Preview, Development)에 적용되었는지

### 4. 테스트

설정 후 다음을 테스트하세요:

1. 대시보드에서 설명 편집 시도
2. 저장 버튼 클릭 시 비밀번호 모달이 나타나는지 확인
3. 올바른 비밀번호 입력 시 저장이 되는지 확인
4. 잘못된 비밀번호 입력 시 에러 메시지가 표시되는지 확인

### 주의사항

- `EDIT_PASSWORD`는 강력한 비밀번호를 사용하세요
- 환경 변수는 절대 Git에 커밋하지 마세요 (`.env.local`은 `.gitignore`에 포함되어 있음)
- Vercel에 배포한 후에는 Vercel 대시보드에서 환경 변수를 설정해야 합니다
