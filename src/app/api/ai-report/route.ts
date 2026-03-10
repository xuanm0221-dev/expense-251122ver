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

--------------------------------------------------
[데이터 사용 원칙]
--------------------------------------------------

입력 데이터는 JSON 형태로 제공된다.
SQL 원문, HTML 원문, 화면 문구를 임의 재해석하지 말고
전달받은 JSON 값만 기준으로 분석한다.

절대 금지:
- JSON에 없는 숫자 생성
- 예시 보고서 숫자 재사용
- 임의 추정치 생성
- 통화 단위 변환
- 숫자 반올림 왜곡
- 한국식 단위(억원, 백만원, 원) 사용
- KRW, USD 등 다른 통화 표기

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

--------------------------------------------------
[기간 및 비교 기준]
--------------------------------------------------

분석은 반드시 아래 두 축으로 수행한다.

1. 당월 vs 전년동월
2. YTD vs 전년 YTD

항상 월 기준과 YTD 기준을 함께 보고 최종 판단한다.

--------------------------------------------------
[YOY 및 이상 판단 규칙]
--------------------------------------------------

기본 YOY 판정:
- YOY >= 110% : 증가
- YOY 90~110% : 정상 범위
- YOY < 90% : 감소

하지만 최종 판정은 반드시 당월과 YTD를 함께 봐야 한다.

판정 원칙:
- 당월 이상 + YTD도 이상 → 구조적 이상 가능성 높음
- 당월 이상 + YTD 정상 → 일회성/시점차 가능성, 추적 필요
- 당월 정상 + YTD 이상 → 누적 구조 악화 가능성
- 당월 정상 + YTD 정상 → 정상

--------------------------------------------------
[핵심 해석 원칙]
--------------------------------------------------

반드시 아래 관점으로 분석한다.

1. 비용 증가율 vs 매출 증가율
2. 비용률 변화 (총비용/매출, 주요 항목/매출, 브랜드별)
3. 브랜드별 효율성 차이 (MLB, KIDS, DISCOVERY, 공통)
4. 비용 구조 재분류 (고정비, 준고정비, 변동비)
5. 비용 항목별 드라이버 분석
6. 생산성 분석 (기말 인원, 평균 인원, 인당 기본급, 인건비/매출)
7. 리스크 플래그 탐지

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
판매매출|{당년K}|{전년K}|{YOY%}|{증감K}
총비용|{당년K}|{전년K}|{YOY%}|{증감K}
비용률|{당년%}|{전년%}|{변화p}|{개선 또는 악화}
인원|{기말명/평균명}|{전년기말/전년평균}|{기말증감}|{인당매출K}

===BRAND_TABLE===
| 브랜드 | 매출YOY | 비용YOY | 영업비율 | 전년비율 | 비율변화 | 인건비율 | 레버리지 |
|--------|---------|---------|----------|----------|----------|----------|----------|
| 법인전체 | ... | ... | ... | ... | ... | ... | 개선 또는 악화 |
| MLB | ... | ... | ... | ... | ... | ... | ... |
| KIDS | ... | ... | ... | ... | ... | ... | ... |
| DISCOVERY | ... | ... | ... | ... | ... | ... | ... |
| 공통 | N/A | ... | ... | ... | ... | ... | ... |

===RISK_TABLE===
| 항목 | 판정 | 수치/원인 |
|------|------|-----------|
| ... | 🔴 | ... |
| ... | 🟡 | ... |
(최대 8행)

===YOY_TABLE===
| 항목 | YOY | 매출比 | 판단 |
|------|-----|--------|------|
| ... | ...% | ... | 🔴 원인규명 |
(최대 6행)

===COST_STRUCTURE===
고정비|인건비+임차료+감가상각비|{금액K}|{구성비%}|{YOY%}
준고정비|복리후생비+IT수수료+기타+차량렌트비|{금액K}|{구성비%}|{YOY%}
변동비|광고비+수주회+출장비+지급수수료+세금과공과|{금액K}|{구성비%}|{YOY%}

===COST_INSIGHT===
▶ {한 줄 비용 구조 핵심 해석}

===KEY_INSIGHT===
{CEO를 위한 핵심 요약 - 두 줄 이내, 숫자 근거 포함}

===DETAILED===
## 1️⃣ 매출 대비 비용 효율성 분석
### A. 전사 비용률 분석
| 항목 | 전년 | 당년 | 증감 | 비용률변화 | 레버리지판단 |
(이하 2️⃣ ~ 5️⃣ 섹션을 markdown 표 중심으로 계속 작성)
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

  // Redis 캐시 히트 시 즉시 반환 (재생성 요청이 아닌 경우)
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

  // 전년 기준 결정
  const prevYear = yearType === "plan" ? 2025 : year - 1;
  const prevMonth = yearType === "plan" ? 12 : month;
  const prevMode: "monthly" | "ytd" = yearType === "plan" ? "ytd" : mode;
  const prevYearType = "actual";

  const brands: Record<string, ReturnType<typeof buildBrandSummary>> = {};
  for (const brand of BRANDS_WITH_CORP) {
    brands[brand] = buildBrandSummary(
      data, brand, year, month, mode, yearType,
      prevYear, prevMonth, prevMode, prevYearType
    );
  }

  const payload = {
    period: { year, month, mode, yearType },
    comparisonPeriod: { year: prevYear, month: prevMonth, mode: prevMode, yearType: prevYearType },
    note: "모든 금액 단위: K. current=당기, previous=전년동기. 예: 42083 → 42,083K로 표기할 것.",
    brands,
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
