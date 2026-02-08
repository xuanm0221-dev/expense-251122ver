"use client";

import { LucideIcon } from "lucide-react";
import {
  formatK,
  formatM,
  formatPercent,
  calculateYOY,
} from "@/lib/utils";

import {
  getMonthlyTotal,
  getPreviousYearTotal,
  getMonthlyAggregatedByCategory,
  getCategoryDetail,
  calculateCostRatio,
  getAnnualHeadcountSum,
  getAnnualData,
  type BizUnit,
  type Mode,
} from "@/lib/expenseData";

import { BizUnitCard, type ExpenseDetail } from "./BizUnitCard";

interface BrandCardProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
  mode: Mode;
  brandColor: string;
  brandInitial: string;
  brandName: string;
  icon: LucideIcon;
  yearType?: 'actual' | 'plan';
}

/** 영업비 상세보기 표시 순서 */
const EXPENSE_DETAIL_ORDER = [
  "인건비",
  "복리후생비",
  "광고비",
  "수주회",
  "출장비",
  "지급수수료",
  "IT수수료",
  "감가상각비",
  "임차료",
  "세금과공과",
  "기타",
  "차량렌트비",
];

const CATEGORY_DISPLAY_NAME: Record<string, string> = {
  광고비: "광고비",
  인건비: "인건비",
  복리후생비: "복리후생비",
  수주회: "수주회",
  지급수수료: "지급수수료",
  출장비: "출장비",
  감가상각비: "감가상각비",
  IT수수료: "IT수수료",
  임차료: "임차료",
  세금과공과: "세금과공과",
  기타: "기타",
  차량렌트비: "차량렌트비",
};

function getCategoryDisplayName(categoryName: string): string {
  return CATEGORY_DISPLAY_NAME[categoryName] || categoryName;
}

// 비용율 계산
function calculateCostRatioForCategory(
  cost: number,
  sales: number
): number | null {
  if (!sales) return null;
  return (cost * 1.13 / sales) * 100;
}

// 비용율 증감 계산
function calculateCostRatioChange(
  currentCost: number,
  currentSales: number,
  prevCost: number,
  prevSales: number
): number | null {
  const curr = calculateCostRatioForCategory(currentCost, currentSales);
  const prev = calculateCostRatioForCategory(prevCost, prevSales);

  if (curr == null || prev == null) return null;
  return curr - prev;
}

