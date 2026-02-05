// @ts-ignore - JSON import
import aggregatedDataRaw from "../../data/aggregated-expense.json";

export type BizUnit = "법인" | "MLB" | "KIDS" | "DISCOVERY" | "DUVETICA" | "SUPRA" | "공통";

export type Mode = "monthly" | "ytd";

// 법인 합계 계산에 포함할 사업부 목록
const CORPORATE_BIZ_UNITS = ["MLB", "KIDS", "DISCOVERY", "공통", "DUVETICA", "SUPRA"] as const;

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
const TARGET_BIZ_UNITS: BizUnit[] = ["MLB", "KIDS", "DISCOVERY", "공통", "DUVETICA", "SUPRA"];

export function getMonthlyTotal(
  bizUnit: BizUnit,
  year: number,
  month: number,
  mode: Mode = "monthly"
): MonthlyTotal | null {
  // 법인인 경우 4개 사업부 합계 계산
  if (bizUnit === "법인") {
    const corporateData: MonthlyTotal[] = [];
    for (const bu of CORPORATE_BIZ_UNITS) {
      const buData = getMonthlyTotal(bu as BizUnit, year, month, mode);
      if (buData) {
        corporateData.push(buData);
      }
    }
    
    if (corporateData.length === 0) {
      return null;
    }
    
    // 4개 사업부 데이터 합산
    return corporateData.reduce(
      (acc, item) => ({
        ...acc,
        amount: acc.amount + (item.amount || 0),
        headcount: acc.headcount + (item.headcount || 0),
        sales: acc.sales + (item.sales || 0),
      }),
      {
        biz_unit: "법인",
        year,
        month,
        yyyymm: `${year}${String(month).padStart(2, "0")}`,
        amount: 0,
        headcount: 0,
        sales: 0,
      }
    );
  }

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

/** 해당 연도 1~12월 인원수 합계 (인당 비용 계산용: 연간 비용 합계 / 연간 인원수 합계) */
export function getAnnualHeadcountSum(bizUnit: BizUnit, year: number): number {
  let sum = 0;
  for (let m = 1; m <= 12; m++) {
    const t = getMonthlyTotal(bizUnit, year, m, "monthly");
    sum += t?.headcount ?? 0;
  }
  return sum;
}

export function getMonthlyAggregatedByCategory(
  bizUnit: BizUnit,
  year: number,
  month: number,
  mode: Mode = "monthly"
): MonthlyAggregated[] {
  // 법인인 경우 4개 사업부 합계 계산
  if (bizUnit === "법인") {
    const allCategories = new Map<string, MonthlyAggregated>();
    
    for (const bu of CORPORATE_BIZ_UNITS) {
      const buCategories = getMonthlyAggregatedByCategory(bu as BizUnit, year, month, mode);
      
      buCategories.forEach((item) => {
        const key = item.cost_lv1;
        if (allCategories.has(key)) {
          const existing = allCategories.get(key)!;
          existing.amount += item.amount;
          existing.headcount += item.headcount || 0;
          existing.sales += item.sales || 0;
        } else {
          allCategories.set(key, {
            ...item,
            biz_unit: "법인",
          });
        }
      });
    }
    
    return Array.from(allCategories.values());
  }

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

  // 법인인 경우 4개 사업부 데이터를 개별적으로 반환 (사업부 정보 유지)
  if (bizUnit === "법인") {
    const allAnnual: AnnualData[] = [];
    
    for (const bu of CORPORATE_BIZ_UNITS) {
      const buAnnual = getAnnualData(bu as BizUnit, year, costLv1, costLv2, costLv3);
      allAnnual.push(...buAnnual);
    }
    
    return allAnnual;
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
  // 법인인 경우 4개 사업부 데이터를 개별적으로 반환 (사업부 정보 유지)
  if (bizUnit === "법인") {
    const allDetails: CategoryDetail[] = [];
    
    for (const bu of CORPORATE_BIZ_UNITS) {
      const buDetails = getCategoryDetail(bu as BizUnit, year, month, costLv1, mode);
      allDetails.push(...buDetails);
    }
    
    return allDetails;
  }

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
  // 법인인 경우 4개 사업부 합계 계산
  if (bizUnit === "법인") {
    const allTrends = new Map<number, MonthlyTotal>();
    
    for (const bu of CORPORATE_BIZ_UNITS) {
      const buTrends = getMonthlyTrend(bu as BizUnit, year, mode);
      
      buTrends.forEach((item) => {
        if (allTrends.has(item.month)) {
          const existing = allTrends.get(item.month)!;
          existing.amount += item.amount;
          existing.sales += item.sales;
          existing.headcount = (existing.headcount || 0) + (item.headcount || 0);
        } else {
          allTrends.set(item.month, {
            ...item,
            biz_unit: "법인",
          });
        }
      });
    }
    
    return Array.from(allTrends.values()).sort((a, b) => a.month - b.month);
  }

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

export interface AdSalesDataPoint {
  month: number;
  yyyymm: string;
  adSpend: number; // 광고비
  sales: number; // 매출
  adSpendPrevYear: number | null;
  salesPrevYear: number | null;
}/**
 * 광고비-매출 분석 데이터 추출
 * @param bizUnit 사업부
 * @param year 년도
 * @returns 월별 광고비-매출 데이터 (광고비가 0이거나 null인 월 제외)
 */
export function getAdSalesAnalysisData(
  bizUnit: BizUnit,
  year: number
): AdSalesDataPoint[] {
  // 당해년도 및 전년도 월별 데이터 가져오기
  const currentYearData = getMonthlyTrend(bizUnit, year, "monthly");
  const prevYearData = getMonthlyTrend(bizUnit, year - 1, "monthly");

  // 전년도 데이터를 Map으로 변환
  const prevYearMap = new Map(
    prevYearData.map((item) => [item.month, item])
  );

  // 각 월의 광고비 추출
  const result: AdSalesDataPoint[] = [];

  for (const monthData of currentYearData) {
    // 해당 월의 광고비 추출
    const adCategories = getMonthlyAggregatedByCategory(
      bizUnit,
      year,
      monthData.month,
      "monthly"
    );
    const adExpense = adCategories.find((cat) => cat.cost_lv1 === "광고비");
    const adSpend = adExpense?.amount ?? 0;

    // 전년도 광고비 추출
    const prevYearMonth = prevYearMap.get(monthData.month);
    let adSpendPrevYear: number | null = null;
    if (prevYearMonth) {
      const prevAdCategories = getMonthlyAggregatedByCategory(
        bizUnit,
        year - 1,
        monthData.month,
        "monthly"
      );
      const prevAdExpense = prevAdCategories.find(
        (cat) => cat.cost_lv1 === "광고비"
      );
      adSpendPrevYear = prevAdExpense?.amount ?? null;
    }

    // 광고비가 0이거나 매출이 0인 경우 제외
    if (adSpend > 0 && monthData.sales > 0) {
      result.push({
        month: monthData.month,
        yyyymm: monthData.yyyymm,
        adSpend,
        sales: monthData.sales,
        adSpendPrevYear,
        salesPrevYear: prevYearMonth?.sales ?? null,
      });
    }
  }

  return result.sort((a, b) => a.month - b.month);
}

/** 채널(광고비 cost_lv2)별 월별 광고비 + 해당 월 전체 매출 */
export interface AdSalesByChannelItem {
  channel: string;
  data: AdSalesDataPoint[];
}

export function getAdSalesByChannel(
  bizUnit: BizUnit,
  year: number
): AdSalesByChannelItem[] {
  const monthlyTrend = getMonthlyTrend(bizUnit, year, "monthly");
  const prevYearTrend = getMonthlyTrend(bizUnit, year - 1, "monthly");
  const prevYearMap = new Map(prevYearTrend.map((item) => [item.month, item]));

  const channelMonths = new Map<string, Map<number, { adSpend: number; sales: number; salesPrevYear: number | null }>>();

  for (const mt of monthlyTrend) {
    const details = getCategoryDetail(bizUnit, year, mt.month, "광고비", "monthly");
    const byLv2 = new Map<string, number>();
    for (const d of details) {
      const key = (d.cost_lv2 || "").trim() || "기타";
      byLv2.set(key, (byLv2.get(key) ?? 0) + d.amount);
    }
    const prev = prevYearMap.get(mt.month);
    for (const [channel, adSpend] of byLv2) {
      if (adSpend <= 0 || mt.sales <= 0) continue;
      if (!channelMonths.has(channel)) {
        channelMonths.set(channel, new Map());
      }
      channelMonths.get(channel)!.set(mt.month, {
        adSpend,
        sales: mt.sales,
        salesPrevYear: prev?.sales ?? null,
      });
    }
  }  const result: AdSalesByChannelItem[] = [];
  for (const [channel, monthMap] of channelMonths) {
    const data: AdSalesDataPoint[] = [];
    for (const [month, v] of monthMap) {
      const prev = prevYearMap.get(month);
      let adSpendPrevYear: number | null = null;
      if (prev) {
        const prevDetails = getCategoryDetail(bizUnit, year - 1, month, "광고비", "monthly");
        const prevAd = prevDetails.find((d) => ((d.cost_lv2 || "").trim() || "기타") === channel);
        adSpendPrevYear = prevAd?.amount ?? null;
      }
      data.push({
        month,
        yyyymm: `${year}${String(month).padStart(2, "0")}`,
        adSpend: v.adSpend,
        sales: v.sales,
        adSpendPrevYear,
        salesPrevYear: v.salesPrevYear,
      });
    }
    data.sort((a, b) => a.month - b.month);
    if (data.length >= 3) {
      result.push({ channel, data });
    }
  }
  return result.sort((a, b) => a.channel.localeCompare(b.channel));
}
