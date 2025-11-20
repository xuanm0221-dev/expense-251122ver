// @ts-ignore - JSON import
import aggregatedDataRaw from "../../data/aggregated-expense.json";

export type BizUnit = "MLB" | "KIDS" | "DISCOVERY" | "공통";

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
}

export interface AggregatedData {
  monthly_aggregated: MonthlyAggregated[];
  monthly_total: MonthlyTotal[];
  category_detail: CategoryDetail[];
  metadata: {
    target_biz_units: string[];
    years: number[];
    months: number[];
  };
}

const data = aggregatedDataRaw as AggregatedData;

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
    const aggregated = filtered.reduce(
      (acc, item) => ({
        ...acc,
        amount: acc.amount + item.amount,
        headcount: item.headcount, // 마지막 월의 인원수 사용
        sales: acc.sales + item.sales,
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

  if (mode === "ytd") {
    // YTD: 대분류별로 합계
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

  return filtered;
}

export function getCategoryDetail(
  bizUnit: BizUnit,
  year: number,
  month: number,
  costLv1: string,
  mode: Mode = "monthly"
): CategoryDetail[] {
  let filtered = data.category_detail.filter(
    (item) =>
      item.biz_unit === bizUnit &&
      item.year === year &&
      item.cost_lv1 === costLv1
  );

  if (mode === "monthly") {
    filtered = filtered.filter((item) => item.month === month);
  } else {
    filtered = filtered.filter((item) => item.month <= month);
  }

  if (mode === "ytd") {
    // YTD: 중분류, 소분류별로 합계
    const grouped = new Map<string, CategoryDetail>();
    filtered.forEach((item) => {
      const key = `${item.cost_lv2}|${item.cost_lv3}`;
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
}[] {
  const monthlyData = getMonthlyTrend(bizUnit, year, mode);
  const prevYearData = getMonthlyTrend(bizUnit, year - 1, mode);

  const prevYearMap = new Map(
    prevYearData.map((item) => [`${item.month}`, item])
  );

  return monthlyData.map((item) => {
    const prevItem = prevYearMap.get(`${item.month}`);
    const yoy =
      prevItem && prevItem.amount > 0
        ? ((item.amount - prevItem.amount) / prevItem.amount) * 100
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
    };
  });
}

export function calculateYOY(
  current: number | null,
  previous: number | null
): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function calculateCostRatio(
  cost: number,
  sales: number
): number | null {
  if (sales === 0 || isNaN(sales)) {
    return null;
  }
  return (cost / sales) * 100;
}

export function calculatePerPersonCost(
  cost: number,
  headcount: number
): number | null {
  if (headcount === 0 || isNaN(headcount)) {
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

