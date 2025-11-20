# GitHub + Vercel 배포 가이드

이 문서는 비용 분석 대시보드를 GitHub와 Vercel에 배포하는 단계별 가이드를 제공합니다.

---

## 📋 목차

1. [Git 초기화 & GitHub 첫 푸시](#1-git-초기화--github-첫-푸시)
2. [Vercel 배포 설정](#2-vercel-배포-설정)
3. [실무용 배포 체크리스트](#3-실무용-배포-체크리스트)

---

## 1. Git 초기화 & GitHub 첫 푸시

### 1-1. GitHub 리포지토리 생성

1. GitHub에 로그인
2. 우측 상단 `+` 버튼 → `New repository` 클릭
3. Repository name 입력 (예: `expense-dashboard`)
4. Public 또는 Private 선택
5. **"Initialize this repository with a README" 체크 해제** (이미 로컬에 파일이 있으므로)
6. `Create repository` 클릭
7. 생성된 리포지토리 URL 복사 (예: `https://github.com/내계정/expense-dashboard.git`)

### 1-2. 로컬 Git 초기화 및 푸시

**⚠️ 중요: 푸시 전에 반드시 전처리를 실행하세요!**

```bash
# 1. 전처리 실행 (data/aggregated-expense.json 생성)
# Windows: run_preprocess.bat 더블클릭 또는
python scripts/preprocess_expense.py

# 2. Git 초기화
git init

# 3. 모든 파일 추가
git add .

# 4. 첫 커밋
git commit -m "초기 대시보드 세팅"

# 5. 기본 브랜치를 main으로 설정
git branch -M main

# 6. GitHub 리모트 추가 (아래 URL을 본인의 리포지토리 URL로 변경하세요!)
git remote add origin https://github.com/내계정/내리포.git

# 7. GitHub에 푸시
git push -u origin main
```

**📝 참고:**
- `내계정`과 `내리포`를 실제 GitHub 사용자명과 리포지토리명으로 변경하세요.
- 예시: `git remote add origin https://github.com/johndoe/expense-dashboard.git`

---

## 2. Vercel 배포 설정

### 2-1. Vercel 프로젝트 생성

1. **Vercel 로그인**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인 (권장)

2. **New Project 생성**
   - 대시보드에서 `Add New...` → `Project` 클릭
   - `Import Git Repository` 선택
   - 방금 만든 GitHub 리포지토리 선택
   - `Import` 클릭

3. **프로젝트 설정 확인**
   - **Framework Preset**: `Next.js` (자동 감지됨)
   - **Root Directory**: `./` (프로젝트 루트)
   - **Build Command**: `npm run build` (자동 설정됨)
   - **Output Directory**: `.next` (자동 설정됨)
   - **Install Command**: `npm install` (자동 설정됨)

4. **Environment Variables** (필요한 경우)
   - 이 프로젝트는 환경 변수가 필요 없습니다.
   - 필요시 여기서 추가 가능

5. **Deploy 클릭**
   - 빌드가 시작되고 약 1-2분 소요됩니다.
   - 완료되면 배포 URL이 생성됩니다 (예: `https://expense-dashboard.vercel.app`)

### 2-2. 자동 배포 설정

✅ **이미 설정 완료!**

- GitHub에 `git push`하면 자동으로 Vercel이 재배포합니다.
- `main` 브랜치에 푸시할 때마다 프로덕션 배포가 자동 실행됩니다.

### 2-3. 커스텀 도메인 설정 (선택사항)

1. Vercel 프로젝트 설정 → `Domains` 탭
2. 원하는 도메인 입력
3. DNS 설정 안내에 따라 도메인 제공업체에서 설정

---

## 3. 실무용 배포 체크리스트

### 📌 CSV 데이터 업데이트 후 배포 프로세스

CSV 파일이 업데이트되거나 새로운 데이터를 반영해야 할 때:

#### ✅ 체크리스트

```bash
# [1단계] CSV 파일 확인
# C:\2.대시보드(파일)\비용엑셀\ 경로에 최신 CSV 파일이 있는지 확인
# - 2024년비용.csv
# - 2025년비용.csv
# - 인원수.csv
# - 판매매출.csv

# [2단계] 전처리 실행 (JSON 생성)
# 방법 1: 배치 파일 실행
run_preprocess.bat

# 방법 2: Python 직접 실행
python scripts/preprocess_expense.py

# [3단계] 생성된 JSON 확인
# data/aggregated-expense.json 파일이 최신 데이터로 업데이트되었는지 확인

# [4단계] 로컬 테스트 (선택사항, 권장)
npm run dev
# http://localhost:3000 에서 데이터가 올바르게 표시되는지 확인

# [5단계] Git 커밋 및 푸시
git add data/aggregated-expense.json
git commit -m "데이터 업데이트: YYYY-MM-DD"
git push origin main

# [6단계] Vercel 자동 배포 확인
# Vercel 대시보드에서 자동 배포가 시작되는지 확인
# 배포 완료 후 프로덕션 사이트에서 데이터 확인
```

### 📌 주의사항

1. **전처리 필수**: 배포 전에 반드시 `run_preprocess.bat`를 실행하세요.
   - Vercel 환경에서는 로컬 CSV 파일에 접근할 수 없습니다.
   - `data/aggregated-expense.json` 파일이 최신 상태여야 합니다.

2. **JSON 파일 커밋**: `data/aggregated-expense.json`은 Git에 커밋해야 합니다.
   - `.gitignore`에서 이 파일은 제외하지 않았습니다.

3. **빌드 오류 대응**:
   - Vercel 빌드 로그에서 오류 확인
   - 로컬에서 `npm run build` 실행하여 사전 확인 권장

4. **환경 변수**: 현재 프로젝트는 환경 변수가 필요 없지만, 필요시 Vercel 프로젝트 설정에서 추가 가능합니다.

---

## 🔄 일반적인 Git 워크플로우

### 데이터 업데이트 시

```bash
# 1. 전처리 실행
run_preprocess.bat

# 2. 변경사항 확인
git status

# 3. 변경사항 추가
git add .

# 4. 커밋
git commit -m "데이터 업데이트: 2025-10"

# 5. 푸시 (자동 배포 트리거)
git push origin main
```

### 코드 변경 시

```bash
# 1. 변경사항 확인
git status

# 2. 변경사항 추가
git add .

# 3. 커밋
git commit -m "기능 추가: 새로운 차트 컴포넌트"

# 4. 푸시 (자동 배포 트리거)
git push origin main
```

---

## 🐛 문제 해결

### 빌드 실패

1. **로컬에서 빌드 테스트**
   ```bash
   npm run build
   ```

2. **Vercel 빌드 로그 확인**
   - Vercel 대시보드 → 프로젝트 → Deployments → 실패한 배포 클릭 → Build Logs

3. **일반적인 원인**
   - TypeScript 오류
   - 누락된 의존성
   - JSON 파일 형식 오류

### 데이터가 표시되지 않음

1. **JSON 파일 확인**
   - `data/aggregated-expense.json`이 최신인지 확인
   - JSON 형식이 올바른지 확인

2. **전처리 재실행**
   ```bash
   run_preprocess.bat
   git add data/aggregated-expense.json
   git commit -m "JSON 파일 재생성"
   git push origin main
   ```

### 자동 배포가 안 됨

1. **GitHub 연결 확인**
   - Vercel 프로젝트 설정 → Git → 연결된 리포지토리 확인

2. **브랜치 설정 확인**
   - Production Branch가 `main`으로 설정되어 있는지 확인

---

## 📚 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Git 기본 명령어](https://git-scm.com/docs)

---

## ✅ 배포 완료 확인

배포가 성공적으로 완료되면:

1. ✅ Vercel 대시보드에서 "Ready" 상태 확인
2. ✅ 배포된 URL 접속하여 대시보드 확인
3. ✅ 모든 브랜드 카드가 정상 표시되는지 확인
4. ✅ 상세 페이지 이동이 정상 작동하는지 확인
5. ✅ 차트가 정상 렌더링되는지 확인

**축하합니다! 🎉 대시보드가 성공적으로 배포되었습니다.**

