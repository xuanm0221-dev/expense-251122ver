// @ts-ignore - JSON import
import aggregatedDataRaw from "../../data/aggregated-expense.json";

export type BizUnit = "MLB" | "KIDS" | "DISCOVERY" | "DUVETICA" | "SUPRA" | "공통";

export type Mode = "monthly" | "ytd";

export interface MonthlyAggregated {
  biz_unit: string;
  year: number;
  month: number;
  yyyymm: string;
  cost_lv1: string;
  amount: number;
  headcount: number;
  sales: number;
}

export interface MonthlyTotal {
  biz_unit: string;
  year: number;
  month: number;
  yyyymm: string;
  amount: number;
  headcount: number;
  sales: number;
}

export interface CategoryDetail {
  biz_unit: string;
  year: number;
  month: number;
  yyyymm: string;
  cost_lv1: string;
  cost_lv2: string;
  cost_lv3: string;
  amount: number;
  headcount?: number;  // 사업부(소분류) 기준 인원수 (선택적)
}

export interface AnnualData {
  biz_unit: string;
  year: number;
  cost_lv1: string;
  cost_lv2: string;
  cost_lv3: string;
  annual_amount: number;
}

export interface AggregatedData {
  monthly_aggregated: MonthlyAggregated[];
  monthly_total: MonthlyTotal[];
  category_detail: CategoryDetail[];
  annual_data?: AnnualData[];  // 연간 데이터 (선택적)
  metadata: {
    target_biz_units: string[];
    years: number[];
    months: number[];
  };
}

const data = aggregatedDataRaw as AggregatedData;

// 데이터를 export하여 컴포넌트에서 접근 가능하도록
export { data };

// 분석 대상 사업부만 필터링
const TARGET_BIZ_UNITS: BizUnit[] = ["MLB", "KIDS", "DISCOVERY", "공통"];

export function getMonthlyTotal(
  bizUnit: BizUnit,
  year: number,
  month: number,
  mode: Mode = "monthly"
): MonthlyTotal | null {
  let filtered = data.monthly_total.filter(
    (item) => item.biz_unit === bizUnit && item.year === year
  );

  if (mode === "monthly") {
    filtered = filtered.filter((item) => item.month === month);
  } else {
    // YTD: 1월부터 해당 월까지
    filtered = filtered.filter((item) => item.month <= month);
  }

  if (filtered.length === 0) {
    return null;
  }

  // YTD인 경우 합계 계산
  if (mode === "ytd") {
    if (filtered.length === 0) {
      return null;
    }
    const aggregated = filtered.reduce(
      (acc, item) => ({
        ...acc,
        amount: acc.amount + (item.amount || 0),
        headcount: item.headcount || 0, // 마지막 월의 인원수 사용
        sales: acc.sales + (item.sales || 0),
      }),
      {
        biz_unit: bizUnit,
        year,
        month,
        yyyymm: `${year}${String(month).padStart(2, "0")}`,
        amount: 0,
        headcount: 0,
        sales: 0,
      }
    );
    return aggregated;
  }

  return filtered[0];
}

export function getPreviousYearTotal(
  bizUnit: BizUnit,
  year: number,
  month: number,
  mode: Mode = "monthly"
): MonthlyTotal | null {
  return getMonthlyTotal(bizUnit, year - 1, month, mode);
}

export function getMonthlyAggregatedByCategory(
  bizUnit: BizUnit,
  year: number,
  month: number,
  mode: Mode = "monthly"
): MonthlyAggregated[] {
  let filtered = data.monthly_aggregated.filter(
    (item) => item.biz_unit === bizUnit && item.year === year
  );

  if (mode === "monthly") {
    filtered = filtered.filter((item) => item.month === month);
  } else {
    filtered = filtered.filter((item) => item.month <= month);
  }

  // monthly와 ytd 모두 대분류별로 합계 계산
  const grouped = new Map<string, MonthlyAggregated>();
  filtered.forEach((item) => {
    const key = item.cost_lv1;
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.amount += item.amount;
    } else {
      grouped.set(key, { ...item });
    }
  });
  return Array.from(grouped.values());
}

export function getAnnualData(
  bizUnit: BizUnit | "ALL",
  year: number,
  costLv1: string = "",
  costLv2: string = "",
  costLv3: string = ""
): AnnualData[] {
  if (!data.annual_data) {
    return [];
  }

  // bizUnit이 "ALL"이면 모든 사업부(MLB, KIDS, DISCOVERY, DUVETICA, SUPRA, 공통) 포함
  let filtered = data.annual_data.filter(
    (item) =>
      (bizUnit === "ALL" || item.biz_unit === bizUnit) &&
      item.year === year &&
      (costLv1 === "" || item.cost_lv1 === costLv1) &&
      (costLv2 === "" || item.cost_lv2 === costLv2) &&
      (costLv3 === "" || item.cost_lv3 === costLv3)
  );

  return filtered;
}

