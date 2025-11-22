"use client";

import React, { useMemo } from "react";
import { getCategoryDetail, getAnnualData, getMonthlyTotal, type BizUnit } from "@/lib/expenseData";
import { formatK, formatPercent, formatPercentPoint } from "@/lib/utils";

interface AdExpenseRow {
  label: string;
  level: 0 | 1; // 0: 판매매출/광고비, 1: 하위 항목
  annual25_amount: number | null;
  annual25_ratio: number | null;
  annual24_amount: number | null;
  annual24_ratio: number | null;
  annual_ratio_diff: number | null;
  ytd25_amount: number | null;
  ytd25_ratio: number | null;
  ytd24_amount: number | null;
  ytd24_ratio: number | null;
  ytd_ratio_diff: number | null;
  progress: number | null;
}

interface AdExpenseAnalysisTableProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
}

// 브랜드별 색상 설정
const BRAND_COLORS: Record<BizUnit, {
  primary: string;
  light: string;
  header: string;
  headerLight: string;
}> = {
  MLB: {
    primary: "bg-blue-600",
    light: "bg-blue-50",
    header: "bg-blue-800",
    headerLight: "bg-blue-700",
  },
  KIDS: {
    light: "bg-yellow-50",
    primary: "bg-yellow-600",
    header: "bg-yellow-800",
    headerLight: "bg-yellow-700",
  },
  DISCOVERY: {
    primary: "bg-green-600",
    light: "bg-green-50",
    header: "bg-green-800",
    headerLight: "bg-green-700",
  },
  DUVETICA: {
    primary: "bg-purple-600",
    light: "bg-purple-50",
    header: "bg-purple-800",
    headerLight: "bg-purple-700",
  },
  SUPRA: {
    primary: "bg-orange-600",
    light: "bg-orange-50",
    header: "bg-orange-800",
    headerLight: "bg-orange-700",
  },
  공통: {
    primary: "bg-gray-600",
    light: "bg-gray-50",
    header: "bg-gray-800",
    headerLight: "bg-gray-700",
  },
};

