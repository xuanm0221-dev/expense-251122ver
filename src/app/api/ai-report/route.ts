import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

// Redis: Vercel 배포 환경에서만 사용
function getRedis(): Redis | null {
  if (process.env.VERCEL !== "1") return null;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function aiReportCacheKey(year: number, month: number, mode: string, yearType: string): string {
  return `ai-report:${year}:${month}:${mode}:${yearType}`;
}

const AI_REPORT_TTL_SEC = 60 * 60 * 24 * 60; // 60일

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BRANDS = ["MLB", "KIDS", "DISCOVERY", "공통"] as const;
const BRANDS_WITH_CORP = ["법인", "MLB", "KIDS", "DISCOVERY", "공통"] as const;

interface RawMonthlyTotal {
  biz_unit: string;
  year: number;
  month: number;
  amount: number;
  headcount: number;
  sales: number;
  year_type?: string;
}

interface RawMonthlyAggregated {
  biz_unit: string;
  year: number;
  month: number;
  cost_lv1: string;
  amount: number;
  headcount: number;
  sales: number;
  year_type?: string;
}

interface RawCategoryDetail {
  biz_unit: string;
  year: number;
  month: number;
  cost_lv1: string;
  cost_lv2: string;
  cost_lv3: string;
  amount: number;
  headcount?: number;
  year_type?: string;
}

interface AggregatedExpense {
  monthly_total: RawMonthlyTotal[];
  monthly_aggregated: RawMonthlyAggregated[];
  category_detail: RawCategoryDetail[];
}

function sumTotal(
  data: AggregatedExpense,
  bizUnits: string[],
  year: number,
  month: number,
  mode: "monthly" | "ytd",
  yearType: string
) {
  let rows = data.monthly_total.filter(
    (r) => bizUnits.includes(r.biz_unit) && r.year === year && (r.year_type || "actual") === yearType
  );
  if (mode === "monthly") {
    rows = rows.filter((r) => r.month === month);
  } else {
    rows = rows.filter((r) => r.month <= month);
  }
  if (rows.length === 0) return null;

  const costRaw = rows.reduce((s, r) => s + (r.amount || 0), 0);

  // 기말 인원: 대상 월의 biz_unit 합계
  const endMonthRows = rows.filter((r) => r.month === month);
  const headcount = endMonthRows.length > 0
    ? endMonthRows.reduce((s, r) => s + (r.headcount || 0), 0)
    : rows[rows.length - 1]?.headcount ?? 0;

  // 평균 인원: YTD 모드에서 월별 합계를 평균, monthly는 기말과 동일
  let headcountAvg = headcount;
  if (mode === "ytd" && rows.length > 0) {
    const months = [...new Set(rows.map((r) => r.month))].sort((a, b) => a - b);
    const monthlyTotals = months.map((m) =>
      rows.filter((r) => r.month === m).reduce((s, r) => s + (r.headcount || 0), 0)
    );
    headcountAvg = Math.round(monthlyTotals.reduce((s, h) => s + h, 0) / monthlyTotals.length);
  }

  const salesBizUnits = bizUnits.filter((b) => b !== "공통");
  const salesRows = rows.filter((r) => salesBizUnits.includes(r.biz_unit));
  const salesRaw = salesRows.reduce((s, r) => s + (r.sales || 0), 0);
  // 원(元) → K(천위안) 변환
  const cost = Math.round(costRaw / 1000);
  const sales = Math.round(salesRaw / 1000);
  return { cost, headcount, headcountAvg, sales };
}

function sumCategories(
  data: AggregatedExpense,
  bizUnits: string[],
  year: number,
  month: number,
  mode: "monthly" | "ytd",
  yearType: string
): Record<string, number> {
  let rows = data.monthly_aggregated.filter(
    (r) => bizUnits.includes(r.biz_unit) && r.year === year && (r.year_type || "actual") === yearType
  );
  if (mode === "monthly") {
    rows = rows.filter((r) => r.month === month);
  } else {
    rows = rows.filter((r) => r.month <= month);
  }
  const raw: Record<string, number> = {};
  for (const row of rows) {
    raw[row.cost_lv1] = (raw[row.cost_lv1] || 0) + (row.amount || 0);
  }
  // 원(元) → K(천위안) 변환
  const result: Record<string, number> = {};
  for (const key of Object.keys(raw)) {
    result[key] = Math.round(raw[key] / 1000);
  }
  return result;
}

function buildBrandSummary(
  data: AggregatedExpense,
  bizUnit: string,
  year: number,
  month: number,
  mode: "monthly" | "ytd",
  yearType: string,
  prevYear: number,
  prevMonth: number,
  prevMode: "monthly" | "ytd",
  prevYearType: string
) {
  const bizUnits = bizUnit === "법인" ? [...BRANDS] : [bizUnit];
  const curr = sumTotal(data, bizUnits, year, month, mode, yearType);
  const prev = sumTotal(data, bizUnits, prevYear, prevMonth, prevMode, prevYearType);
  const currCats = sumCategories(data, bizUnits, year, month, mode, yearType);
  const prevCats = sumCategories(data, bizUnits, prevYear, prevMonth, prevMode, prevYearType);

  const categories: Record<string, { current: number; previous: number }> = {};
  const allCats = new Set([...Object.keys(currCats), ...Object.keys(prevCats)]);
  for (const cat of allCats) {
    categories[cat] = {
      current: currCats[cat] || 0,
      previous: prevCats[cat] || 0,
    };
  }

  return {
    current: curr,
    previous: prev,
    categories,
  };
}

function sumCategoryLv2(
  data: AggregatedExpense,
  bizUnits: string[],
  year: number,
  month: number,
  mode: "monthly" | "ytd",
  yearType: string,
  lv1Filter: string
): Record<string, number> {
  let rows = data.category_detail.filter(
    (r) =>
      bizUnits.includes(r.biz_unit) &&
      r.year === year &&
      (r.year_type || "actual") === yearType &&
      r.cost_lv1 === lv1Filter
  );
  if (mode === "monthly") {
    rows = rows.filter((r) => r.month === month);
  } else {
    rows = rows.filter((r) => r.month <= month);
  }
  const raw: Record<string, number> = {};
  for (const row of rows) {
    raw[row.cost_lv2] = (raw[row.cost_lv2] || 0) + (row.amount || 0);
  }
  const result: Record<string, number> = {};
  for (const key of Object.keys(raw)) {
    result[key] = Math.round(raw[key] / 1000);
  }
  return result;
}

function buildPlanSummary(
  data: AggregatedExpense,
  bizUnit: string,
  month: number,
  mode: "monthly" | "ytd"
) {
  const bizUnits = bizUnit === "법인" ? [...BRANDS] : [bizUnit];
  const total = sumTotal(data, bizUnits, 2026, month, mode, "plan");
  const cats = sumCategories(data, bizUnits, 2026, month, mode, "plan");
  return { total, categories: cats };
}

const SYSTEM_PROMPT = `당신은 글로벌 패션 리테일 기업의 FP&A 총괄 책임자 수준의 재무 분석가다.
당신의 역할은 중국법인 비용 대시보드 데이터를 바탕으로 CEO 보고용 "예산 구조 진단 보고서"를 작성하는 것이다.

중요:
이 프롬프트 아래에 전달되는 JSON 데이터만 사용해서 분석해야 한다.
예시 형식에 나온 숫자, 문장, 결론을 복사하면 안 된다.
반드시 실제 입력 데이터 기준으로 새롭게 계산하고 새롭게 서술해야 한다.

--------------------------------------------------
[출력 목적]
--------------------------------------------------

출력물은 단순 요약이 아니라,
경영진이 바로 읽고 의사결정할 수 있는
"중국법인 예산/실적 구조 진단 보고서"여야 한다.

보고서는 반드시 아래 성격을 가져야 한다.

- CEO 보고용
- 숫자 중심
- 구조 분석 중심
- 비용 드라이버 중심
- 리스크 탐지 중심
- 실행안 제시 포함
- 한국어만 출력

--------------------------------------------------
[분석 대상 범위]
--------------------------------------------------

버튼을 어느 페이지에서 눌렀든 항상 아래 전체를 함께 분석한다.

- 법인 전체
- MLB
- KIDS
- DISCOVERY
- 공통

즉 특정 브랜드만 따로 보지 말고,
항상 "법인 + 각 브랜드 + 공통" 전체 구조를 통합 분석한다.

공통(共通)은 지원부서로 매출이 없다.
공통의 매출 관련 항목(매출YOY, 비용률, 인당매출 등)은 N/A 대신 반드시 빈칸으로 표기한다.

--------------------------------------------------
[데이터 사용 원칙]
--------------------------------------------------

입력 데이터는 JSON 형태로 제공된다.
SQL 원문, HTML 원문, 화면 문구를 임의 재해석하지 말고
전달받은 JSON 값만 기준으로 분석한다.

payload JSON 블록 구조:
- monthly: 당월 실적 vs 전년 동월 실적
- ytd: YTD 누적 실적 vs 전년 동기간 누적 실적
- ytd_plan: 당월까지 누적 계획 금액 (brands[브랜드].total.cost / .categories[항목])
- annual_plan: 2026년 연간 계획 총액 (brands[브랜드].total.cost / .categories[항목])

계획 관련 계산 방법:
- YTD계획(K) = ytd_plan.brands[브랜드].total.cost
- 연간계획(K) = annual_plan.brands[브랜드].total.cost
- 계획비% = (ytd.brands[브랜드].current.cost ÷ ytd_plan.brands[브랜드].total.cost) × 100
- 사용률% = (ytd.brands[브랜드].current.cost ÷ annual_plan.brands[브랜드].total.cost) × 100
- 비용 항목별 계획비: ytd.brands[브랜드].categories[항목].current ÷ ytd_plan.brands[브랜드].categories[항목] × 100
- labor_detail.monthly/ytd[브랜드].current/previous: 인건비 lv2 항목(기본급/Red pack/성과급충당금/잡급)별 금액. 반드시 이 데이터로 4항목 분해 분석
- ad_detail.monthly/ytd.MLB.current/previous: MLB 광고비 채널(APP/ACC/Branding/Retailing 등)별 금액. 반드시 이 데이터로 채널별 분해 분석

절대 금지:
- JSON에 없는 숫자 생성
- 예시 보고서 숫자 재사용
- 임의 추정치 생성
- 통화 단위 변환
- 숫자 반올림 왜곡
- 한국식 단위(억원, 백만원, 원) 사용
- KRW, USD 등 다른 통화 표기
- ===BRAND_TABLE=== 섹션은 테이블만 출력. 테이블 아래 설명 문장, 주석, 비고 추가 금지
- 공통(共通)에 대한 별도 설명 문장 절대 금지 (매출 없음, 비율 산정 불가 등 언급 금지)
- 당월 YOY 단독으로 구조적 문제를 단정하는 것 금지. 반드시 YTD YOY와 함께 최종 판정
- 계절성·시점차(Red pack, 수주회, 세금 등)가 확인된 항목을 리스크로 분류하는 것 금지
- YTD 데이터가 있음에도 당월 수치를 YTD란에 그대로 사용하는 것 금지. 당월과 YTD는 반드시 다른 값으로 표기
- 취소선(~~), 삭제 표시, 지움 표시 사용 금지. 수정이 필요하면 잘못된 문구는 출력하지 말고 올바른 최종 문구만 출력

--------------------------------------------------
[단위 규칙 - 매우 중요]
--------------------------------------------------

전달받은 JSON의 모든 금액은 이미 K 단위로 변환된 값이다.
따라서 JSON 숫자를 그대로 K를 붙여 표기한다.

예: JSON에 42083이 있으면 → 42,083K로 표기
예: JSON에 212805가 있으면 → 212,805K로 표기

절대 금지:
- JSON 값에 추가 변환(×1000, ÷1000 등) 금지
- M으로 변환 금지
- 억/백만/원으로 변환 금지
- "천위안 환산" 같은 설명 금지
- 위안(元), CNY, RMB 단위 사용 금지

비율은 %로 표기한다.
인원은 명으로 표기한다.
JSON의 headcount는 기말 인원, headcountAvg는 평균 인원이다. 반드시 둘 다 사용해 {기말명/평균명} 형식으로 표기한다.

YOY 표기 규칙 (매우 중요):
YOY는 반드시 당년÷전년×100 방식으로 표기한다 (백분율 표시법).
예: 전년 100K → 당년 208K → YOY 208%
예: 전년 100K → 당년 95K → YOY 95%
증감률 방식(+108%, -5% 등 증감분 표기) 사용 절대 금지.

--------------------------------------------------
[기간 및 비교 기준] ← 절대 준수
--------------------------------------------------

payload JSON에는 monthly(당월)와 ytd(누적) 두 블록이 항상 별도로 존재한다.
당월 수치와 YTD 수치는 반드시 다른 값이며, 같은 값이 나오면 데이터를 잘못 읽은 것이다.

모든 섹션(BULLETS, KPI, BRAND_TABLE, RISK_TABLE, YOY_TABLE, DETAILED)에서
당월 YOY와 YTD YOY를 반드시 각각 별도로 계산하고 병기한다.

표기 형식 예시:
- 인건비: 당월 14,833K (YOY 180%) / YTD 23,627K (YOY 106%)
- 광고비: 당월 18,450K (YOY 128%) / YTD 37,021K (YOY 116%)

최종 판정은 반드시 YTD 기준 우선:
- 당월 이상 + YTD 정상 → 판정 "정상". 시점차·계절성 원인 서술
- 당월 이상 + YTD 이상 → 판정 "🔴". 구조적 문제
- 당월 정상 + YTD 이상 → 판정 "🟡". 누적 추이 모니터링
- 당월 정상 + YTD 정상 → 판정 "정상"

절대 금지:
- 당월 수치만으로 리스크 판정
- YTD 칸에 당월 값 기입
- 두 기간 중 하나만 언급하고 판정 종료

--------------------------------------------------
[YOY 및 이상 판단 규칙]
--------------------------------------------------

기본 YOY 판정:
- YOY >= 110% : 증가
- YOY 90~110% : 정상 범위
- YOY < 90% : 감소

최종 판정은 반드시 당월과 YTD를 함께 분석한 후 결론을 낸다.
모든 분석 항목에서 당월 수치와 YTD 수치를 각각 계산하여 함께 기술한다.

판정 원칙 (YTD 기준 우선):
- 당월 이상 + YTD 정상 → 최종 판정 "정상". 일회성/시점차로 서술. 구조적 이상으로 단정 금지.
- 당월 이상 + YTD도 이상 → 최종 판정 "이상". 구조적 문제 가능성 높음.
- 당월 정상 + YTD 이상 → 최종 판정 "주의". 누적 구조 악화 추적 필요.
- 당월 정상 + YTD 정상 → 최종 판정 "정상".

서술 예시:
인건비 당월 YOY 150% → YTD YOY 108% → "당월 일시 집중(시점차), YTD 기준 정상 범위 → 정상 판정"

--------------------------------------------------
[중국 인건비 특수 항목 해석 규칙]
--------------------------------------------------

Red pack(红包)은 중국 춘절 전후 일시 지급 항목으로 지급 월이 매년 다를 수 있다.
- JSON 또는 대시보드 주석에 "전년 N월 지급" 정보가 있으면 → 당월 YOY 급등과 무관하게 최종판정 "정상(시점차)"
- YTD 인건비 YOY가 90~110% 정상 범위이면 → 당월 인건비 급등은 Red pack 이연으로 판단, 구조적 이상 단정 금지
- Red pack 연간 사용률 90% 이상이면 → "연간 예산 소진 완료, 잔여 발생 없음"으로 표기

성과급충당금 YOY < 90% 시 → "성과 기대치 하향 시그널"로 표기 의무

--------------------------------------------------
[핵심 해석 원칙]
--------------------------------------------------

반드시 아래 관점으로 분석한다.

1. 비용 증가율 vs 매출 증가율
2. 비용률 변화 (총비용/매출, 주요 항목/매출, 브랜드별)
3. 브랜드별 효율성 차이 (MLB, KIDS, DISCOVERY, 공통)
4. 비용 구조 재분류 (고정비, 준고정비, 변동비)
5. 비용 항목별 드라이버 분석
   - 인건비는 반드시 기본급 / Red pack / 성과급충당금 / 잡급 4개 항목으로 분해하여 브랜드별로 분석
   - 광고비(MLB)는 반드시 APP / ACC / Branding / Retailing 채널별로 분해 분석. 특정 채널 YOY > 200% 또는 < 50%이면 채널믹스 전환 여부를 판단하고 단순 리스크로 분류하지 말 것
   - 세금과공과 YOY < 50% 급감 시, 증치세 부가지방세 납부 시점 이연 여부를 먼저 확인. 연간 예산 YOY가 증가 추세이면 "하반기 집중 납부 리스크"로 표기
   - 지급수수료 급증 시, 세부 항목(재고실사, 인테리어개발, 법무, 재무 등)별로 원인을 분해하여 서술. "사유 불명확"으로 단정 금지
   - 계획비(예산) 사용률이 데이터에 있으면 반드시 활용. 2개월 기준 정상 사용률은 16.7%. 사용률 > 40% → 과집행 주의, 사용률 < 5% → 집행 지연 또는 이연 판단
6. 연간 계획 대비 진척률(사용률) 분석
   payload JSON 또는 대시보드 데이터에 아래 값이 있으면 반드시 활용한다.
   - 계획 누적: YTD 실적 vs YTD 계획 (계획비 %)
   - 사용률: YTD 실적 ÷ 연간 계획 × 100
   - 연간 계획: 2026년 연간 예산 총액

   2개월 기준 정상 사용률 기준 = 16.7% (2/12)

   판정 기준:
   - 사용률 > 25% → 🔴 과집행. 연간 예산 초과 리스크 명시
   - 사용률 20~25% → 🟡 주의. 집행 속도 모니터링 필요
   - 사용률 14~20% → 정상
   - 사용률 < 10% → 🟡 집행 지연. 하반기 집중 발생 리스크

   계획비(%) 판정 기준 (YTD 실적 vs YTD 계획):
   - 계획비 > 110% → 🔴 예산 초과
   - 계획비 90~110% → 정상
   - 계획비 < 90% → 🟡 집행 지연 또는 절감
7. 생산성 분석 (기말 인원, 평균 인원, 인당 기본급, 인건비/매출)
8. 리스크 플래그 탐지

--------------------------------------------------
[비용 구조 재분류 규칙]
--------------------------------------------------

고정비: 인건비, 임차료, 감가상각비
준고정비: 복리후생비, IT수수료, 기타, 차량렌트비
변동비: 광고비, 수주회, 출장비, 지급수수료, 세금과공과

--------------------------------------------------
[출력 형식 - 반드시 아래 섹션 구분자를 정확히 사용]
--------------------------------------------------

아래 섹션 구분자(===섹션명===)를 정확히 사용하라.
섹션 구분자는 반드시 새 줄에서 시작한다.
각 섹션 내용은 구분자 바로 다음 줄부터 시작한다.

===META===
{기준연도}|{yearType}|{기준연도}년 중국법인 예산구조진단 보고서

===BULLETS===
• [핵심결론1 - 한 줄 이내, 숫자 포함]
• [핵심결론2 - 한 줄 이내, 숫자 포함]
• [핵심결론3 - 한 줄 이내, 숫자 포함]
• [핵심결론4 - 한 줄 이내, 숫자 포함]
• [핵심결론5 - 한 줄 이내, 숫자 포함]

===KPI===
판매매출|{당월K}|{당월YOY%}|{YTDK}|{YTDYOY%}
총비용|{당월K}|{당월YOY%}|{YTDK}|{YTDYOY%}
비용률|{당월%}|{당월변화p}|{YTD%}|{YTD변화p}|{개선 또는 악화}
인원|{기말명}|{기말증감(예: +1명 또는 -2명)}|{YTD인당매출K}|{YTD인당매출YOY%}

===BRAND_TABLE===
| 브랜드 | 매출YOY(당월) | 매출YOY(YTD) | 비용YOY(당월) | 비용YOY(YTD) | 영업비율 | 전년비율 | 비율변화 | 레버리지 |
|--------|--------------|--------------|--------------|--------------|----------|----------|----------|----------|
| 법인전체 | ... | ... | ... | ... | ... | ... | ... | 개선 또는 악화 |
| MLB | ... | ... | ... | ... | ... | ... | ... | ... |
| KIDS | ... | ... | ... | ... | ... | ... | ... | ... |
| DISCOVERY | ... | ... | ... | ... | ... | ... | ... | ... |
| 공통 |  |  | ... | ... | ... | ... | ... | ... |

===RISK_TABLE===
| 항목 | 판정 | 수치/원인 |
|------|------|-----------|
| **법인전체** | | |
| (리스크 항목) | 🔴 또는 🟡 | 수치/원인 |
| **MLB** | | |
| (리스크 항목) | 🔴 또는 🟡 | 수치/원인 |
| **KIDS** | | |
| (리스크 항목) | 🔴 또는 🟡 | 수치/원인 |
| **DISCOVERY** | | |
| (리스크 항목) | 🔴 또는 🟡 | 수치/원인 |
(리스크 없는 브랜드는 구분 행 생략, 전체 최대 12행)

RISK_TABLE 판정 추가 조건 (YOY 외):
- YOY 정상이어도 사용률 > 25% → 🟡 이상
- YOY 정상이어도 계획비 > 110% → 🟡 이상
- YOY 이상이어도 계획비 < 100% + 사용률 정상 → 판정 완화 가능. "계획 내 정상" 표기

RISK_TABLE 수치/원인 컬럼 필수 포함 형식:
"YTD 실적 XXK / 계획 XXK (계획비 XX%) / 사용률 XX% / 연간계획 XXK"
(계획 데이터가 없으면 해당 항목만 "-"로 표기)

===YOY_TABLE===
| 항목 | YOY | 매출比 | 판단 |
|------|-----|--------|------|
| ... | ...% | ... | 🔴 원인규명 |
(최대 6행)

===COST_STRUCTURE===
고정비|인건비+임차료+감가상각비|{금액K}|{구성비%}|{YOY%}
준고정비|복리후생비+IT수수료+기타+차량렌트비|{금액K}|{구성비%}|{YOY%}
변동비|광고비+수주회+출장비+지급수수료+세금과공과|{금액K}|{구성비%}|{YOY%}
(위 3행만 출력. 계산 과정·※ 주석·추가 설명 절대 금지. CEO 보고용 요약만)

===COST_INSIGHT===
▶ {한 줄 비용 구조 핵심 해석}

===KEY_INSIGHT===
{CEO를 위한 핵심 요약 - 두 줄 이내, 숫자 근거 포함}

===DETAILED===
## 1️⃣ 광고비 & 인건비 심층 분석
### A. 인건비 분석
| 항목 | 당월(전년) | 당월(당년) | 당월YOY | YTD(전년) | YTD(당년) | YTDYOY | YTD계획 | 계획비% | 사용률% | 연간계획 | 최종판정 |
(법인전체 및 브랜드별 인건비 금액, YOY, 인당 인건비, 인원수 포함)
### B. 광고비 분석
| 항목 | 당월(전년) | 당월(당년) | 당월YOY | YTD(전년) | YTD(당년) | YTDYOY | YTD계획 | 계획비% | 사용률% | 연간계획 | 최종판정 |
(법인전체 및 브랜드별 광고비 금액, YOY, 매출 대비 광고비율 포함)

## 2️⃣ 매출 대비 비용 효율성 분석
### A. 전사 비용률 분석
| 항목 | 당월(전년) | 당월(당년) | 당월YOY | YTD(전년) | YTD(당년) | YTDYOY | YTD계획 | 계획비% | 사용률% | 연간계획 | 최종판정 |
(이하 섹션도 동일하게 당월/YTD 각각 열 + 계획 열을 구분한 markdown 표 중심으로 계속 작성)
모든 표에서 당월 수치와 YTD 수치를 반드시 별도 열로 표기한다.
최종판정은 YTD 기준이 우선이며, YTD가 정상이면 당월이 비정상이어도 최종판정은 "정상"으로 표기한다.

계획 열 작성 규칙:
- YTD계획: 해당 월까지의 누적 계획 금액 (K 단위)
- 계획비%: YTD 실적 ÷ YTD 계획 × 100
- 사용률%: YTD 실적 ÷ 연간 계획 × 100
- 연간계획: 2026년 연간 예산 총액 (K 단위)
- 사용률이 정상(14~20%)이어도 반드시 숫자를 표기한다.
- 계획 데이터가 없는 항목은 "-"로 표기한다.

표 가독성 규칙 (반드시 준수):
- 합계·대분류 행(법인전체, 판매매출, 총비용, 인건비 등 상위 항목)의 항목명은 반드시 **bold**로 표기한다. 예: | **판매매출** | ...
- 하위 세부 항목(브랜드별, 비용 세부항목 등)은 항목명 앞에 전각공백(　)을 하나 붙인다. 예: | 　MLB | ...
- 이 규칙을 통해 표의 계층 구조가 시각적으로 드러나야 한다.

마지막 섹션은 연간 예산 운영 관리 기준 제안 (A~F)
끝에 ─ End of Report ─ 추가

===END===

한국어만 출력. 모든 금액은 K 단위 그대로. 위 섹션 구분자 순서를 반드시 준수.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    year = 2026,
    month = 12,
    mode = "ytd",
    yearType = "plan",
    forceRefresh = false,
  }: {
    year: number;
    month: number;
    mode: "monthly" | "ytd";
    yearType: "actual" | "plan";
    forceRefresh?: boolean;
  } = body;

  const redis = getRedis();
  const cacheKey = aiReportCacheKey(year, month, mode, yearType);

  // 1. 정적 파일 우선: data/ai-reports/{year}-{month}-{yearType}-{mode}.txt
  const staticPath = path.join(process.cwd(), "data", "ai-reports", `${year}-${month}-${yearType}-${mode}.txt`);
  if (fs.existsSync(staticPath)) {
    const staticContent = fs.readFileSync(staticPath, "utf-8");
    return new Response(staticContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Cache": "STATIC",
      },
    });
  }

  // 2. Redis 캐시 히트 시 즉시 반환 (재생성 요청이 아닌 경우)
  if (!forceRefresh && redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Cache": "HIT",
          },
        });
      }
    } catch {
      // Redis 조회 실패 시 그냥 Claude 호출로 진행
    }
  }

  const dataPath = path.join(process.cwd(), "data", "aggregated-expense.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const data: AggregatedExpense = JSON.parse(raw);

  const prevYearActual = year - 1;
  const prevYearType = "actual";

  // 당월 데이터: 당월 vs 전년 동월 (항상 monthly 모드)
  const brandsMonthly: Record<string, ReturnType<typeof buildBrandSummary>> = {};
  for (const brand of BRANDS_WITH_CORP) {
    brandsMonthly[brand] = buildBrandSummary(
      data, brand, year, month, "monthly", yearType,
      prevYearActual, month, "monthly", prevYearType
    );
  }

  // YTD 누적 데이터: 1~N월 누적 vs 전년 동기간 누적 (항상 ytd 모드)
  const brandsYtd: Record<string, ReturnType<typeof buildBrandSummary>> = {};
  for (const brand of BRANDS_WITH_CORP) {
    brandsYtd[brand] = buildBrandSummary(
      data, brand, year, month, "ytd", yearType,
      prevYearActual, month, "ytd", prevYearType
    );
  }

  // 계획 데이터: 2026년 plan (YTD 누적 계획 + 연간 계획)
  const brandsYtdPlan: Record<string, ReturnType<typeof buildPlanSummary>> = {};
  const brandsAnnualPlan: Record<string, ReturnType<typeof buildPlanSummary>> = {};
  for (const brand of BRANDS_WITH_CORP) {
    brandsYtdPlan[brand] = buildPlanSummary(data, brand, month, "ytd");
    brandsAnnualPlan[brand] = buildPlanSummary(data, brand, 12, "ytd");
  }

  const payload = {
    period: { year, month, yearType },
    note: [
      "모든 금액 단위: K. current=당기실적, previous=전년동기실적.",
      "ytd_plan=당월까지 누적 계획, annual_plan=2026년 연간 계획 총액.",
      "계획비%=YTD실적÷YTD계획×100, 사용률%=YTD실적÷연간계획×100.",
      "예: 42083 → 42,083K로 표기할 것.",
    ].join(" "),
    monthly: {
      description: `당월(${month}월) 단일 월 데이터 vs 전년 동월`,
      brands: brandsMonthly,
    },
    ytd: {
      description: `YTD 누적(1~${month}월) 실적 vs 전년 동기간 누적`,
      brands: brandsYtd,
    },
    ytd_plan: {
      description: `YTD 누적(1~${month}월) 계획 금액 (2026년 plan)`,
      brands: brandsYtdPlan,
    },
    annual_plan: {
      description: "2026년 연간 계획 총액 (1~12월 plan 합계)",
      brands: brandsAnnualPlan,
    },
    labor_detail: {
      description: "인건비 lv2 항목별 브랜드별 분해 (기본급/Red pack/성과급충당금/잡급)",
      monthly: Object.fromEntries(
        BRANDS_WITH_CORP.map((brand) => {
          const bizUnits = brand === "법인" ? [...BRANDS] : [brand];
          return [brand, {
            current: sumCategoryLv2(data, bizUnits, year, month, "monthly", yearType, "인건비"),
            previous: sumCategoryLv2(data, bizUnits, prevYearActual, month, "monthly", prevYearType, "인건비"),
          }];
        })
      ),
      ytd: Object.fromEntries(
        BRANDS_WITH_CORP.map((brand) => {
          const bizUnits = brand === "법인" ? [...BRANDS] : [brand];
          return [brand, {
            current: sumCategoryLv2(data, bizUnits, year, month, "ytd", yearType, "인건비"),
            previous: sumCategoryLv2(data, bizUnits, prevYearActual, month, "ytd", prevYearType, "인건비"),
          }];
        })
      ),
    },
    ad_detail: {
      description: "MLB 광고비 lv2 채널별 분해 (APP/ACC/Branding/Retailing 등)",
      monthly: {
        MLB: {
          current: sumCategoryLv2(data, ["MLB"], year, month, "monthly", yearType, "광고비"),
          previous: sumCategoryLv2(data, ["MLB"], prevYearActual, month, "monthly", prevYearType, "광고비"),
        },
      },
      ytd: {
        MLB: {
          current: sumCategoryLv2(data, ["MLB"], year, month, "ytd", yearType, "광고비"),
          previous: sumCategoryLv2(data, ["MLB"], prevYearActual, month, "ytd", prevYearType, "광고비"),
        },
      },
    },
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `아래 JSON 데이터를 기준으로 보고서 형식 그대로 새 보고서를 작성하라.\n\n${JSON.stringify(payload, null, 2)}`,
            },
          ],
        });

        let accumulated = "";
        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            accumulated += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();

        // 스트리밍 완료 후 Redis에 저장
        if (redis && accumulated) {
          try {
            await redis.set(cacheKey, accumulated, { ex: AI_REPORT_TTL_SEC });
          } catch {
            // Redis 저장 실패는 무시 (보고서는 이미 전송됨)
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Cache": "MISS",
    },
  });
}
