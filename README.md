# 비용 분석 웹 대시보드

FP&A 팀을 위한 비용 분석 대시보드입니다. Next.js 14 + TypeScript + Tailwind CSS + Recharts로 구현되었습니다.

## 🚀 빠른 시작

### 배포 가이드
- **빠른 참조**: [`QUICK_START.md`](./QUICK_START.md) - 최소한의 명령어만
- **상세 가이드**: [`DEPLOYMENT.md`](./DEPLOYMENT.md) - 단계별 상세 설명

### 로컬 개발

## 프로젝트 구조

```
.
├── src/
│   ├── app/
│   │   ├── page.tsx              # 홈 대시보드
│   │   ├── [division]/
│   │   │   └── page.tsx          # 사업부별 상세 페이지
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── BrandCard.tsx
│   │   │   ├── KpiCard.tsx
│   │   │   ├── MonthlyStackedChart.tsx
│   │   │   └── CategoryDrilldown.tsx
│   │   └── ui/                   # shadcn/ui 스타일 컴포넌트
│   └── lib/
│       ├── expenseData.ts        # 데이터 로딩 유틸리티
│       └── utils.ts              # 유틸리티 함수
├── scripts/
│   └── preprocess_expense.py     # CSV 전처리 스크립트
├── data/
│   └── aggregated-expense.json   # 전처리된 데이터 (자동 생성)
└── run_preprocess.bat            # 전처리 실행 배치 파일
```

## 1. 전처리 실행 방법

### 필요 패키지 설치

Python 3.8 이상이 필요합니다. 다음 명령어로 필요한 패키지를 설치하세요:

```bash
pip install -r requirements.txt
```

또는:

```bash
pip install pandas numpy
```

### CSV 파일 경로 확인

전처리 스크립트는 다음 경로에서 CSV 파일을 읽습니다:

```
C:\2.대시보드(파일)\비용엑셀\
├── 2024년비용.csv
├── 2025년비용.csv
├── 인원수.csv
└── 판매매출.csv
```

**CSV 경로 변경 시**: `scripts/preprocess_expense.py` 파일의 `CSV_BASE_PATH` 변수를 수정하세요.

```python
CSV_BASE_PATH = r"C:\2.대시보드(파일)\비용엑셀"
```

### 전처리 실행

Windows에서 `run_preprocess.bat` 파일을 더블클릭하거나, 명령 프롬프트에서 실행:

```bash
run_preprocess.bat
```

또는 Python 스크립트를 직접 실행:

```bash
python scripts/preprocess_expense.py
```

전처리가 완료되면 `data/aggregated-expense.json` 파일이 생성/업데이트됩니다.

## 2. 개발 서버 실행 방법

### 패키지 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 빌드

```bash
npm run build
npm start
```

## 3. 배포 (Vercel) 시 주의사항

### 배포 전 필수 작업

1. **전처리 실행**: 배포 전에 반드시 로컬에서 `run_preprocess.bat`를 실행하여 최신 `data/aggregated-expense.json` 파일을 생성해야 합니다.

2. **JSON 파일 커밋**: `data/aggregated-expense.json` 파일을 Git에 커밋하여 Vercel에 포함시켜야 합니다.

3. **CSV 파일 접근 불가**: Vercel 환경에서는 로컬 CSV 파일 경로(`C:\2.대시보드(파일)\비용엑셀`)에 접근할 수 없습니다. 따라서:
   - 런타임에서는 오직 `data/aggregated-expense.json`만 사용합니다.
   - CSV 파일이 업데이트되면 로컬에서 전처리를 실행하고, 업데이트된 JSON을 커밋해야 합니다.

### 배포 프로세스

1. CSV 파일 업데이트
2. 로컬에서 `run_preprocess.bat` 실행
3. `data/aggregated-expense.json` 확인
4. Git 커밋 및 푸시
5. Vercel 자동 배포

## 4. CSV 파일 업데이트 시 동작

비용 파일, 인원수, 판매매출 파일의 숫자가 변경되면:

1. `run_preprocess.bat`를 다시 실행
2. `data/aggregated-expense.json`이 자동으로 갱신됨
3. 웹 대시보드의 수치가 자동으로 변경됨 (개발 서버 재시작 필요할 수 있음)

## 주요 기능

### 홈 대시보드

- 4개 브랜드 카드 (MLB, KIDS, DISCOVERY, 공통)
- 연도/월 선택
- 당월/누적(YTD) 모드 전환
- 각 브랜드별 주요 KPI 표시
- 대분류별 비용 요약

### 상세 대시보드

- KPI 카드 (총비용, 인당비용, 매출대비 비용률, 매출 등)
- 월별 비용 추이 차트 (스택 막대 + YOY 라인)
- 대분류 → 중분류/소분류 드릴다운 차트

## 데이터 형식

### 공통 스키마

전처리된 데이터는 다음 스키마를 따릅니다:

- `year`: 연도 (예: 2024, 2025)
- `month`: 월 (1~12)
- `yyyymm`: 연월 문자열 (예: "202401", "202510")
- `biz_unit`: 사업부 (MLB, KIDS, DISCOVERY, 공통)
- `cost_lv1`: 비용 대분류
- `cost_lv2`: 비용 중분류
- `cost_lv3`: 비용 소분류
- `amount`: 비용 금액
- `sales`: 매출 금액
- `headcount`: 인원수

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router), React 18, TypeScript
- **스타일링**: Tailwind CSS, shadcn/ui
- **차트**: Recharts
- **데이터 처리**: Python (pandas)
- **배포**: Vercel (권장)

## 문제 해결

### 전처리 오류

- CSV 파일 경로가 올바른지 확인
- CSV 파일 인코딩이 UTF-8 (BOM)인지 확인
- Python 및 pandas가 올바르게 설치되었는지 확인

### 데이터가 표시되지 않음

- `data/aggregated-expense.json` 파일이 존재하는지 확인
- JSON 파일 형식이 올바른지 확인
- 개발 서버를 재시작해보세요

### 빌드 오류

- TypeScript 타입 오류 확인
- `npm install` 재실행
- `node_modules` 삭제 후 재설치

## 라이선스

내부 사용 전용