export function AdExpenseAnalysisTable({
  bizUnit,
  year,
  month,
}: AdExpenseAnalysisTableProps) {
  const colors = BRAND_COLORS[bizUnit];

  // 데이터 계산
  const rows = useMemo(() => {
    const result: AdExpenseRow[] = [];

    // 매출 데이터 가져오기
    const annual25Total = getMonthlyTotal(bizUnit, year, 12, "ytd");
    const annual24Total = getMonthlyTotal(bizUnit, year - 1, 12, "ytd");
    const ytd25Total = getMonthlyTotal(bizUnit, year, month, "ytd");
    const ytd24Total = getMonthlyTotal(bizUnit, year - 1, month, "ytd");

    const annual25_sales = annual25Total?.sales || 0;
    const annual24_sales = annual24Total?.sales || 0;
    const ytd25_sales = ytd25Total?.sales || 0;
    const ytd24_sales = ytd24Total?.sales || 0;

    // 1. 판매매출(V+) 행
    const salesRow: AdExpenseRow = {
      label: "판매매출(V+)",
      level: 0,
      annual25_amount: annual25_sales,
      annual25_ratio: null, // 매출은 비율 계산 안 함
      annual24_amount: annual24_sales,
      annual24_ratio: null,
      annual_ratio_diff: null,
      ytd25_amount: ytd25_sales,
      ytd25_ratio: null,
      ytd24_amount: ytd24_sales,
      ytd24_ratio: null,
      ytd_ratio_diff: null,
      progress: annual25_sales > 0 ? (ytd25_sales / annual25_sales) * 100 : null,
    };
    result.push(salesRow);

    // 2. 광고비 전체 합계
    const adExpenseDetails = getCategoryDetail(bizUnit, year, month, "광고비", "ytd");
    const adExpenseDetails24 = getCategoryDetail(bizUnit, year - 1, month, "광고비", "ytd");
    
    // 광고비 연간 데이터
    const annual25AdExpense = getAnnualData(bizUnit, year, "광고비");
    const annual24AdExpense = getAnnualData(bizUnit, year - 1, "광고비");
    
    // 전체 광고비 합계 계산
    const annual25_totalCost = annual25AdExpense.reduce((sum, item) => sum + (item.annual_amount || 0), 0);
    const annual24_totalCost = annual24AdExpense.reduce((sum, item) => sum + (item.annual_amount || 0), 0);
    const ytd25_totalCost = adExpenseDetails.reduce((sum, item) => sum + (item.amount || 0), 0);
    const ytd24_totalCost = adExpenseDetails24.reduce((sum, item) => sum + (item.amount || 0), 0);

    // 매출대비 비율 계산 (비용 * 1.13 / 매출 * 100)
    const calculateRatio = (cost: number, sales: number): number | null => {
      if (sales === 0 || sales === null || sales === undefined) return null;
      return (cost * 1.13 / sales) * 100;
    };

    const annual25_ratio = calculateRatio(annual25_totalCost, annual25_sales);
    const annual24_ratio = calculateRatio(annual24_totalCost, annual24_sales);
    const ytd25_ratio = calculateRatio(ytd25_totalCost, ytd25_sales);
    const ytd24_ratio = calculateRatio(ytd24_totalCost, ytd24_sales);

    const adExpenseRow: AdExpenseRow = {
      label: "광고비",
      level: 0,
      annual25_amount: annual25_totalCost,
      annual25_ratio,
      annual24_amount: annual24_totalCost,
      annual24_ratio,
      annual_ratio_diff: annual25_ratio !== null && annual24_ratio !== null 
        ? annual25_ratio - annual24_ratio 
        : null,
      ytd25_amount: ytd25_totalCost,
      ytd25_ratio,
      ytd24_amount: ytd24_totalCost,
      ytd24_ratio,
      ytd_ratio_diff: ytd25_ratio !== null && ytd24_ratio !== null 
        ? ytd25_ratio - ytd24_ratio 
        : null,
      progress: annual25_totalCost > 0 ? (ytd25_totalCost / annual25_totalCost) * 100 : null,
    };
    result.push(adExpenseRow);

    // 3. 광고비 하위 항목들
    // 중분류/소분류별로 그룹화
    // 키: cost_lv2|cost_lv3 (둘 다 있으면 둘 다, 없으면 하나만)
    const itemMap = new Map<string, {
      label: string;
      annual25: number;
      annual24: number;
      ytd25: number;
      ytd24: number;
    }>();

    // 25년 연간 데이터
    annual25AdExpense.forEach((item) => {
      // 키 생성: cost_lv2와 cost_lv3를 조합
      const key = item.cost_lv2 && item.cost_lv3 
        ? `${item.cost_lv2}|${item.cost_lv3}`
        : (item.cost_lv2 || item.cost_lv3 || "기타");
      
      // 라벨 생성: cost_lv3가 있으면 "중분류 - 소분류", 없으면 중분류만
      const label = item.cost_lv3 && item.cost_lv2
        ? `${item.cost_lv2} - ${item.cost_lv3}`
        : (item.cost_lv2 || item.cost_lv3 || "기타");
      
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          label,
          annual25: 0,
          annual24: 0,
          ytd25: 0,
          ytd24: 0,
        });
      }
      const existing = itemMap.get(key)!;
      existing.annual25 += item.annual_amount || 0;
    });

    // 24년 연간 데이터
    annual24AdExpense.forEach((item) => {
      const key = item.cost_lv2 && item.cost_lv3 
        ? `${item.cost_lv2}|${item.cost_lv3}`
        : (item.cost_lv2 || item.cost_lv3 || "기타");
      if (itemMap.has(key)) {
        itemMap.get(key)!.annual24 += item.annual_amount || 0;
      } else {
        // 24년에만 있는 항목도 추가
        const label = item.cost_lv3 && item.cost_lv2
          ? `${item.cost_lv2} - ${item.cost_lv3}`
          : (item.cost_lv2 || item.cost_lv3 || "기타");
        itemMap.set(key, {
          label,
          annual25: 0,
          annual24: item.annual_amount || 0,
          ytd25: 0,
          ytd24: 0,
        });
      }
    });

    // 25년 YTD 데이터
    adExpenseDetails.forEach((item) => {
      const key = item.cost_lv2 && item.cost_lv3 
        ? `${item.cost_lv2}|${item.cost_lv3}`
        : (item.cost_lv2 || item.cost_lv3 || "기타");
      if (itemMap.has(key)) {
        itemMap.get(key)!.ytd25 += item.amount || 0;
      } else {
        // YTD에만 있는 항목도 추가
        const label = item.cost_lv3 && item.cost_lv2
          ? `${item.cost_lv2} - ${item.cost_lv3}`
          : (item.cost_lv2 || item.cost_lv3 || "기타");
        itemMap.set(key, {
          label,
          annual25: 0,
          annual24: 0,
          ytd25: item.amount || 0,
          ytd24: 0,
        });
      }
    });

    // 24년 YTD 데이터
    adExpenseDetails24.forEach((item) => {
      const key = item.cost_lv2 && item.cost_lv3 
        ? `${item.cost_lv2}|${item.cost_lv3}`
        : (item.cost_lv2 || item.cost_lv3 || "기타");
      if (itemMap.has(key)) {
        itemMap.get(key)!.ytd24 += item.amount || 0;
      } else {
        // 24년 YTD에만 있는 항목도 추가
        const label = item.cost_lv3 && item.cost_lv2
          ? `${item.cost_lv2} - ${item.cost_lv3}`
          : (item.cost_lv2 || item.cost_lv3 || "기타");
        itemMap.set(key, {
          label,
          annual25: 0,
          annual24: 0,
          ytd25: 0,
          ytd24: item.amount || 0,
        });
      }
    });

    // 하위 항목 행 생성
    itemMap.forEach((item) => {
      const annual25_ratio_item = calculateRatio(item.annual25, annual25_sales);
      const annual24_ratio_item = calculateRatio(item.annual24, annual24_sales);
      const ytd25_ratio_item = calculateRatio(item.ytd25, ytd25_sales);
      const ytd24_ratio_item = calculateRatio(item.ytd24, ytd24_sales);

      result.push({
        label: item.label,
        level: 1,
        annual25_amount: item.annual25,
        annual25_ratio: annual25_ratio_item,
        annual24_amount: item.annual24,
        annual24_ratio: annual24_ratio_item,
        annual_ratio_diff: annual25_ratio_item !== null && annual24_ratio_item !== null
          ? annual25_ratio_item - annual24_ratio_item
          : null,
        ytd25_amount: item.ytd25,
        ytd25_ratio: ytd25_ratio_item,
        ytd24_amount: item.ytd24,
        ytd24_ratio: ytd24_ratio_item,
        ytd_ratio_diff: ytd25_ratio_item !== null && ytd24_ratio_item !== null
          ? ytd25_ratio_item - ytd24_ratio_item
          : null,
        progress: item.annual25 > 0 ? (item.ytd25 / item.annual25) * 100 : null,
      });
    });

    return result;
  }, [bizUnit, year, month]);

  // 증감 색상 결정
  const getDiffColor = (value: number | null): string => {
    if (value === null || value === undefined || isNaN(value)) return "text-gray-600";
    if (value > 0) return "text-red-500";
    if (value < 0) return "text-blue-600";
    return "text-gray-600";
  };

  // 진척률 색상 결정
  const getProgressColor = (value: number | null): string => {
    if (value === null || value === undefined || isNaN(value)) return "text-gray-600";
    if (value >= 100) return "text-red-500";
    return "text-blue-600";
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
      {/* 헤더 */}
      <div className={`${colors.header} px-6 py-4 border-b-2 border-gray-200`}>
        <div className="flex items-center gap-3">
          <div className={`${colors.primary} w-1 h-8 rounded-full`}></div>
          <h2 className="text-lg font-bold text-white">{bizUnit} 브랜드 광고비 분석</h2>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            {/* 첫 번째 헤더 행 */}
            <tr className={`${colors.header} text-white`}>
              <th rowSpan={2} className="border-r border-gray-300 px-3 py-3 text-left text-xs font-semibold">
                항목
              </th>
              <th colSpan={5} className="border-r border-gray-300 px-3 py-3 text-center text-xs font-semibold">
                연간
              </th>
              <th colSpan={5} className="border-r border-gray-300 px-3 py-3 text-center text-xs font-semibold">
                YTD
              </th>
              <th rowSpan={2} className="border-l border-gray-300 px-3 py-3 text-center text-xs font-semibold">
                진척률
              </th>
            </tr>
            {/* 두 번째 헤더 행 */}
            <tr className={`${colors.headerLight} text-white`}>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">25년 금액</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">매출대비%</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">24년 금액</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">매출대비%</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">증감(p)</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">25년 금액</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">매출대비%</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">24년 금액</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">매출대비%</th>
              <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold">증감(p)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isSalesRow = row.label === "판매매출(V+)";
              const isAdExpenseRow = row.label === "광고비";
              const isSubItem = row.level === 1;

              let rowBgClass = "bg-white";
              if (isSalesRow) {
                rowBgClass = colors.light;
              } else if (isAdExpenseRow) {
                rowBgClass = "bg-gray-50";
              } else if (isSubItem) {
                rowBgClass = index % 2 === 0 ? "bg-white" : "bg-gray-50";
              }

              return (
                <tr key={index} className={`${rowBgClass} border-b border-gray-100 hover:bg-gray-100 transition-colors`}>
                  {/* 항목 */}
                  <td className="border-r border-gray-200 px-3 py-2 text-sm font-medium">
                    <div className={isSubItem ? "pl-6" : ""}>
                      {isSubItem && <span className="text-gray-400 mr-1">·</span>}
                      {row.label}
                    </div>
                  </td>

                  {/* 25년 연간 금액 */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {isSalesRow ? formatK(row.annual25_amount) : formatK(row.annual25_amount)}
                  </td>

                  {/* 25년 연간 매출대비% */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {row.annual25_ratio !== null ? formatPercent(row.annual25_ratio, 2) : "-"}
                  </td>

                  {/* 24년 연간 금액 */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {formatK(row.annual24_amount)}
                  </td>

                  {/* 24년 연간 매출대비% */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {row.annual24_ratio !== null ? formatPercent(row.annual24_ratio, 2) : "-"}
                  </td>

                  {/* 연간 증감(p) */}
                  <td className={`border-r border-gray-200 px-2 py-2 text-sm text-right ${getDiffColor(row.annual_ratio_diff)}`}>
                    {row.annual_ratio_diff !== null ? formatPercentPoint(row.annual_ratio_diff, 2) : "-"}
                  </td>

                  {/* 25년 YTD 금액 */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {formatK(row.ytd25_amount)}
                  </td>

                  {/* 25년 YTD 매출대비% */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {row.ytd25_ratio !== null ? formatPercent(row.ytd25_ratio, 2) : "-"}
                  </td>

                  {/* 24년 YTD 금액 */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {formatK(row.ytd24_amount)}
                  </td>

                  {/* 24년 YTD 매출대비% */}
                  <td className="border-r border-gray-200 px-2 py-2 text-sm text-right">
                    {row.ytd24_ratio !== null ? formatPercent(row.ytd24_ratio, 2) : "-"}
                  </td>

                  {/* YTD 증감(p) */}
                  <td className={`border-r border-gray-200 px-2 py-2 text-sm text-right ${getDiffColor(row.ytd_ratio_diff)}`}>
                    {row.ytd_ratio_diff !== null ? formatPercentPoint(row.ytd_ratio_diff, 2) : "-"}
                  </td>

                  {/* 진척률 */}
                  <td className={`border-l border-gray-200 px-2 py-2 text-sm text-right ${getProgressColor(row.progress)}`}>
                    {row.progress !== null ? formatPercent(row.progress, 1) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

