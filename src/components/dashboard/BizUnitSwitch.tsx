"use client";

import Link from "next/link";
import { type BizUnit } from "@/lib/expenseData";
import { cn } from "@/lib/utils";

const DIVISION_NAMES: Record<BizUnit, string> = {
  MLB: "MLB",
  KIDS: "KIDS",
  DISCOVERY: "DISCOVERY",
  DUVETICA: "DUVETICA",
  SUPRA: "SUPRA",
  공통: "공통",
};

// 사업부별 브랜드 컬러 테마
const BRAND_THEMES: Record<BizUnit, { border: string; text: string }> = {
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
  DUVETICA: {
    border: "border-purple-500",
    text: "text-purple-600",
  },
  SUPRA: {
    border: "border-orange-500",
    text: "text-orange-600",
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
}

export function BizUnitSwitch({
  currentBizUnit,
  year,
  month,
  mode,
}: BizUnitSwitchProps) {
  const allBizUnits: BizUnit[] = ["MLB", "KIDS", "DISCOVERY", "공통"];

  return (
    <div className="flex items-center gap-2">
      {allBizUnits.map((unit) => {
        const isActive = unit === currentBizUnit;
        const theme = BRAND_THEMES[unit];

        return (
          <Link
            key={unit}
            href={`/${unit}?year=${year}&month=${month}&mode=${mode}`}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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

