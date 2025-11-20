"use client";

import { useState, useEffect } from "react";
import { BrandCard } from "@/components/dashboard/BrandCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import {
  getAvailableYears,
  getAvailableMonths,
  type Mode,
} from "@/lib/expenseData";

const BRAND_CONFIG = [
  {
    bizUnit: "MLB" as const,
    brandColor: "#3b82f6",
    brandInitial: "M",
    brandName: "MLB",
  },
  {
    bizUnit: "KIDS" as const,
    brandColor: "#ef4444",
    brandInitial: "K",
    brandName: "KIDS",
  },
  {
    bizUnit: "DISCOVERY" as const,
    brandColor: "#10b981",
    brandInitial: "D",
    brandName: "DISCOVERY",
  },
  {
    bizUnit: "공통" as const,
    brandColor: "#6b7280",
    brandInitial: "공",
    brandName: "공통",
  },
];

export default function HomePage() {
  const availableYears = getAvailableYears();
  const [year, setYear] = useState<number>(
    availableYears.length > 0 ? availableYears[0] : 2025
  );
  const [month, setMonth] = useState<number>(10);
  const [mode, setMode] = useState<Mode>("monthly");

  const availableMonths = getAvailableMonths(year);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [year, availableMonths, month]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">비용 분석 대시보드</h1>
          <div className="flex flex-wrap items-center gap-4 mb-4">
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
          <p className="text-sm text-muted-foreground">
            분석할 사업부 카드를 클릭하면 상세 대시보드로 이동합니다.
          </p>
        </div>

        {/* 브랜드 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BRAND_CONFIG.map((config) => (
            <BrandCard
              key={config.bizUnit}
              bizUnit={config.bizUnit}
              year={year}
              month={month}
              mode={mode}
              brandColor={config.brandColor}
              brandInitial={config.brandInitial}
              brandName={config.brandName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

