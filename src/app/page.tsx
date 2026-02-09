"use client";

import { useState, useEffect } from "react";
import { Baby, Mountain, Building2, Building, BarChart3, Calendar, ChevronDown, type LucideIcon } from "lucide-react";
import React from "react";

// 야구공 아이콘 컴포넌트 (LucideIcon 타입과 호환)
const BaseballIcon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
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
  )
) as LucideIcon;

BaseballIcon.displayName = "BaseballIcon";
import { BrandCard } from "@/components/dashboard/BrandCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAvailableYears,
  getAvailableMonths,
  getAvailableYearOptions,
  type Mode,
  type YearOption,
} from "@/lib/expenseData";

const MAIN_BRAND_CONFIG = [
  { bizUnit: "법인" as const, brandColor: "#7c3aed", brandInitial: "법", brandName: "법인", icon: Building },
  { bizUnit: "MLB" as const, brandColor: "#3b82f6", brandInitial: "M", brandName: "MLB", icon: BaseballIcon },
  { bizUnit: "KIDS" as const, brandColor: "#ef4444", brandInitial: "K", brandName: "KIDS", icon: Baby },
  { bizUnit: "DISCOVERY" as const, brandColor: "#10b981", brandInitial: "D", brandName: "DISCOVERY", icon: Mountain },
  { bizUnit: "공통" as const, brandColor: "#6b7280", brandInitial: "공", brandName: "공통", icon: Building2 },
];

export default function HomePage() {
  const availableYearOptions = getAvailableYearOptions();
  const initialYearOption = availableYearOptions.length > 0 ? availableYearOptions[0] : { year: 2025, type: 'actual' as const, display: '2025년(실적)' };
  const initialMonth = 12;
  
  const [yearOption, setYearOption] = useState<YearOption>(initialYearOption);
  const [month, setMonth] = useState<number>(initialMonth);
  const [mode, setMode] = useState<Mode>("monthly");

  const isPlanYear = yearOption.year === 2026 && yearOption.type === 'plan';
  const availableMonths = getAvailableMonths(yearOption.year, yearOption.type);

  useEffect(() => {
    // 2026년(예산)이면 12월로 고정, mode도 ytd로 고정
    if (isPlanYear) {
      if (month !== 12) setMonth(12);
      if (mode !== 'ytd') setMode('ytd');
    } else if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [yearOption, availableMonths, month, isPlanYear, mode]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-20 py-6 md:py-8">
        {/* 헤더 */}
        <div className="mb-8">
          {/* 제목 영역 */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-4 mb-4">
              {/* 그라데이션 아이콘 박스 (바 차트) */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              {/* 제목 */}
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800">F&F CHINA 비용 대시보드</h1>
            </div>
            {/* 제목 아래 구분선 */}
            <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full mx-auto" style={{ maxWidth: '600px' }}></div>
          </div>
          
          {/* 날짜 선택 및 모드 전환 영역 */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap min-w-0">
              {/* 그라데이션 아이콘 박스 (캘린더) */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              {/* 날짜 선택 + 월/연간 탭 (나란히) */}
              <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-lg shadow-sm border border-gray-200 flex-shrink-0">
                <div className="relative">
                  <select
                    value={`${yearOption.year}-${yearOption.type}`}
                    onChange={(e) => {
                      const [yearStr, type] = e.target.value.split('-');
                      const selected = availableYearOptions.find(
                        opt => opt.year === parseInt(yearStr) && opt.type === type
                      );
                      if (selected) setYearOption(selected);
                    }}
                    className="appearance-none bg-transparent border-none outline-none text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 cursor-pointer pr-6"
                  >
                    {availableYearOptions.map((opt) => (
                      <option key={`${opt.year}-${opt.type}`} value={`${opt.year}-${opt.type}`}>
                        {opt.display}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={month.toString()}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    disabled={isPlanYear}
                    className={`appearance-none bg-transparent border-none outline-none text-[10px] sm:text-xs md:text-sm font-medium pr-6 ${
                      isPlanYear 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-gray-700 cursor-pointer'
                    }`}
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                    isPlanYear ? 'text-gray-400' : 'text-gray-600'
                  }`} />
                </div>
                <Tabs 
                  value={mode} 
                  onValueChange={(v) => !isPlanYear && setMode(v as Mode)} 
                  className="flex-shrink-0"
                >
                  <TabsList>
                    <TabsTrigger 
                      value="monthly" 
                      disabled={isPlanYear}
                      className={isPlanYear ? 'cursor-not-allowed opacity-50' : ''}
                    >
                      {isPlanYear ? "월" : "당월"}
                    </TabsTrigger>
                    <TabsTrigger value="ytd">
                      {isPlanYear ? "연간" : "누적(YTD)"}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-4">
            브랜드를 클릭하면 상세 대시보드로 이동합니다.
          </p>
        </div>

        {/* 브랜드 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {MAIN_BRAND_CONFIG.map((config) => (
            <BrandCard
              key={config.bizUnit}
              bizUnit={config.bizUnit}
              year={yearOption.year}
              month={month}
              mode={mode}
              yearType={yearOption.type}
              brandColor={config.brandColor}
              brandInitial={config.brandInitial}
              brandName={config.brandName}
              icon={config.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

