"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryDetail, getAnnualHeadcountSum, type BizUnit } from "@/lib/expenseData";
import { formatK, formatPercent } from "@/lib/utils";

const LABOR_COST_LV2_ORDER = ["기본급", "Red pack", "성과급충당금", "잡급"] as const;
const navyColor = "#001f3f";
const navyBarColor = "#5b7cba"; // 톤 다운된 파랑 (좌측 세로 바)

interface LaborCostPerCapitaCardProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
}

function sumByLv2(details: { cost_lv1: string; cost_lv2: string; amount: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  details
    .filter((d) => d.cost_lv1 === "인건비" && (d.cost_lv2 || "").trim() !== "")
    .forEach((d) => {
      const key = d.cost_lv2;
      map.set(key, (map.get(key) || 0) + d.amount);
    });
  return map;
}

function totalLabor(details: { cost_lv1: string; amount: number }[]): number {
  return details
    .filter((d) => d.cost_lv1 === "인건비")
    .reduce((s, d) => s + d.amount, 0);
}

export function LaborCostPerCapitaCard({ bizUnit, year, month }: LaborCostPerCapitaCardProps) {
  const detailCurrent = getCategoryDetail(bizUnit, year, month, "인건비", "ytd");
  const detailPrev = getCategoryDetail(bizUnit, year - 1, month, "인건비", "ytd");
  const headcountCurrent = getAnnualHeadcountSum(bizUnit, year);
  const headcountPrev = getAnnualHeadcountSum(bizUnit, year - 1);

  const totalCurrent = totalLabor(detailCurrent);
  const totalPrev = totalLabor(detailPrev);
  const perCapitaCurrent = headcountCurrent > 0 ? totalCurrent / headcountCurrent : null;
  const perCapitaPrev = headcountPrev > 0 ? totalPrev / headcountPrev : null;
  const yoyTotal =
    perCapitaCurrent != null && perCapitaPrev != null && perCapitaPrev !== 0
      ? (perCapitaCurrent / perCapitaPrev) * 100
      : null;

  const byLv2Current = sumByLv2(detailCurrent);
  const byLv2Prev = sumByLv2(detailPrev);

  return (
    <div className="w-[12.5%] min-w-0 flex-none">
      <Card className="relative overflow-hidden" style={{ borderColor: navyColor, borderWidth: "1px" }}>
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: navyBarColor }} />
        <CardHeader className="pl-5 pb-3">
          <CardTitle style={{ color: navyColor, fontSize: "21px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "3px", height: "1em", backgroundColor: navyBarColor, display: "inline-block" }} />
              인건비
            </span>
            <span className="font-bold">{perCapitaCurrent != null ? formatK(perCapitaCurrent, 1) : "-"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-5">
          <div className="mb-2">
            <div style={{ fontSize: "50%", color: navyColor }}>
              (전년 {perCapitaPrev != null ? formatK(perCapitaPrev, 1) : "-"} /인, YoY{" "}
              {yoyTotal != null ? formatPercent(yoyTotal, 0) : "-"})
            </div>
            <div className="text-gray-500 mt-1" style={{ fontSize: "50%" }}>
              계산식: 전체 인건비 합계(YTD) / 연간 인원수 합계
            </div>
          </div>
          <hr className="border-gray-200 my-3" />
          <div style={{ fontSize: "50%" }}>
            <table className="w-full text-gray-700">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-2 font-semibold"></th>
                  <th className="text-right py-1 px-1 font-semibold">당년</th>
                  <th className="text-right py-1 px-1 font-semibold">전년</th>
                  <th className="text-right py-1 pl-1 font-semibold">YoY</th>
                </tr>
              </thead>
              <tbody>
                {LABOR_COST_LV2_ORDER.map((lv2) => {
                  const curr = byLv2Current.get(lv2) ?? 0;
                  const prev = byLv2Prev.get(lv2) ?? 0;
                  const pcCurr = headcountCurrent > 0 ? curr / headcountCurrent : null;
                  const pcPrev = headcountPrev > 0 ? prev / headcountPrev : null;
                  const yoy =
                    pcCurr != null && pcPrev != null && pcPrev !== 0 ? (pcCurr / pcPrev) * 100 : null;
                  const currStr = pcCurr != null ? formatK(pcCurr, 1) : "-";
                  const prevStr = pcPrev != null ? formatK(pcPrev, 1) : "-";
                  const yoyStr = yoy != null ? formatPercent(yoy, 0) : "-";
                  return (
                    <tr key={lv2}>
                      <td className="text-left py-0.5 pr-2">{lv2}:</td>
                      <td className="text-right py-0.5 px-1">{currStr}</td>
                      <td className="text-right py-0.5 px-1">{prevStr}</td>
                      <td className="text-right py-0.5 pl-1">{yoyStr}</td>
                    </tr>
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
