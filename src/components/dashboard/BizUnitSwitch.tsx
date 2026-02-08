"use client";

import Link from "next/link";
import { type BizUnit } from "@/lib/expenseData";
import { cn } from "@/lib/utils";

const DIVISION_NAMES: Record<BizUnit, string> = {
  법인: "법인",
  MLB: "MLB",
  KIDS: "KIDS",
  DISCOVERY: "DISCOVERY",
  공통: "공통",
};

// 사업부별 브랜드 컬러 테마
const BRAND_THEMES: Record<BizUnit, { border: string; text: string }> = {
  법인: {
    border: "border-purple-600",
    text: "text-purple-600",
  },
  MLB: {
    border: "border-blue-500",
    text: "text-blue-600",
  },
  KIDS: {
    border: "border-yellow-500",
    text: "text-yellow-600",
  },
  DISCOVERY: {
    border: "border-green-500",
    text: "text-green-600",
  },
  공통: {
    border: "border-gray-700",
    text: "text-gray-700",
  },
};

interface BizUnitSwitchProps {
  currentBizUnit: BizUnit;
  year: number;
  month: number;
  mode: "monthly" | "ytd";
  yearType?: 'actual' | 'plan';
}

export function BizUnitSwitch({
  currentBizUnit,
  year,
  month,
  mode,
  yearType = 'actual',
}: BizUnitSwitchProps) {
  const allBizUnits: BizUnit[] = ["법인", "MLB", "KIDS", "DISCOVERY", "공통"];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
      {allBizUnits.map((unit) => {
        const isActive = unit === currentBizUnit;
        const theme = BRAND_THEMES[unit];

        return (
          <Link
            key={unit}
            href={`/${unit}?year=${year}&type=${yearType}&month=${month}&mode=${mode}`}
            className={cn(
              "px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap",
              isActive
                ? `bg-white border-2 ${theme.border} ${theme.text} font-semibold`
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent"
            )}
          >
            {DIVISION_NAMES[unit]}
          </Link>
        );
      })}
    </div>
  );
}

