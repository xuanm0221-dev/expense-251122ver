"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryDetail, type BizUnit } from "@/lib/expenseData";
import { formatK, formatPercent } from "@/lib/utils";
import { ExpenseAccountRow } from "@/types/expense";

const AD_ROW_ORDER = ["MLB", "KIDS", "DISCOVERY"] as const;
const navyColor = "#001f3f";
const navyBarColor = "#5b7cba";

interface AdExpenseCardProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
  adNode?: ExpenseAccountRow | null;
  yearType?: 'actual' | 'plan';
}

function sumByBizUnit(details: { biz_unit: string; amount: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  details.forEach((d) => {
    const key = d.biz_unit || "";
    if (key.trim() !== "") {
      map.set(key, (map.get(key) || 0) + d.amount);
    }
  });
  return map;
}

function totalAdExpense(details: { amount: number }[]): number {
  return details.reduce((s, d) => s + d.amount, 0);
}

export function AdExpenseCard({ bizUnit, year, month, adNode }: AdExpenseCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  // adNode가 제공되면 계층형 데이터 사용, 아니면 기존 로직 사용
  let totalCurrent: number;
  let totalPrev: number;
  let byBizCurrent: Map<string, number>;
  let byBizPrev: Map<string, number>;

  if (adNode) {
    // 계층형 표에서 받은 데이터 사용
    totalCurrent = adNode.curr_ytd;
    totalPrev = adNode.prev_ytd;

    // L2 children에서 브랜드별 금액 추출
    const currMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    
    adNode.children?.forEach(child => {
      // biz_unit 또는 category_l2를 키로 사용 (법인/ALL은 biz_unit, 브랜드는 category_l2)
      const key = child.biz_unit || child.category_l2;
      if (key && key.trim() !== "") {
        currMap.set(key, child.curr_ytd);
        prevMap.set(key, child.prev_ytd);
      }
    });

    byBizCurrent = currMap;
    byBizPrev = prevMap;
  } else {
    // 기존 로직: getCategoryDetail 사용
    const detailCurrent = getCategoryDetail(bizUnit, year, month, "광고비", "ytd");
    const detailPrev = getCategoryDetail(bizUnit, year - 1, month, "광고비", "ytd");

    totalCurrent = totalAdExpense(detailCurrent);
    totalPrev = totalAdExpense(detailPrev);

    byBizCurrent = sumByBizUnit(detailCurrent);
    byBizPrev = sumByBizUnit(detailPrev);
  }

  const yoy = totalPrev > 0 ? (totalCurrent / totalPrev) * 100 : null;

  return (
    <div className="w-full min-w-0">
      <Card className="relative overflow-hidden" style={{ borderColor: navyColor, borderWidth: "1px" }}>
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: navyBarColor }} />
        <CardHeader className="pl-5 pb-3">
          <CardTitle style={{ color: navyColor, fontSize: "21px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "3px", height: "1em", backgroundColor: navyBarColor, display: "inline-block" }} />
              광고비
            </span>
            <span className="font-bold">{totalCurrent > 0 ? formatK(totalCurrent, 0) : "-"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-5">
          <div className="mb-2">
            <div style={{ fontSize: "50%", color: navyColor }}>
              (전년 {totalPrev > 0 ? formatK(totalPrev, 0) : "-"}, YoY{" "}
              {yoy != null ? formatPercent(yoy, 0) : "-"})
            </div>
          </div>
          <hr className="border-gray-200 my-3" />
          <div style={{ fontSize: "50%" }}>
            <table className="w-full text-gray-700">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-2 font-semibold">
                    {adNode && (
                      <button
                        onClick={() => setShowDetail(!showDetail)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {showDetail ? "간략히" : "상세보기"}
                      </button>
                    )}
                  </th>
                  <th className="text-right py-1 px-1 font-semibold">당년</th>
                  <th className="text-right py-1 px-1 font-semibold">전년</th>
                  <th className="text-right py-1 pl-1 font-semibold">YoY</th>
                </tr>
              </thead>
              <tbody>
                {AD_ROW_ORDER.map((key) => {
                  const curr = byBizCurrent.get(key) ?? 0;
                  const prev = byBizPrev.get(key) ?? 0;
                  const yoyRow = prev > 0 ? (curr / prev) * 100 : null;
                  const currStr = curr > 0 ? formatK(curr, 0) : "-";
                  const prevStr = prev > 0 ? formatK(prev, 0) : "-";
                  const yoyStr = yoyRow != null ? formatPercent(yoyRow, 0) : "-";
                  
                  // L2 노드 찾기 (소분류 데이터용)
                  const l2Node = adNode?.children?.find(
                    c => (c.biz_unit || c.category_l2) === key
                  );
                  
                  // L3 children 필터링 (curr_ytd > 0, showDetail === true일 때만)
                  const l3Children = showDetail && l2Node?.children 
                    ? l2Node.children.filter(c => c.curr_ytd > 0)
                    : [];

                  return (
                    <React.Fragment key={key}>
                      {/* L2 행 (브랜드 합계) */}
                      <tr>
                        <td className="text-left py-0.5 pr-2 font-semibold">{key}</td>
                        <td className="text-right py-0.5 px-1">{currStr}</td>
                        <td className="text-right py-0.5 px-1">{prevStr}</td>
                        <td className="text-right py-0.5 pl-1">{yoyStr}</td>
                      </tr>
                      
                      {/* L3 행들 (소분류) - showDetail이 true면 자동으로 표시 */}
                      {l3Children.map((l3, idx) => {
                        const l3Yoy = l3.prev_ytd > 0 ? (l3.curr_ytd / l3.prev_ytd) * 100 : null;
                        return (
                          <tr key={`${key}-${idx}`} className="text-gray-600">
                            <td className="text-left py-0.5 pr-2 pl-4">
                              - {l3.category_l3 || "-"}
                            </td>
                            <td className="text-right py-0.5 px-1">{formatK(l3.curr_ytd, 0)}</td>
                            <td className="text-right py-0.5 px-1">{l3.prev_ytd > 0 ? formatK(l3.prev_ytd, 0) : "-"}</td>
                            <td className="text-right py-0.5 pl-1">{l3Yoy != null ? formatPercent(l3Yoy, 0) : "-"}</td>
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