export function getCategoryDetail(
  bizUnit: BizUnit | "ALL",
  year: number,
  month: number,
  costLv1: string = "",
  mode: Mode = "monthly"
): CategoryDetail[] {
  // bizUnit이 "ALL"이면 모든 사업부(MLB, KIDS, DISCOVERY, DUVETICA, SUPRA, 공통) 포함
  let filtered = data.category_detail.filter(
    (item) =>
      (bizUnit === "ALL" || item.biz_unit === bizUnit) &&
      item.year === year &&
      (costLv1 === "" || item.cost_lv1 === costLv1)
  );

  if (mode === "monthly") {
    filtered = filtered.filter((item) => item.month === month);
  } else {
    filtered = filtered.filter((item) => item.month <= month);
  }

  // 디버깅: 필터링 결과 확인
  if (costLv1 === "광고비" && bizUnit === "MLB") {
    console.log(`[getCategoryDetail] MLB 광고비 필터링 결과: ${filtered.length}개`);
    if (filtered.length > 0) {
      const lv2Set = new Set(filtered.map((item) => item.cost_lv2 || "").filter((x) => x.trim() !== ""));
      console.log(`[getCategoryDetail] 중분류 종류:`, Array.from(lv2Set));
      const sample = filtered.filter((item) => (item.cost_lv2 || "").trim() !== "").slice(0, 5);
      console.log(`[getCategoryDetail] 샘플:`, sample);
    }
  }

  if (mode === "ytd") {
    // YTD: 사업부구분, 중분류, 소분류별로 합계
    const grouped = new Map<string, CategoryDetail>();
    filtered.forEach((item) => {
      // bizUnit이 "ALL"인 경우도 사업부구분을 유지 (계층 구조를 위해)
      const key = `${item.biz_unit || ""}|${item.cost_lv1 || ""}|${item.cost_lv2 || ""}|${item.cost_lv3 || ""}`;
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.amount += item.amount;
      } else {
        grouped.set(key, { ...item });
      }
    });
    return Array.from(grouped.values());
  }

  return filtered;
}

export function getMonthlyTrend(
  bizUnit: BizUnit,
  year: number,
  mode: Mode = "monthly"
): MonthlyTotal[] {
  let filtered = data.monthly_total.filter(
    (item) => item.biz_unit === bizUnit && item.year === year
  );

  if (mode === "ytd") {
    // YTD: 각 월까지의 누적값 계산
    const result: MonthlyTotal[] = [];
    let cumulativeAmount = 0;
    let cumulativeSales = 0;
    for (let m = 1; m <= 12; m++) {
      const monthData = filtered.find((item) => item.month === m);
      if (monthData) {
        cumulativeAmount += monthData.amount;
        cumulativeSales += monthData.sales;
        result.push({
          ...monthData,
          amount: cumulativeAmount,
          sales: cumulativeSales,
        });
      }
    }
    return result;
  }

  return filtered.sort((a, b) => a.month - b.month);
}

export function getMonthlyStackedData(
  bizUnit: BizUnit,
  year: number,
  mode: Mode = "monthly"
): {
  month: number;
  yyyymm: string;
  categories: Record<string, number>;
  total: number;
  yoy: number | null;
  current: number;
  previous: number | null;
}[] {
  const monthlyData = getMonthlyTrend(bizUnit, year, mode);
  const prevYearData = getMonthlyTrend(bizUnit, year - 1, mode);

  const prevYearMap = new Map(
    prevYearData.map((item) => [`${item.month}`, item])
  );

  return monthlyData.map((item) => {
    const prevItem = prevYearMap.get(`${item.month}`);
    const previous = prevItem?.amount ?? null;
    // YOY 계산: 당년 / 전년 * 100 (예: 당년 1500 / 전년 100 = 1,500%)
    // 전년도가 음수이거나 0이면 YOY를 null로 처리 (추세선 끊김)
    const yoy =
      previous !== null && previous > 0
        ? (item.amount / previous) * 100
        : null;

    // 해당 월의 대분류별 데이터 가져오기
    const categoryData = getMonthlyAggregatedByCategory(
      bizUnit,
      year,
      item.month,
      mode
    );

    const categories: Record<string, number> = {};
    categoryData.forEach((cat) => {
      categories[cat.cost_lv1] = (categories[cat.cost_lv1] || 0) + cat.amount;
    });

    return {
      month: item.month,
      yyyymm: item.yyyymm,
      categories,
      total: item.amount,
      yoy,
      current: item.amount,
      previous,
    };
  });
}

export function calculateYOY(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  // YOY 계산: 당년 / 전년 * 100 (예: 당년 68 / 전년 100 = 68%)
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    previous === 0 ||
    isNaN(current) ||
    isNaN(previous)
  ) {
    return null;
  }
  // YOY 계산: 당년 / 전년 * 100 (예: 당년 68 / 전년 100 = 68%)
  return (current / previous) * 100;
}

export function calculateCostRatio(
  cost: number | null | undefined,
  sales: number | null | undefined
): number | null {
  if (
    cost === null ||
    cost === undefined ||
    sales === null ||
    sales === undefined ||
    sales === 0 ||
    isNaN(cost) ||
    isNaN(sales)
  ) {
    return null;
  }
  // 비용율 계산: 비용 * 1.13 / 판매매출 * 100
  return (cost * 1.13 / sales) * 100;
}

export function calculatePerPersonCost(
  cost: number | null | undefined,
  headcount: number | null | undefined
): number | null {
  if (
    cost === null ||
    cost === undefined ||
    headcount === null ||
    headcount === undefined ||
    headcount === 0 ||
    isNaN(cost) ||
    isNaN(headcount)
  ) {
    return null;
  }
  return cost / headcount;
}

export function getAvailableYears(): number[] {
  return data.metadata.years.sort((a, b) => b - a);
}

export function getAvailableMonths(year: number): number[] {
  const months = data.monthly_total
    .filter((item) => item.year === year)
    .map((item) => item.month);
  return [...new Set(months)].sort((a, b) => a - b);
}