export function BrandCard({
  bizUnit,
  year,
  month,
  mode,
  brandColor,
  brandInitial,
  brandName,
  icon: Icon,
  yearType = 'actual',
}: BrandCardProps) {
  const isPlanYear = year === 2026 && yearType === 'plan';
  
  // 2026년(예산): 연간 데이터 사용
  const annualData = isPlanYear ? getAnnualData(bizUnit, year, "", "", "", yearType) : [];
  const annualSum = annualData.reduce((s, i) => s + i.annual_amount, 0);
  
  // 2026년(예산): 12월 기말 인원수 및 연간 매출 합계 계산
  const annualHeadcount = isPlanYear 
    ? (getMonthlyTotal(bizUnit, year, 12, "monthly", yearType)?.headcount || 0)
    : 0;
  const annualSales = isPlanYear ? (() => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const monthData = getMonthlyTotal(bizUnit, year, m, "monthly", yearType);
      sum += monthData?.sales || 0;
    }
    return sum;
  })() : 0;
  
  const current = isPlanYear 
    ? { 
        biz_unit: bizUnit,
        year,
        month: 12,
        yyyymm: `${year}12`,
        amount: annualSum,
        headcount: annualHeadcount,
        sales: annualSales,
      }
    : getMonthlyTotal(bizUnit, year, month, mode, yearType);
  
  // 전년도는 2025년 12월 YTD (2026 예산의 경우)
  const previous = isPlanYear
    ? getMonthlyTotal(bizUnit, 2025, 12, "ytd", 'actual')
    : getPreviousYearTotal(bizUnit, year, month, mode, yearType);

  const isCommon = bizUnit === "공통";
  const isCorporate = bizUnit === "법인";

  // 공통 카드: 전체 법인 매출 기준 YOY 및 매출대비%용
  const corporateTotal = isCommon ? getMonthlyTotal("법인", year, month, mode, yearType) : null;
  const prevCorporateTotal = isCommon ? getPreviousYearTotal("법인", year, month, mode, yearType) : null;

  // 대분류별 데이터
  const categoryData = getMonthlyAggregatedByCategory(bizUnit, year, month, mode, yearType);
  const categoryMap = new Map(categoryData.map((item) => [item.cost_lv1, item]));

  // 총비용
  const totalCost = categoryData.reduce((sum, item) => sum + item.amount, 0);

  // 전년도 (2026 예산이면 2025년 12월 YTD)
  const prevCategoryData = isPlanYear
    ? getMonthlyAggregatedByCategory(bizUnit, 2025, 12, "ytd", 'actual')
    : getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode, yearType);
  const prevCategoryMap = new Map(
    prevCategoryData.map((item) => [item.cost_lv1, item])
  );

  const prevTotalCost = prevCategoryData.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  // YOY
  const totalCostYOY = calculateYOY(totalCost, prevTotalCost);

  // 매출 (법인은 4개 사업부 합산 매출 있음)
  const sales = current?.sales ?? 0;
  const prevSales = previous?.sales ?? 0;
  const salesYOY = calculateYOY(sales, prevSales);
  // 공통: 전체 법인 매출 YOY 표시
  const corporateSalesYOY =
    isCommon && corporateTotal != null && prevCorporateTotal != null
      ? calculateYOY(corporateTotal.sales ?? 0, prevCorporateTotal.sales ?? 0)
      : null;

  // 비용율 계산 (법인: 법인 매출 기준, 공통: 전체 법인 매출 기준)
  const costRatio = isCorporate
    ? calculateCostRatio(totalCost, sales)
    : isCommon
      ? calculateCostRatio(totalCost, corporateTotal?.sales ?? 0)
      : calculateCostRatio(totalCost, sales);

  // 이전 비용율은 “아직 사용하지 않으므로 제거”
  // const prevCostRatio = ...

  const headcount = current?.headcount ?? 0;
  // 2026년(예산)일 때는 전년도 인원수를 2025년 12월로 직접 가져옴
  const prevHeadcount = isPlanYear
    ? (getMonthlyTotal(bizUnit, 2025, 12, "monthly", 'actual')?.headcount ?? 0)
    : (previous?.headcount ?? 0);
  const headcountDiff = headcount - prevHeadcount;
  const headcountChangeStr =
    headcount > 0 || prevHeadcount > 0
      ? headcountDiff === 0
        ? "0명"
        : headcountDiff > 0
          ? `+${headcountDiff}명`
          : `${headcountDiff}명`
      : null;

  // 인건비(기본급만), 복리후생비(5대보험+공적금만) 금액 추출 (인당 비용 계산용)
  // 인건비는 중분류 "기본급"만 사용 (성과급, 잡급 제외)
  const laborDetails = getCategoryDetail(bizUnit, year, month, "인건비", mode, yearType);
  const basicSalary = laborDetails
    .filter((item) => item.cost_lv2 === "기본급")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  
  // 전년도 인건비 (2026년 예산이면 2025년 12월 YTD actual)
  const prevYear = isPlanYear ? 2025 : year - 1;
  const prevMonth = isPlanYear ? 12 : month;
  const prevMode = isPlanYear ? "ytd" : mode;
  const prevYearType = isPlanYear ? 'actual' : yearType;
  
  const prevLaborDetails = getCategoryDetail(bizUnit, prevYear, prevMonth, "인건비", prevMode, prevYearType);
  const prevBasicSalary = prevLaborDetails
    .filter((item) => item.cost_lv2 === "기본급")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  
  // 복리후생비는 중분류 "5대보험" + "공적금"만 사용 (인당 비용 계산용)
  const welfareDetails = getCategoryDetail(bizUnit, year, month, "복리후생비", mode, yearType);
  const welfare5InsuranceAndFund = welfareDetails
    .filter((item) => item.cost_lv2 === "5대보험" || item.cost_lv2 === "공적금")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  
  // 전년도 5대보험 + 공적금
  const prevWelfareDetails = getCategoryDetail(bizUnit, prevYear, prevMonth, "복리후생비", prevMode, prevYearType);
  const prevWelfare5InsuranceAndFund = prevWelfareDetails
    .filter((item) => item.cost_lv2 === "5대보험" || item.cost_lv2 === "공적금")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  
  const laborCost = basicSalary;  // 기본급만 사용
  const welfareCost = welfare5InsuranceAndFund;  // 5대보험 + 공적금만 사용

  // 인당 비용 계산
  // YTD(연간): 합계 / 연간 인원수 합계 | 당월: 당월 비용 / 당월 인원수
  const annualHeadcountSum = mode === "ytd" || isPlanYear 
    ? getAnnualHeadcountSum(bizUnit, year, yearType) 
    : 0;
  const prevAnnualHeadcountSum = mode === "ytd" || isPlanYear 
    ? getAnnualHeadcountSum(bizUnit, prevYear, prevYearType) 
    : 0;
  const denom = mode === "ytd" || isPlanYear ? annualHeadcountSum : headcount;
  const prevDenom = mode === "ytd" || isPlanYear ? prevAnnualHeadcountSum : prevHeadcount;
  const perPersonLaborCost = denom > 0 ? laborCost / denom : null;
  const perPersonWelfareCost = denom > 0 ? welfareCost / denom : null;
  const prevPerPersonLaborCost = prevDenom > 0 ? prevBasicSalary / prevDenom : null;
  const prevPerPersonWelfareCost = prevDenom > 0 ? prevWelfare5InsuranceAndFund / prevDenom : null;
  
  // 인당 비용 YOY 계산
  const perPersonLaborCostYOY = calculateYOY(perPersonLaborCost ?? 0, prevPerPersonLaborCost ?? 0);
  const perPersonWelfareCostYOY = calculateYOY(perPersonWelfareCost ?? 0, prevPerPersonWelfareCost ?? 0);

  // 법인/공통 카드용 매출 기준 (매출대비%증감 계산)
  const salesForRatio = isCorporate ? sales : (isCommon ? (corporateTotal?.sales ?? 0) : sales);
  const prevSalesForRatio = isCorporate ? prevSales : (isCommon ? (prevCorporateTotal?.sales ?? 0) : prevSales);

  // 상세 카테고리 데이터 (순서: EXPENSE_DETAIL_ORDER)
  const expenseDetails: ExpenseDetail[] = (isCommon || isCorporate)
    ? EXPENSE_DETAIL_ORDER.filter((name) => categoryMap.has(name))
        .map((categoryName) => {
          const cat = categoryMap.get(categoryName)!;
          const prev = prevCategoryMap.get(categoryName);
          const yoy = calculateYOY(cat?.amount ?? 0, prev?.amount ?? 0);
          const ratioChange = calculateCostRatioChange(
            cat?.amount ?? 0,
            salesForRatio,
            prev?.amount ?? 0,
            prevSalesForRatio
          );
          return {
            label: categoryName,
            amount: formatK(cat.amount),
            yoy,
            change: ratioChange,
          };
        })
    : EXPENSE_DETAIL_ORDER.filter((categoryName) => {
        const amount = categoryMap.get(categoryName)?.amount ?? 0;
        return amount > 0; // 브랜드 카드: 연간(또는 당월) 0인 항목은 미표시
      }).map((categoryName) => {
        const cat = categoryMap.get(categoryName);
        const prev = prevCategoryMap.get(categoryName);
        const amount = cat?.amount ?? 0;
        const prevAmount = prev?.amount ?? 0;
        const yoy = calculateYOY(amount, prevAmount);
        const ratioChange = calculateCostRatioChange(
          amount,
          sales,
          prevAmount,
          prevSales
        );
        return {
          label: getCategoryDisplayName(categoryName),
          amount: formatK(amount),
          yoy,
          change: ratioChange,
        };
      });

  return (
    <BizUnitCard
      businessUnit={bizUnit}
      icon={<Icon className="w-5 h-5" />}
      yoySales={isCommon ? corporateSalesYOY : salesYOY}
      yoyExpense={totalCostYOY}
      totalExpense={formatK(totalCost)}
      ratio={costRatio != null ? formatPercent(costRatio) : null}
      headcount={headcount > 0 ? `${headcount.toLocaleString("ko-KR")}명` : null}
      headcountChange={headcountChangeStr}
      salesAmount={
        isCorporate
          ? (sales > 0 ? formatM(sales, 0) : null)
          : isCommon
            ? (corporateTotal && (corporateTotal.sales ?? 0) > 0 ? formatM(corporateTotal.sales!, 0) : null)
            : (sales > 0 ? formatM(sales, 0) : null)
      }
      perPersonLaborCost={perPersonLaborCost != null ? formatK(perPersonLaborCost, 1) : null}
      perPersonWelfareCost={perPersonWelfareCost != null ? formatK(perPersonWelfareCost, 1) : null}
      perPersonLaborCostYOY={perPersonLaborCostYOY != null ? formatPercent(perPersonLaborCostYOY, 0) : null}
      perPersonWelfareCostYOY={perPersonWelfareCostYOY != null ? formatPercent(perPersonWelfareCostYOY, 0) : null}
      expenseDetails={expenseDetails}
      year={year}
      month={month}
      mode={mode}
      isCommon={isCommon}
    />
  );
}

