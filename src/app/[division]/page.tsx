"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MonthlyStackedChart } from "@/components/dashboard/MonthlyStackedChart";
import { CategoryDrilldown } from "@/components/dashboard/CategoryDrilldown";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  getMonthlyTotal,
  getPreviousYearTotal,
  calculateYOY,
  calculateCostRatio,
  calculatePerPersonCost,
  getAvailableYears,
  getAvailableMonths,
  type BizUnit,
  type Mode,
} from "@/lib/expenseData";
import { formatK, formatPercent, formatPercentPoint } from "@/lib/utils";

const DIVISION_NAMES: Record<string, string> = {
  MLB: "MLB",
  KIDS: "KIDS",
  DISCOVERY: "DISCOVERY",
  공통: "공통",
};

export default function DivisionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const division = params.division as string;
  const bizUnit = division as BizUnit;

  const availableYears = getAvailableYears();
  const [year, setYear] = useState<number>(
    parseInt(searchParams.get("year") || availableYears[0]?.toString() || "2025")
  );
  const [month, setMonth] = useState<number>(
    parseInt(searchParams.get("month") || "10")
  );
  const [mode, setMode] = useState<Mode>(
    (searchParams.get("mode") as Mode) || "monthly"
  );

  const availableMonths = getAvailableMonths(year);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [year, availableMonths, month]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("year", year.toString());
    params.set("month", month.toString());
    params.set("mode", mode);
    router.replace(`/${division}?${params.toString()}`, { scroll: false });
  }, [year, month, mode, division, router]);

  if (!["MLB", "KIDS", "DISCOVERY", "공통"].includes(bizUnit)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">페이지를 찾을 수 없습니다</h1>
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  const current = getMonthlyTotal(bizUnit, year, month, mode);
  const previous = getPreviousYearTotal(bizUnit, year, month, mode);

  const isCommon = bizUnit === "공통";

  const totalCost = current?.amount || 0;
  const totalCostYOY = calculateYOY(
    current?.amount || null,
    previous?.amount || null
  );
  const totalCostChange =
    current?.amount && previous?.amount
      ? current.amount - previous.amount
      : null;

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
  const perPersonCost = calculatePerPersonCost(totalCost, headcount);
  const prevPerPersonCost = calculatePerPersonCost(
    previous?.amount || null,
    previous?.headcount || null
  );
  const perPersonCostYOY = calculateYOY(perPersonCost, prevPerPersonCost);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로
            </Button>
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">
              {DIVISION_NAMES[bizUnit]} 비용 분석
            </h1>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">연도:</label>
                <Select
                  value={year.toString()}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-24"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">월:</label>
                <Select
                  value={month.toString()}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-24"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </Select>
              </div>
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="monthly">당월</TabsTrigger>
                  <TabsTrigger value="ytd">누적(YTD)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="총비용"
            value={formatK(totalCost)}
            yoy={totalCostYOY}
            changeAmount={totalCostChange}
            yoyLabel="전년동월대비"
          />
          {!isCommon && (
            <>
              <KpiCard
                title="인당 비용"
                value={perPersonCost ? formatK(perPersonCost) : "-"}
                yoy={perPersonCostYOY}
                yoyLabel="전년동월대비"
              />
              <KpiCard
                title="매출대비 비용률"
                value={costRatio ? formatPercent(costRatio) : "-"}
                yoy={costRatioYOY}
                yoyLabel="전년동월대비"
                description={costRatioYOY ? formatPercentPoint(costRatioYOY) : undefined}
              />
              <KpiCard
                title="매출"
                value={formatK(sales)}
                yoy={salesYOY}
                yoyLabel="전년동월대비"
              />
            </>
          )}
          {isCommon && (
            <>
              <KpiCard
                title="공통비용 YOY"
                value={totalCostYOY ? formatPercent(totalCostYOY) : "-"}
                description="전년동월대비 증감률"
              />
              <KpiCard
                title="공통비용 변화액"
                value={totalCostChange ? formatK(totalCostChange) : "-"}
                description="전년동월대비"
              />
            </>
          )}
        </div>

        {/* 월별 추이 차트 */}
        <div className="mb-6">
          <MonthlyStackedChart bizUnit={bizUnit} year={year} mode={mode} />
        </div>

        {/* 드릴다운 차트 */}
        <div>
          <CategoryDrilldown
            bizUnit={bizUnit}
            year={year}
            month={month}
            mode={mode}
          />
        </div>
      </div>
    </div>
  );
}

