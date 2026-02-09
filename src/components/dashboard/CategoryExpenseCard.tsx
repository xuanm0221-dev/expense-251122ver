"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryDetail, type BizUnit } from "@/lib/expenseData";
import { formatK, formatPercent } from "@/lib/utils";
import { ExpenseAccountRow } from "@/types/expense";

const navyColor = "#001f3f";
const navyBarColor = "#5b7cba";

interface CategoryExpenseCardProps {
  title: string;
  categoryLv1: string;
  node?: ExpenseAccountRow | null;
  bizUnit: BizUnit;
  year: number;
  month: number;
  yearType?: "actual" | "plan";
  sales?: number;
  prevSales?: number;
}

function sumByKey(details: { cost_lv2: string; amount: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  details.forEach((d) => {
    const key = d.cost_lv2 || "";
    if (key.trim() !== "") {
      map.set(key, (map.get(key) || 0) + d.amount);
    }
  });
  return map;
}

function totalExpense(details: { amount: number }[]): number {
  return details.reduce((s, d) => s + d.amount, 0);
}

export function CategoryExpenseCard({
  title,
  categoryLv1,
  node,
  bizUnit,
  year,
  month,
  yearType = "actual",
  sales,
  prevSales,
}: CategoryExpenseCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const isBrand = bizUnit === "MLB" || bizUnit === "KIDS" || bizUnit === "DISCOVERY";

  let totalCurrent: number;
  let totalPrev: number;
  let l2Children: ExpenseAccountRow[] = [];

  if (node) {
    totalCurrent = node.curr_ytd;
    totalPrev = node.prev_ytd;
    
    if (isBrand && categoryLv1 === "수주회") {
      // 브랜드 페이지의 수주회만: L2(중분류)를 건너뛰고 L3(소분류)를 직접 표시
      const allL3Children: ExpenseAccountRow[] = [];
      (node.children || []).forEach(l2 => {
        if (l2.children && l2.children.length > 0) {
          allL3Children.push(...l2.children);
        }
      });
      l2Children = allL3Children;
    } else {
      l2Children = node.children || [];
    }
  } else {
    const detailCurrent = getCategoryDetail(bizUnit, year, month, categoryLv1, "ytd", yearType);
    const detailPrev =
      year === 2026 && yearType === "plan"
        ? getCategoryDetail(bizUnit, 2025, 12, categoryLv1, "ytd", "actual")
        : getCategoryDetail(bizUnit, year - 1, month, categoryLv1, "ytd", yearType);

    totalCurrent = totalExpense(detailCurrent);
    totalPrev = totalExpense(detailPrev);

    const currMap = sumByKey(detailCurrent);
    const prevMap = sumByKey(detailPrev);
    const allKeys = new Set([...currMap.keys(), ...prevMap.keys()]);
    l2Children = Array.from(allKeys).map((key) => ({
      id: `${categoryLv1}-l2-${key}`,
      level: 2 as const,
      category_l1: categoryLv1,
      category_l2: key,
      category_l3: "",
      prev_month: 0,
      curr_month: 0,
      prev_ytd: prevMap.get(key) || 0,
      curr_ytd: currMap.get(key) || 0,
      prev_year_annual: null,
      curr_year_annual: null,
      description: "",
      isExpanded: false,
      children: [],
    }));
  }

  const yoy = totalPrev > 0 ? (totalCurrent / totalPrev) * 100 : null;
  const costRatio = sales && sales > 0 ? (totalCurrent / sales) * 100 : null;
  const diff = totalCurrent - totalPrev;
  const diffStr = diff >= 0 ? `+${formatK(diff, 0)}` : formatK(diff, 0);
  const yoyStr = yoy != null ? formatPercent(yoy, 0) : "-";
  const sortedL2Children = [...l2Children].sort((a, b) => b.curr_ytd - a.curr_ytd);
  const displayChildren = showDetail ? sortedL2Children : sortedL2Children.slice(0, 5);

  return (
    <div className="w-full min-w-0">
      <Card className="relative overflow-hidden" style={{ borderColor: navyColor, borderWidth: "1px" }}>
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: navyBarColor }} />
        <CardHeader className="pl-5 pb-3">
          <CardTitle style={{ color: navyColor, fontSize: "21px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "3px", height: "1em", backgroundColor: navyBarColor, display: "inline-block" }} />
              {title}
            </span>
            <span className="font-bold" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <span>
                {totalCurrent > 0 ? formatK(totalCurrent, 0) : "-"}
                {costRatio != null && ` (${costRatio.toFixed(1)}%)`}
              </span>
              <span style={{ fontSize: "0.85em" }}>
                {diffStr} ({yoyStr})
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-5">
          <hr className="border-gray-200 my-3" />
          <div style={{ fontSize: "50%" }}>
            <table className="w-full text-gray-700">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-2 font-semibold">
                    {node && (
                      l2Children.length > 5 || 
                      (isBrand && categoryLv1 === "출장비" && l2Children.some(c => c.children && c.children.length > 0))
                    ) && (
                      <button onClick={() => setShowDetail(!showDetail)} className="text-blue-600 hover:text-blue-800">
                        {showDetail ? "간략히" : "상세보기"}
                      </button>
                    )}
                  </th>
                  <th className="text-right py-1 px-1 font-semibold">전년</th>
                  <th className="text-right py-1 px-1 font-semibold">당년</th>
                  <th className="text-right py-1 pl-1 font-semibold">YoY</th>
                </tr>
              </thead>
              <tbody>
                {displayChildren.map((l2Child, idx) => {
                  const curr = l2Child.curr_ytd;
                  const prev = l2Child.prev_ytd;
                  const yoyRow = prev > 0 ? (curr / prev) * 100 : null;
                  const currStr = curr > 0 ? formatK(curr, 0) : "-";
                  const prevStr = prev > 0 ? formatK(prev, 0) : "-";
                  const diff = curr - prev;
                  const amountPart = (diff >= 0 ? "+" : "-") + formatK(Math.abs(diff), 0);
                  const percentPart = yoyRow != null ? formatPercent(yoyRow, 0) : "";
                  const yoyStr = percentPart ? `${amountPart} (${percentPart})` : amountPart;
                  // 수주회는 L3(소분류)를 직접 보여주므로 category_l3 우선, 나머지는 category_l2 우선
                  const label = (isBrand && categoryLv1 === "수주회")
                    ? (l2Child.category_l3 || l2Child.category_l2 || l2Child.biz_unit || "-")
                    : (l2Child.category_l2 || l2Child.biz_unit || "-");

                  // L3 children 펼치기: 상세보기 활성화 && 자식이 있음 && 수주회가 아님 (수주회는 이미 L3 직접 표시)
                  const l3Children = showDetail && l2Child.children && !(isBrand && categoryLv1 === "수주회")
                    ? l2Child.children.filter(c => c.curr_ytd > 0)
                    : [];

                  return (
                    <React.Fragment key={idx}>
                      {/* 행 표시 */}
                      <tr>
                        <td className="text-left py-0.5 pr-2 font-semibold">{label}</td>
                        <td className="text-right py-0.5 px-1">{prevStr}</td>
                        <td className="text-right py-0.5 px-1">{currStr}</td>
                        <td className="text-right py-0.5 pl-1">{yoyStr}</td>
                      </tr>
                      
                      {/* L3 행들 (소분류) - 비-브랜드 페이지에서 상세보기 시 */}
                      {l3Children.map((l3, l3Idx) => {
                        const l3Yoy = l3.prev_ytd > 0 ? (l3.curr_ytd / l3.prev_ytd) * 100 : null;
                        const l3Diff = l3.curr_ytd - l3.prev_ytd;
                        const l3AmountPart = (l3Diff >= 0 ? "+" : "-") + formatK(Math.abs(l3Diff), 0);
                        const l3PercentPart = l3Yoy != null ? formatPercent(l3Yoy, 0) : "";
                        const l3YoyStr = l3PercentPart ? `${l3AmountPart} (${l3PercentPart})` : l3AmountPart;
                        
                        return (
                          <tr key={`${idx}-${l3Idx}`} className="text-gray-600">
                            <td className="text-left py-0.5 pr-2 pl-4">
                              - {l3.category_l3 || l3.biz_unit || "-"}
                            </td>
                            <td className="text-right py-0.5 px-1">
                              {l3.prev_ytd > 0 ? formatK(l3.prev_ytd, 0) : "-"}
                            </td>
                            <td className="text-right py-0.5 px-1">{formatK(l3.curr_ytd, 0)}</td>
                            <td className="text-right py-0.5 pl-1">{l3YoyStr}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
