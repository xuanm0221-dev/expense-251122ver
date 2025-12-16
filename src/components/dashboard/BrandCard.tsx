"use client";

import { LucideIcon } from "lucide-react";
import {
  formatK,
  formatPercent,
  calculateYOY,
} from "@/lib/utils";

import {
  getMonthlyTotal,
  getPreviousYearTotal,
  getMonthlyAggregatedByCategory,
  getCategoryDetail,
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

const FIXED_COST_CATEGORIES = [
  "광고비",
  "인건비",
  "복리후생비",
  "수주회",
  "지급수수료",
  "출장비",
  "감가상각비",
];

const CATEGORY_DISPLAY_NAME: Record<string, string> = {
  광고비: "광고비",
  인건비: "인건비",
  복리후생비: "복리후생비",
  수주회: "수주회",
  지급수수료: "지급수수료",
  출장비: "출장비",
  감가상각비: "감가상각비",
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
}: BrandCardProps) {
  const current = getMonthlyTotal(bizUnit, year, month, mode);
  const previous = getPreviousYearTotal(bizUnit, year, month, mode);

  const isCommon = bizUnit === "공통";

  // 대분류별 데이터
  const categoryData = getMonthlyAggregatedByCategory(bizUnit, year, month, mode);
  const categoryMap = new Map(categoryData.map((item) => [item.cost_lv1, item]));

  // 총비용
  const totalCost = categoryData.reduce((sum, item) => sum + item.amount, 0);

  // 전년도
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

  // YOY
  const totalCostYOY = calculateYOY(totalCost, prevTotalCost);

  // 매출
  const sales = current?.sales ?? 0;
  const prevSales = previous?.sales ?? 0;
  const salesYOY = calculateYOY(sales, prevSales);

  // 비용율 계산
  const costRatio = calculateCostRatio(totalCost, sales);

  // 이전 비용율은 “아직 사용하지 않으므로 제거”
  // const prevCostRatio = ...

  const headcount = current?.headcount ?? 0;

  // 인건비(기본급만), 복리후생비 금액 추출 (인당 비용 계산용)
  // 인건비는 대분류 전체가 아닌 중분류 "기본급"만 사용 (성과급, 잡급 제외)
  const categoryDetails = getCategoryDetail(bizUnit, year, month, "인건비", mode);
  const basicSalary = categoryDetails
    .filter((item) => item.cost_lv2 === "기본급")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  
  const laborCost = basicSalary;  // 기본급만 사용
  const welfareCost = categoryMap.get("복리후생비")?.amount ?? 0;

  // 인당 비용 계산
  const perPersonLaborCost = headcount > 0 ? laborCost / headcount : null;
  const perPersonWelfareCost = headcount > 0 ? welfareCost / headcount : null;

  // 상세 카테고리 데이터
  const expenseDetails: ExpenseDetail[] = isCommon
    ? Array.from(categoryMap.entries())
        .filter(([_, data]) => data.amount > 0)
        .sort(([_, a], [__, b]) => b.amount - a.amount)
        .map(([categoryName, cat]) => {
          const prev = prevCategoryMap.get(categoryName);
          const yoy = calculateYOY(cat?.amount ?? 0, prev?.amount ?? 0);

          return {
            label: categoryName,
            amount: formatK(cat.amount),
            yoy,
            change: null,
          };
        })
    : FIXED_COST_CATEGORIES.map((categoryName) => {
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
      yoySales={salesYOY}
      yoyExpense={totalCostYOY}
      totalExpense={formatK(totalCost)}
      ratio={costRatio != null ? formatPercent(costRatio) : null}
      headcount={headcount > 0 ? `${headcount.toLocaleString("ko-KR")}명` : null}
      salesAmount={sales > 0 ? formatK(sales) : null}
      perPersonLaborCost={perPersonLaborCost != null ? formatK(perPersonLaborCost, 1) : null}
      perPersonWelfareCost={perPersonWelfareCost != null ? formatK(perPersonWelfareCost, 1) : null}
      expenseDetails={expenseDetails}
      year={year}
      month={month}
      mode={mode}
      isCommon={isCommon}
    />
  );
}

