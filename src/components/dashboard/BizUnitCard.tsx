"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowDown } from "lucide-react";
import { formatPercent, formatPercentPoint } from "@/lib/utils";
import { type BizUnit, type Mode } from "@/lib/expenseData";
import React from "react";

// 사업부별 테마 설정
const THEME = {
  MLB: {
    headerGradient: "from-blue-500 to-blue-600",
    primaryColor: "text-blue-600",
    borderColor: "border-blue-500",
    buttonColor: "#3b82f6",
    accentColor: "bg-blue-500",
  },
  KIDS: {
    headerGradient: "from-yellow-500 to-yellow-600",
    primaryColor: "text-yellow-600",
    borderColor: "border-yellow-500",
    buttonColor: "#eab308",
    accentColor: "bg-yellow-500",
  },
  DISCOVERY: {
    headerGradient: "from-green-500 to-green-600",
    primaryColor: "text-green-600",
    borderColor: "border-green-500",
    buttonColor: "#10b981",
    accentColor: "bg-green-500",
  },
  COMMON: {
    headerGradient: "from-gray-700 to-gray-800",
    primaryColor: "text-gray-700",
    borderColor: "border-gray-700",
    buttonColor: "#6b7280",
    accentColor: "bg-gray-700",
  },
} as const;

export interface ExpenseDetail {
  label: string;
  amount: string;
  yoy: number | null; // YOY (%)
  change: number | null; // 매출대비 비용율 증감 (%p)
}

export interface BizUnitCardProps {
  businessUnit: BizUnit;
  icon: React.ReactNode; // LucideIcon 또는 emoji 등
  yoySales: number | null; // 판매매출 YOY (%)
  yoyExpense: number | null; // 영업비 YOY (%)
  totalExpense: string; // 총비용 (예: "19,393K")
  ratio: string | null; // 영업비율 (예: "2.2%")
  headcount: string | null; // 인원수 (예: "199명")
  salesAmount: string | null; // 판매매출 (예: "896,299K")
  perPersonLaborCost: string | null; // 인당 인건비 (예: "30.5K")
  perPersonWelfareCost: string | null; // 인당 복리후생비 (예: "8.5K")
  perPersonLaborCostYOY: string | null; // 인당 인건비 YOY (예: "105%")
  perPersonWelfareCostYOY: string | null; // 인당 복리후생비 YOY (예: "98%")
  expenseDetails: ExpenseDetail[];
  year: number;
  month: number;
  mode: Mode;
  isCommon?: boolean;
}

