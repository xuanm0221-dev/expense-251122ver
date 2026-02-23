# F&F China Expense Dashboard

F&F China FP&A 팀을 위한 비용 분석 대시보드입니다.  
Next.js 14 + TypeScript + Tailwind CSS + Recharts로 구현되었으며, 한국어/중국어 다국어 지원을 포함합니다.

---

## 프로젝트 구조

```
expense/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 홈(법인 개요) 페이지
│   │   ├── [division]/page.tsx         # 법인·브랜드·공통 상세 페이지
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── expense-data/route.ts   # data/aggregated-expense.json 반환
│   │       ├── cost-descriptions/route.ts  # 설명·계산근거 CRUD (Redis/파일)
│   │       └── report-html/route.ts    # 보고서 HTML 저장
│   ├── components/
│   │   └── dashboard/
│   │       ├── ExpenseDataProvider.tsx # 앱 전체에 데이터 공급
│   │       ├── KpiCard.tsx
│   │       ├── MonthlyStackedChart.tsx
│   │       ├── CategoryDrilldown.tsx
│   │       ├── ExpenseAccountHierTable.tsx
│   │       ├── BizUnitSwitch.tsx
│   │       ├── LanguageToggle.tsx
│   │       └── ... (기타 카드 컴포넌트)
│   ├── contexts/
│   │   └── LanguageContext.tsx         # 한국어/중국어 전역 상태
│   └── lib/
│       ├── expenseData.ts              # 집계 데이터 접근 함수
│       ├── translations.ts             # ko/zh 번역 맵 및 t(), getDisplayLabel()
│       ├── dashboardDefaults.ts        # 기본 날짜 localStorage 저장
│       └── utils.ts
├── scripts/
│   └── preprocess_expense.py          # CSV → aggregated-expense.json 변환
├── data/
│   ├── aggregated-expense.json        # 전처리 결과 (git 포함, Vercel에서 직접 읽음)
│   ├── report-html.json               # 보고서 HTML 저장본
│   └── cost-descriptions/             # 설명·계산근거 로컬 저장 폴더
├── 파일/                               # CSV 원본 파일 폴더
│   ├── 2024년비용_actual.csv
│   ├── 2025년비용_actual.csv
│   ├── 2026년비용_plan.csv
│   └── ... (인원수, 판매매출 등)
├── run_preprocess.bat                 # CSV → JSON 변환 실행 스크립트 (Windows)
├── requirements.txt                   # Python 패키지 목록
├── DEPLOYMENT.md                      # 배포 및 운영 워크플로우
└── ENV_SETUP.md                       # 환경 변수 설정 가이드
```

---

## 주요 기능

- **홈 페이지**: 법인 전체 KPI + MLB·KIDS·DISCOVERY·공통 브랜드 카드
- **상세 페이지**: 법인·브랜드·공통별
  - KPI 카드 (총비용, 매출대비 비용률, 인건비 인당, 인당 복리후생비 등)
  - 월별 비용 추이 차트 (스택 막대 + YOY 라인)
  - 대분류 → 중분류/소분류 드릴다운 차트
  - 비용 계정 상세 분석 표 (당월/누적/연간 계획, 설명·계산근거 편집)
  - 광고비-매출 효율 분석
- **다국어**: 한국어 / 중国文 전환 (우측 상단 토글)
- **기준월 저장**: 마지막 선택 날짜를 브라우저에 저장

---

## 기술 스택

| 분류 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router), React 18 |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS, shadcn/ui |
| 차트 | Recharts |
| 데이터 전처리 | Python (pandas) - 로컬 전용 |
| 데이터 저장 | Redis (Upstash) / 로컬 파일 |
| 배포 | Vercel |

---

## 데이터 업데이트 워크플로우

CSV 파일(`파일/` 폴더)이 변경될 때마다 아래 순서로 진행합니다.

```bash
# 1. CSV → JSON 변환 (로컬에서 실행)
run_preprocess.bat
# 또는: python scripts/preprocess_expense.py

# 2. 생성된 JSON 확인
# data/aggregated-expense.json

# 3. (선택) 로컬 개발 서버로 확인
npm run dev

# 4. 커밋 & 푸시 → Vercel 자동 재배포
git add data/aggregated-expense.json
git commit -m "데이터 업데이트: YYYY-MM"
git push origin main
```

> **중요**: Vercel 서버리스 환경에서는 Python 실행이 불가합니다.  
> 반드시 로컬에서 전처리 후 `aggregated-expense.json`을 git에 포함시켜야 합니다.

---

## 로컬 개발

### 패키지 설치

```bash
npm install
```

### 환경 변수 설정

`.env.local` 파일 생성:

```env
EDIT_PASSWORD=비밀번호
```

자세한 내용은 [ENV_SETUP.md](./ENV_SETUP.md) 참고.

### 개발 서버 실행

```bash
npm run dev
# http://localhost:3000
```

### 빌드 테스트

```bash
npm run build
```

---

## 코드 변경 후 배포

```bash
# 빌드 확인
npm run build

# 커밋 & 푸시
git add .
git commit -m "변경 내용 요약"
git push origin main
```

GitHub `main` 브랜치에 푸시하면 Vercel이 자동으로 재배포합니다.

---

## Python 전처리 환경

```bash
pip install -r requirements.txt
# pandas >= 2.0.0, numpy >= 1.24.0
```

CSV 파일 경로는 `파일/` 폴더 기준으로 자동 참조됩니다.  
경로 변경 시 `scripts/preprocess_expense.py`의 `CSV_BASE_PATH` 수정.

---

내부 사용 전용
