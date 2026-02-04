"use client";

import { useState, useEffect } from "react";
import { Baby, Mountain, Building2, Building, BarChart3, Calendar, ChevronDown, Download, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  type Mode,
} from "@/lib/expenseData";

const BRAND_CONFIG = [
  {
    bizUnit: "법인" as const,
    brandColor: "#7c3aed",
    brandInitial: "법",
    brandName: "법인",
    icon: Building,
  },
  {
    bizUnit: "MLB" as const,
    brandColor: "#3b82f6",
    brandInitial: "M",
    brandName: "MLB",
    icon: BaseballIcon,
  },
  {
    bizUnit: "KIDS" as const,
    brandColor: "#ef4444",
    brandInitial: "K",
    brandName: "KIDS",
    icon: Baby,
  },
  {
    bizUnit: "DISCOVERY" as const,
    brandColor: "#10b981",
    brandInitial: "D",
    brandName: "DISCOVERY",
    icon: Mountain,
  },
  {
    bizUnit: "공통" as const,
    brandColor: "#6b7280",
    brandInitial: "공",
    brandName: "공통",
    icon: Building2,
  },
];

export default function HomePage() {
  const availableYears = getAvailableYears();
  const initialYear = availableYears.length > 0 ? availableYears[0] : 2025;
  const initialMonth = 12;
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  const [mode, setMode] = useState<Mode>(
    initialYear === 2026 && initialMonth === 12 ? "ytd" : "monthly"
  );

  const availableMonths = getAvailableMonths(year);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [year, availableMonths, month]);

  // CSV 다운로드 함수
  const handleCsvDownload = async () => {
    try {
      const response = await fetch("/api/export/kpi");
      
      if (!response.ok) {
        const errorData = await response.json();
        alert(`다운로드 실패: ${errorData.error || "알 수 없는 오류"}`);
        return;
      }
      
      // Blob으로 변환
      const blob = await response.blob();
      
      // 다운로드 링크 생성
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kpi_for_claude_detailed.csv";
      document.body.appendChild(a);
      a.click();
      
      // 정리
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("CSV download error:", error);
      alert("CSV 다운로드 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-20 py-8">
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
              <h1 className="text-5xl font-bold text-slate-800">F&F CHINA 비용 대시보드</h1>
            </div>
            {/* 제목 아래 구분선 */}
            <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full mx-auto" style={{ maxWidth: '600px' }}></div>
          </div>
          
          {/* 날짜 선택 및 모드 전환 영역 */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 flex-nowrap min-w-0">
              {/* 그라데이션 아이콘 박스 (캘린더) */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              {/* 날짜 선택 버튼 */}
              <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg shadow-sm border border-gray-200 flex-shrink-0">
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
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex-shrink-0">
                <TabsList>
                  <TabsTrigger value="monthly">당월</TabsTrigger>
                  <TabsTrigger value="ytd">누적(YTD)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {/* CSV 다운로드 버튼 - 우측 정렬 */}
            <Button
              onClick={handleCsvDownload}
              variant="outline"
              className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              CSV 다운로드
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            브랜드를 클릭하면 상세 대시보드로 이동합니다.
          </p>
        </div>

        {/* 브랜드 카드 그리드 - 5개 나란히 배치 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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
              icon={config.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