export function BizUnitCard({
  businessUnit,
  icon,
  yoySales,
  yoyExpense,
  totalExpense,
  ratio,
  headcount,
  salesAmount,
  perPersonLaborCost,
  perPersonWelfareCost,
  perPersonLaborCostYOY,
  perPersonWelfareCostYOY,
  expenseDetails,
  year,
  month,
  mode,
  isCommon = false,
}: BizUnitCardProps) {
  const themeKey = isCommon ? "COMMON" : (businessUnit as keyof typeof THEME);
  const theme = THEME[themeKey] || THEME.COMMON;

  return (
    <Card className="h-full flex flex-col shadow-md hover:shadow-lg transition-shadow overflow-hidden rounded-lg">
      {/* 헤더 - 그라데이션 배경 */}
      <div className={`bg-gradient-to-r ${theme.headerGradient} px-4 py-3 text-white`}>
        {/* 상단: 아이콘 + 브랜드명 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
            {typeof icon === "string" ? (
              <span className="text-lg">{icon}</span>
            ) : (
              <div className="w-5 h-5">{icon}</div>
            )}
          </div>
          <span className="text-lg font-bold">{businessUnit}</span>
        </div>

        {/* 하단: YOY 박스들 */}
        {!isCommon && (
          <div className="flex gap-2">
            {yoySales !== null && (
              <div className="bg-white/20 backdrop-blur-sm rounded-md px-2.5 py-1.5 border border-white/30 flex-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/90 mb-1">판매매출 YOY</span>
                  <div className="flex items-center gap-1">
                    {yoySales >= 100 ? (
                      <TrendingUp className="w-3 h-3 text-white" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-white" />
                    )}
                    <span className="text-sm font-bold text-white">
                      {formatPercent(yoySales, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {yoyExpense !== null && (
              <div className="bg-white/20 backdrop-blur-sm rounded-md px-2.5 py-1.5 border border-white/30 flex-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/90 mb-1">영업비 YOY</span>
                  <div className="flex items-center gap-1">
                    {yoyExpense >= 100 ? (
                      <TrendingUp className="w-3 h-3 text-white" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-white" />
                    )}
                    <span className="text-sm font-bold text-white">
                      {formatPercent(yoyExpense, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {isCommon && yoyExpense !== null && (
          <div className="bg-white/20 backdrop-blur-sm rounded-md px-2.5 py-1.5 border border-white/30">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/90 mb-1">영업비 YOY</span>
              <div className="flex items-center gap-1">
                {yoyExpense >= 100 ? (
                  <TrendingUp className="w-3 h-3 text-white" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-white" />
                )}
                <span className="text-sm font-bold text-white">
                  {formatPercent(yoyExpense)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <CardContent className="flex-1 flex flex-col p-4 bg-white">
        {/* 주요 KPI */}
        <div className="mb-4">
          {/* 총비용 - 큰 글씨로, 왼쪽에 세로선 */}
          <div className="flex items-start gap-2 mb-3">
            <div className={`w-1 h-12 ${theme.accentColor} rounded-full`}></div>
            <div>
              <div className={`text-3xl font-bold ${theme.primaryColor}`}>
                {totalExpense}
              </div>
              <div className="text-xs text-gray-500 mt-1">총 비용</div>
            </div>
          </div>

          {!isCommon && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {/* 영업비율 */}
                {ratio !== null && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <div className="text-sm font-semibold text-blue-600">{ratio}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">영업비율</div>
                  </div>
                )}

                {/* 인원수 */}
                {headcount !== null && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <div className="text-sm font-semibold text-purple-600">{headcount}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">인원수</div>
                  </div>
                )}

                {/* 판매매출 */}
                {salesAmount !== null && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <div className="text-sm font-semibold text-teal-600">{salesAmount}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">판매매출</div>
                  </div>
                )}
              </div>
              {/* 인당 인건비/복리후생비 */}
              {(perPersonLaborCost || perPersonWelfareCost) && (
                <div className="border-t border-gray-200 mt-3 pt-2">
                  <div className="flex items-center justify-center gap-4 text-sm">
                    {perPersonLaborCost && (
                      <span>
                        <span className="text-gray-500">인당기본급</span>{" "}
                        <span className="font-semibold text-orange-600">{perPersonLaborCost}</span>
                        {perPersonLaborCostYOY && (
                          <span className="text-gray-400 text-xs ml-1">({perPersonLaborCostYOY})</span>
                        )}
                      </span>
                    )}
                    {perPersonLaborCost && perPersonWelfareCost && (
                      <span className="text-gray-300">|</span>
                    )}
                    {perPersonWelfareCost && (
                      <span>
                        <span className="text-gray-500">인당복후비</span>{" "}
                        <span className="font-semibold text-pink-600">{perPersonWelfareCost}</span>
                        {perPersonWelfareCostYOY && (
                          <span className="text-gray-400 text-xs ml-1">({perPersonWelfareCostYOY})</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {/* 공통 카드에 인원수 및 인당 비용 표시 */}
          {isCommon && (
            <div className="mt-2 space-y-2">
              {headcount !== null && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 inline-block">
                  <div className="text-sm font-semibold text-purple-600">{headcount}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">인원수</div>
                </div>
              )}
              {(perPersonLaborCost || perPersonWelfareCost) && (
                <div className="border-t border-gray-200 mt-3 pt-2">
                  <div className="flex items-center justify-center gap-4 text-sm">
                    {perPersonLaborCost && (
                      <span>
                        <span className="text-gray-500">인당기본급</span>{" "}
                        <span className="font-semibold text-orange-600">{perPersonLaborCost}</span>
                        {perPersonLaborCostYOY && (
                          <span className="text-gray-400 text-xs ml-1">({perPersonLaborCostYOY})</span>
                        )}
                      </span>
                    )}
                    {perPersonLaborCost && perPersonWelfareCost && (
                      <span className="text-gray-300">|</span>
                    )}
                    {perPersonWelfareCost && (
                      <span>
                        <span className="text-gray-500">인당복후비</span>{" "}
                        <span className="font-semibold text-pink-600">{perPersonWelfareCost}</span>
                        {perPersonWelfareCostYOY && (
                          <span className="text-gray-400 text-xs ml-1">({perPersonWelfareCostYOY})</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 대분류별 요약 - 테이블 형식 */}
        <div className={`${isCommon ? 'mt-auto pt-3' : 'mt-2 pt-1'} border-t`}>
          <div className="text-xs font-semibold mb-3 text-gray-700">
            영업비 상세보기
          </div>
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 mb-2 pb-1 border-b">
            <div className="col-span-3">영업비</div>
            <div className="col-span-2 text-right">금액</div>
            <div className="col-span-3 text-right">YOY</div>
            <div className="col-span-4 text-right">매출대비%증감</div>
          </div>
          {/* 테이블 바디 */}
          <div className="space-y-2 text-xs">
            {expenseDetails.map((detail, index) => (
              <div
                key={`${detail.label}-${index}`}
                className="grid grid-cols-12 gap-2 items-center hover:bg-gray-50 py-1 rounded"
              >
                <div className="col-span-3 text-gray-700">{detail.label}</div>
                <div className="col-span-2 text-right font-medium text-gray-900">
                  {detail.amount}
                </div>
                <div className="col-span-3 text-right">
                  {detail.yoy !== null ? (
                    <span
                      className={
                        detail.yoy >= 100
                          ? "text-red-600"
                          : detail.yoy === 0
                          ? "text-gray-500"
                          : "text-blue-600"
                      }
                    >
                      {formatPercent(detail.yoy, 0)}
                    </span>
                  ) : (
                    <span className="text-gray-500">0.0%</span>
                  )}
                </div>
                <div className="col-span-4 text-right">
                  {detail.change !== null ? (
                    <span
                      className={
                        detail.change > 0
                          ? "text-red-600"
                          : detail.change < 0
                          ? "text-red-600"
                          : "text-gray-500"
                      }
                    >
                      {formatPercentPoint(detail.change)}
                    </span>
                  ) : (
                    <span className="text-gray-500">0.0%p</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 상세보기 버튼 */}
        <div className="mt-4">
          <Link href={`/${businessUnit}?year=${year}&month=${month}&mode=${mode}`}>
            <Button
              className="w-full text-xs py-2.5 rounded-lg font-medium"
              style={{
                backgroundColor: theme.buttonColor,
                color: "white",
                border: "none",
              }}
            >
              {isCommon ? "공통비용 상세보기" : "전체 대시보드 보기"} &gt;
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

