"use client";

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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatK, formatPercent } from "@/lib/utils";
import {
  getMonthlyStackedData,
  type BizUnit,
  type Mode,
} from "@/lib/expenseData";

interface MonthlyStackedChartProps {
  bizUnit: BizUnit;
  year: number;
  mode: Mode;
}

const CATEGORY_COLORS: Record<string, string> = {
  인건비: "#3b82f6",
  광고선전비: "#ef4444",
  복리후생비: "#f59e0b",
  출장비: "#10b981",
  감가상각비: "#8b5cf6",
  수수료: "#ec4899",
  기타: "#6b7280",
};

export function MonthlyStackedChart({
  bizUnit,
  year,
  mode,
}: MonthlyStackedChartProps) {
  const data = getMonthlyStackedData(bizUnit, year, mode);

  // 모든 대분류 수집
  const allCategories = new Set<string>();
  data.forEach((item) => {
    Object.keys(item.categories).forEach((cat) => allCategories.add(cat));
  });

  const categories = Array.from(allCategories).sort();

  // 차트 데이터 포맷팅
  const chartData = data.map((item) => {
    const result: any = {
      month: `${item.month}월`,
      yoy: item.yoy,
    };
    categories.forEach((cat) => {
      result[cat] = item.categories[cat] || 0;
    });
    return result;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {payload
            .filter((p: any) => p.dataKey !== "yoy")
            .map((p: any) => (
              <p key={p.dataKey} className="text-sm" style={{ color: p.color }}>
                {p.name}: {formatK(p.value)}
              </p>
            ))}
          {payload.find((p: any) => p.dataKey === "yoy") && (
            <p className="text-sm mt-2 font-semibold">
              YOY:{" "}
              {formatPercent(
                payload.find((p: any) => p.dataKey === "yoy")?.value
              )}
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
        <CardTitle>월별 비용 추이 및 YOY 비교</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis
              yAxisId="left"
              label={{ value: "비용 (K)", angle: -90, position: "insideLeft" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{ value: "YOY (%)", angle: 90, position: "insideRight" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {categories.map((cat) => (
              <Bar
                key={cat}
                yAxisId="left"
                dataKey={cat}
                stackId="a"
                fill={CATEGORY_COLORS[cat] || "#6b7280"}
                name={cat}
              />
            ))}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="yoy"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 4 }}
              name="YOY (%)"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

