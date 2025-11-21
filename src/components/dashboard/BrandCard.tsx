"use client";

import { LucideIcon } from "lucide-react";
import {
  formatK,
  formatPercent,
  formatPercentPoint,
  calculateYOY,
} from "@/lib/utils";
import {
  getMonthlyTotal,
  getPreviousYearTotal,
  getMonthlyAggregatedByCategory,
  calculateCostRatio,
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
}

// MLB/KIDS/DISCOVERY용 실제 대분류 카테고리 (실제 데이터 기준)
const FIXED_COST_CATEGORIES = [
  "광고비",
  "인건비",
  "복리후생비",
  "수주회",
  "지급수수료",
  "출장비",
  "감가상각비",
];

// 카테고리 표시 이름 매핑 (실제 데이터 이름 → 표시 이름)
const CATEGORY_DISPLAY_NAME: Record<string, string> = {
  "광고비": "광고비",
  "인건비": "인건비",
  "복리후생비": "복리후생비",
  "수주회": "수주회",
  "지급수수료": "지급수수료",
  "출장비": "출장비",
  "감가상각비": "감가상각비",
};

// 카테고리 표시 이름 가져오기
function getCategoryDisplayName(categoryName: string): string {
  return CATEGORY_DISPLAY_NAME[categoryName] || categoryName;
}

// 매출대비 비용율 계산
function calculateCostRatioForCategory(
  costAmount: number,
  sales: number
): number | null {
  if (sales === 0 || sales === null || sales === undefined) {
    return null;
  }
  // 비용율 계산: 비용 * 1.13 / 판매매출 * 100
  return (costAmount * 1.13 / sales) * 100;
}

// 매출대비 비용율 증감 계산 (당년 비용율 - 전년 비용율)
function calculateCostRatioChange(
  currentCost: number,
  currentSales: number,
  previousCost: number,
  previousSales: number
): number | null {
  const currentRatio = calculateCostRatioForCategory(currentCost, currentSales);
  const previousRatio = calculateCostRatioForCategory(previousCost, previousSales);
  
  if (currentRatio === null || previousRatio === null) {
    return null;
  }
  
  return currentRatio - previousRatio;
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
}: BrandCardProps) {
  const current = getMonthlyTotal(bizUnit, year, month, mode);
  const previous = getPreviousYearTotal(bizUnit, year, month, mode);

  const isCommon = bizUnit === "공통";

  // 대분류별 데이터 가져오기
  const categoryData = getMonthlyAggregatedByCategory(
    bizUnit,
    year,
    month,
    mode
  );
  const categoryMap = new Map(
    categoryData.map((item) => [item.cost_lv1, item])
  );

  // 총비용: 모든 대분류의 합계
  const totalCost = categoryData.reduce((sum, item) => sum + item.amount, 0);

  // 전년도 대분류별 데이터
  const prevCategoryData = getMonthlyAggregatedByCategory(
    bizUnit,
    year - 1,
    month,
    mode
  );
  const prevCategoryMap = new Map(
    prevCategoryData.map((item) => [item.cost_lv1, item])
  );
  const prevTotalCost = prevCategoryData.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const totalCostYOY = calculateYOY(totalCost, prevTotalCost);

  const sales = current?.sales ?? 0;
  const prevSales = previous?.sales ?? 0;
  const salesYOY = calculateYOY(sales, prevSales);

  const costRatio = calculateCostRatio(totalCost, sales);
  const prevCostRatio = calculateCostRatio(
    previous?.amount ?? null,
    previous?.sales ?? null
  );

  const headcount = current?.headcount ?? 0;

  // expenseDetails 배열 생성
  const expenseDetails: ExpenseDetail[] = isCommon
    ? Array.from(categoryMap.entries())
        .filter(([_, data]) => data.amount > 0)
        .sort(([_, a], [__, b]) => b.amount - a.amount)
        .map(([categoryName, catData]) => {
          const prevCatData = prevCategoryMap.get(categoryName);
          const catYOY = calculateYOY(
            catData?.amount ?? null,
            prevCatData?.amount ?? null
          );
          return {
            label: categoryName,
            amount: formatK(catData.amount),
            yoy: catYOY,
            change: null, // 공통은 매출이 없으므로 change 없음
          };
        })
    : FIXED_COST_CATEGORIES.map((categoryName) => {
        const catData = categoryMap.get(categoryName);
        const prevCatData = prevCategoryMap.get(categoryName);
        const catYOY = calculateYOY(
          catData?.amount ?? null,
          prevCatData?.amount ?? null
        );
        const catAmount = catData?.amount ?? 0;
        const prevCatAmount = prevCatData?.amount ?? 0;

        // 매출대비 비용율 증감 계산
        const costRatioChange = calculateCostRatioChange(
          catAmount,
          sales,
          prevCatAmount,
          prevSales
        );

        return {
          label: getCategoryDisplayName(categoryName),
          amount: formatK(catAmount),
          yoy: catYOY,
          change: costRatioChange,
        };
      });

  return (
    <BizUnitCard
      businessUnit={bizUnit}
      icon={<Icon className="w-5 h-5" />}
      yoySales={salesYOY}
      yoyExpense={totalCostYOY}
      totalExpense={formatK(totalCost)}
      ratio={costRatio !== null ? formatPercent(costRatio) : null}
      headcount={headcount > 0 ? `${headcount.toLocaleString("ko-KR")}명` : null}
      salesAmount={sales > 0 ? formatK(sales) : null}
      expenseDetails={expenseDetails}
      year={year}
      month={month}
      mode={mode}
      isCommon={isCommon}
    />
  );
}
