"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  calculatePerPersonCost,
  type BizUnit,
  type Mode,
} from "@/lib/expenseData";

interface BrandCardProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
  mode: Mode;
  brandColor: string;
  brandInitial: string;
  brandName: string;
}

const COST_CATEGORIES = [
  "광고선전비",
  "인건비",
  "복리후생비",
  "수수료",
  "출장비",
  "감가상각비",
  "기타",
];

export function BrandCard({
  bizUnit,
  year,
  month,
  mode,
  brandColor,
  brandInitial,
  brandName,
}: BrandCardProps) {
  const current = getMonthlyTotal(bizUnit, year, month, mode);
  const previous = getPreviousYearTotal(bizUnit, year, month, mode);

  const isCommon = bizUnit === "공통";

  const totalCost = current?.amount || 0;
  const totalCostYOY = calculateYOY(
    current?.amount || null,
    previous?.amount || null
  );

  const sales = current?.sales || 0;
  const salesYOY = calculateYOY(current?.sales || null, previous?.sales || null);

  const costRatio = calculateCostRatio(totalCost, sales);
  const prevCostRatio = calculateCostRatio(
    previous?.amount || null,
    previous?.sales || null
  );
  const costRatioYOY =
    costRatio !== null && prevCostRatio !== null
      ? costRatio - prevCostRatio
      : null;

  const headcount = current?.headcount || 0;

  // 대분류별 데이터
  const categoryData = getMonthlyAggregatedByCategory(
    bizUnit,
    year,
    month,
    mode
  );
  const categoryMap = new Map(
    categoryData.map((item) => [item.cost_lv1, item])
  );
  const prevCategoryData = mode === "monthly"
    ? getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode)
    : [];
  const prevCategoryMap = new Map(
    prevCategoryData.map((item) => [item.cost_lv1, item])
  );

  const getCategoryYOY = (category: string) => {
    const curr = categoryMap.get(category);
    const prev = prevCategoryMap.get(category);
    return calculateYOY(curr?.amount || null, prev?.amount || null);
  };

  return (
    <Card className="h-full flex flex-col" style={{ borderTopColor: brandColor, borderTopWidth: 4 }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              style={{
                backgroundColor: brandColor,
                color: "white",
                border: "none",
              }}
              className="text-lg font-bold px-3 py-1"
            >
              {brandInitial}
            </Badge>
            <span className="text-xl font-bold">{brandName}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* 주요 KPI */}
        <div className="space-y-3 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatK(totalCost)}</span>
            <span className="text-sm text-muted-foreground">총비용</span>
            {totalCostYOY !== null && (
              <span
                className={`text-sm font-medium ${
                  totalCostYOY >= 0 ? "text-red-600" : "text-blue-600"
                }`}
              >
                ({totalCostYOY >= 0 ? "+" : ""}
                {formatPercent(totalCostYOY)})
              </span>
            )}
          </div>

          {!isCommon && (
            <>
              {costRatio !== null && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {formatPercent(costRatio)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    매출대비 비용률
                  </span>
                  {costRatioYOY !== null && (
                    <span
                      className={`text-sm ${
                        costRatioYOY >= 0 ? "text-red-600" : "text-blue-600"
                      }`}
                    >
                      ({formatPercentPoint(costRatioYOY)})
                    </span>
                  )}
                </div>
              )}

              {headcount > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {headcount.toLocaleString("ko-KR")}명
                  </span>
                  <span className="text-sm text-muted-foreground">인원수</span>
                </div>
              )}

              {sales > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {formatK(sales)}
                  </span>
                  <span className="text-sm text-muted-foreground">실판매 매출</span>
                  {salesYOY !== null && (
                    <span
                      className={`text-sm ${
                        salesYOY >= 0 ? "text-red-600" : "text-blue-600"
                      }`}
                    >
                      ({salesYOY >= 0 ? "+" : ""}
                      {formatPercent(salesYOY)})
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 대분류별 요약 */}
        <div className="mt-auto pt-4 border-t">
          <div className="text-sm font-semibold mb-2">영업비 상세</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {COST_CATEGORIES.map((category) => {
              const catData = categoryMap.get(category);
              const catYOY = getCategoryYOY(category);
              if (!catData || catData.amount === 0) return null;

              return (
                <div key={category} className="flex justify-between">
                  <span className="text-muted-foreground">{category}:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{formatK(catData.amount)}</span>
                    {catYOY !== null && (
                      <span
                        className={
                          catYOY >= 0 ? "text-red-600" : "text-blue-600"
                        }
                      >
                        ({catYOY >= 0 ? "+" : ""}
                        {formatPercent(catYOY)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 상세보기 버튼 */}
        <div className="mt-4">
          <Link href={`/${bizUnit}?year=${year}&month=${month}&mode=${mode}`}>
            <Button className="w-full" variant="outline">
              {isCommon ? "공통비용 상세보기" : "전체 대시보드 보기"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

