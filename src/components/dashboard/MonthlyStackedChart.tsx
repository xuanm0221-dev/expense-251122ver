"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatK, formatPercent } from "@/lib/utils";
import {
  getMonthlyStackedData,
  type BizUnit,
  type Mode,
} from "@/lib/expenseData";
import { EXPENSE_COLOR_MAP } from "@/lib/expenseColors";

interface MonthlyStackedChartProps {
  bizUnit: BizUnit;
  year: number;
  mode: Mode;
  yearType?: 'actual' | 'plan';
}

export function MonthlyStackedChart({
  bizUnit,
  year,
  mode,
  yearType = 'actual',
}: MonthlyStackedChartProps) {
  const [axisFontSize, setAxisFontSize] = useState(16);
  useEffect(() => {
    const update = () => setAxisFontSize(window.innerWidth < 640 ? 12 : window.innerWidth < 1024 ? 16 : 20);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const data = getMonthlyStackedData(bizUnit, year, mode, yearType);

  // 모든 대분류 수집
  const allCategories = new Set<string>();
  data.forEach((item) => {
    Object.keys(item.categories).forEach((cat) => allCategories.add(cat));
  });

  // 범례 순서 정의 (사업부별로 다름)
  const isCommon = bizUnit === "공통";
  const isCorporate = bizUnit === "법인";
  
  let categoryOrder: string[];
  if (isCommon) {
    categoryOrder = ["임차료", "IT수수료", "세금과공과", "복리후생비", "지급수수료", "차량렌트비", "기타"];
  } else if (isCorporate) {
    // 법인: 브랜드 + 공통 카테고리 포함
    categoryOrder = ["광고비", "인건비", "복리후생비", "임차료", "IT수수료", "지급수수료", "출장비", "감가상각비"];
  } else {
    // 개별 브랜드
    categoryOrder = ["광고비", "인건비", "복리후생비", "수주회", "지급수수료", "출장비", "감가상각비"];
  }
  
  // 지정된 순서대로 정렬하고, 없는 카테고리는 뒤에 추가
  const categories = [
    ...categoryOrder.filter((cat) => allCategories.has(cat)),
    ...Array.from(allCategories).filter((cat) => !categoryOrder.includes(cat)).sort(),
  ];

  // 차트 데이터 포맷팅
  const chartData = data.map((item) => {
    const result: any = {
      month: `${item.month}월`,
      yoy: item.yoy,
      current: item.current,
      previous: item.previous,
    };
    categories.forEach((cat) => {
      result[cat] = item.categories[cat] || 0;
    });
    return result;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // chartData에서 직접 YOY 값 찾기 (payload에 Line 데이터가 포함되지 않을 수 있음)
      const monthData = chartData.find((d: any) => d.month === label);
      const yoyValue = monthData?.yoy;
      
      // 카테고리별 데이터 필터링 (yoy, current, previous 제외)
      const categoryPayloads = payload.filter(
        (p: any) => p.dataKey !== "yoy" && p.dataKey !== "current" && p.dataKey !== "previous"
      );
      
      // 합계 계산
      const total = categoryPayloads.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {categoryPayloads.map((p: any) => (
            <p key={p.dataKey} className="text-sm" style={{ color: p.color }}>
              {p.name}: {formatK(p.value)}
            </p>
          ))}
          {/* 합계 추가 */}
          <p className="text-sm mt-2 pt-2 border-t border-gray-200 font-semibold">
            합계: {formatK(total)}
          </p>
          {yoyValue !== null && yoyValue !== undefined && (
            <p className="text-sm mt-2 font-semibold">
              YOY: {formatPercent(yoyValue, 0)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold text-xs sm:text-sm lg:text-lg">월별 비용 추이 및 YOY 비교</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          카테고리별 비용 구성 및 전년 대비 증감률
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart 
            data={chartData}
            margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: "#6b7280", fontSize: axisFontSize }}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#6b7280", fontSize: axisFontSize }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(value) => formatK(value)}
              width={80}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#6b7280", fontSize: axisFontSize }}
              axisLine={{ stroke: "#e5e7eb" }}
              domain={[0, 'dataMax + 10']}
              tickFormatter={(value) => `${Math.round(value)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              iconType="circle"
              iconSize={Math.min(14, axisFontSize)}
              wrapperStyle={{ paddingTop: "20px", fontSize: axisFontSize }}
            />
            {categories.map((cat) => (
              <Bar
                key={cat}
                yAxisId="left"
                dataKey={cat}
                stackId="a"
                fill={EXPENSE_COLOR_MAP[cat] || "#6b7280"}
                name={cat}
              />
            ))}
            {/* 100% 기준선 */}
            <ReferenceLine
              yAxisId="right"
              y={100}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="5 5"
              label=""
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="yoy"
              stroke="#000000"
              strokeWidth={3}
              dot={{ fill: "#000000", r: 4 }}
              name="YOY (%)"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {bizUnit === "MLB" && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            전년 3월 성과급 조정 영향으로 영업비용이 일시적으로 마이너스 발생하여, YoY 비교가 불가함에 따라 추세선이 단절
          </p>
        )}
      </CardContent>
    </Card>
  );
}

