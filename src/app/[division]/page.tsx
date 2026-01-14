"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MonthlyStackedChart } from "@/components/dashboard/MonthlyStackedChart";
import { CategoryDrilldown } from "@/components/dashboard/CategoryDrilldown";
import { BizUnitSwitch } from "@/components/dashboard/BizUnitSwitch";
import { AdExpenseAnalysisTable } from "@/components/dashboard/AdExpenseAnalysisTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, ChevronDown, Baby, Mountain, Building2 } from "lucide-react";

// 야구공 아이콘 컴포넌트
const BaseballIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* 야구공 원형 윤곽선 */}
    <circle cx="12" cy="12" r="9" />
    {/* 위쪽 이음새 곡선 (왼쪽에서 중앙으로) */}
    <path d="M3 12 Q6 8 12 12" />
    {/* 위쪽 이음새 곡선 (오른쪽에서 중앙으로) */}
    <path d="M21 12 Q18 8 12 12" />
    {/* 위쪽 이음새의 스티치 (왼쪽) */}
    <line x1="4.5" y1="10" x2="4.5" y2="10.8" />
    <line x1="5.5" y1="9.5" x2="5.5" y2="10.3" />
    {/* 위쪽 이음새의 스티치 (오른쪽) */}
    <line x1="19.5" y1="10" x2="19.5" y2="10.8" />
    <line x1="18.5" y1="9.5" x2="18.5" y2="10.3" />
    {/* 아래쪽 이음새 곡선 (왼쪽에서 중앙으로) */}
    <path d="M3 12 Q6 16 12 12" />
    {/* 아래쪽 이음새 곡선 (오른쪽에서 중앙으로) */}
    <path d="M21 12 Q18 16 12 12" />
    {/* 아래쪽 이음새의 스티치 (왼쪽) */}
    <line x1="4.5" y1="14" x2="4.5" y2="13.2" />
    <line x1="5.5" y1="14.5" x2="5.5" y2="13.7" />
    {/* 아래쪽 이음새의 스티치 (오른쪽) */}
    <line x1="19.5" y1="14" x2="19.5" y2="13.2" />
    <line x1="18.5" y1="14.5" x2="18.5" y2="13.7" />
  </svg>
);
import {
  getMonthlyTotal,
  getPreviousYearTotal,
  getMonthlyAggregatedByCategory,
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

// 사업부별 아이콘 매핑
const DIVISION_ICONS: Record<string, React.ElementType> = {
  MLB: BaseballIcon,
  KIDS: Baby,
  DISCOVERY: Mountain,
  공통: Building2,
};

export default function DivisionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Next.js의 useParams()는 이미 디코딩된 값을 반환
  const divisionRaw = params.division as string;
  // 한글 경로 처리: URL 인코딩된 값이 올 수 있으므로 디코딩 시도
  const division = divisionRaw ? decodeURIComponent(divisionRaw) : divisionRaw;
  const bizUnit = division as BizUnit;
  
  // 디버깅: division 값 확인
  console.log("Division from params (raw):", divisionRaw);
  console.log("Division (decoded):", division);
  console.log("BizUnit:", bizUnit);
  console.log("Valid bizUnits:", ["MLB", "KIDS", "DISCOVERY", "공통"].includes(bizUnit));

  const availableYears = getAvailableYears();
  const [year, setYear] = useState<number>(
    parseInt(searchParams.get("year") || availableYears[0]?.toString() || "2025")
  );
  const [month, setMonth] = useState<number>(
    parseInt(searchParams.get("month") || "12")
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
    const searchParams = new URLSearchParams();
    searchParams.set("year", year.toString());
    searchParams.set("month", month.toString());
    searchParams.set("mode", mode);
    // Next.js router는 자동으로 URL 인코딩을 처리하므로 원본 값을 사용
    router.replace(`/${division}?${searchParams.toString()}`, { scroll: false });
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

  // 인건비 데이터 가져오기
  const currentCategories = getMonthlyAggregatedByCategory(bizUnit, year, month, mode);
  const previousCategories = getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode);
  const currentLaborCost = currentCategories.find(cat => cat.cost_lv1 === "인건비");
  const previousLaborCost = previousCategories.find(cat => cat.cost_lv1 === "인건비");

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
    previous?.amount ?? 0,
    previous?.sales ?? 0
  );
  const costRatioYOY =
    costRatio !== null && prevCostRatio !== null
      ? costRatio - prevCostRatio
      : null;

  // 인당 비용 계산: 인건비 / 인원수
  const headcount = current?.headcount || 0;
  const laborCostAmount = currentLaborCost?.amount || 0;
  const perPersonCost = calculatePerPersonCost(laborCostAmount, headcount);
  
  const prevHeadcount = previous?.headcount || 0;
  const prevLaborCostAmount = previousLaborCost?.amount || 0;
  const prevPerPersonCost = calculatePerPersonCost(prevLaborCostAmount, prevHeadcount);
  
  const perPersonCostYOY = calculateYOY(perPersonCost, prevPerPersonCost);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          {/* 첫 번째 줄: 뒤로가기 + 제목 + 사업부 전환 버튼 */}
          <div className="flex items-center gap-3 mb-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {DIVISION_ICONS[bizUnit] && (() => {
                  const Icon = DIVISION_ICONS[bizUnit];
                  return <Icon className="w-6 h-6" />;
                })()}
                <span>{DIVISION_NAMES[bizUnit]} 비용분석</span>
              </h1>
              {/* 사업부 전환 버튼 */}
              <BizUnitSwitch
                currentBizUnit={bizUnit}
                year={year}
                month={month}
                mode={mode}
              />
            </div>
          </div>
          
          {/* 두 번째 줄: 기준일 + 전환 버튼 + 날짜 선택 */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-500">
              {year}년 {month}월 기준
            </p>
            <div className="flex items-center gap-3 whitespace-nowrap">
              {/* 당월/누적 전환 버튼 */}
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="monthly">당월</TabsTrigger>
                  <TabsTrigger value="ytd">누적 (YTD)</TabsTrigger>
                </TabsList>
              </Tabs>
              {/* 날짜 선택 버튼 */}
              <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg shadow-sm border border-gray-200 whitespace-nowrap">
                <Calendar className="w-5 h-5" style={{ color: '#3b82f6' }} />
                <div className="relative">
                  <select
                    value={year.toString()}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="appearance-none bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer pr-6"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}년
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={month.toString()}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="appearance-none bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer pr-6"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">주요 지표 (KPI)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="총비용"
            value={totalCost}
            unit="K"
            yoy={totalCostYOY}
            yoyLabel="전년동월대비"
            previousValue={previous?.amount ?? null}
          />
          {!isCommon && (
            <>
              <KpiCard
                title="인당 비용"
                value={perPersonCost}
                unit="K"
                yoy={perPersonCostYOY}
                yoyLabel="전년동월대비"
                previousValue={prevPerPersonCost}
                description={`직원 1인당 인건비: ${headcount > 0 && laborCostAmount > 0 ? formatK(laborCostAmount / headcount, 1) : "-"} (${headcount}명)`}
              />
              <KpiCard
                title="매출대비 비용률"
                value={costRatio}
                yoy={costRatioYOY}
                yoyLabel="전년동월대비"
                previousValue={prevCostRatio}
                description="효율성 지표"
              />
              <KpiCard
                title="매출"
                value={sales}
                unit="K"
                yoy={salesYOY}
                yoyLabel="전년동월대비"
                previousValue={previous?.sales ?? null}
              />
            </>
          )}
          {isCommon && (
            <>
              <KpiCard
                title="공통비용 YOY"
                value={totalCostYOY}
                yoy={null}
                description="전년동월대비 증감률"
              />
              <KpiCard
                title="공통비용 변화액"
                value={totalCostChange}
                unit="K"
                description="전년동월대비"
              />
            </>
          )}
          </div>
        </div>

        {/* 월별 추이 차트 */}
        <div className="mb-6">
          <MonthlyStackedChart bizUnit={bizUnit} year={year} mode={mode} />
        </div>

        {/* 드릴다운 차트 */}
        <div className="mb-6">
          <CategoryDrilldown
            bizUnit={bizUnit}
            year={year}
            month={month}
            mode={mode}
          />
        </div>

        {/* 광고비 분석 표 (브랜드만) */}
        {bizUnit !== "공통" && (
          <div className="mb-6">
            <AdExpenseAnalysisTable
              bizUnit={bizUnit}
              year={year}
              month={month}
            />
          </div>
        )}
      </div>
    </div>
  );
}

