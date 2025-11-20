"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatK, formatPercent } from "@/lib/utils";
import {
  getMonthlyAggregatedByCategory,
  getCategoryDetail,
  getPreviousYearTotal,
  type BizUnit,
  type Mode,
} from "@/lib/expenseData";

interface CategoryDrilldownProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
  mode: Mode;
}

export function CategoryDrilldown({
  bizUnit,
  year,
  month,
  mode,
}: CategoryDrilldownProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const currentCategories = getMonthlyAggregatedByCategory(
    bizUnit,
    year,
    month,
    mode
  );
  const prevCategories = mode === "monthly"
    ? getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode)
    : getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode);

  const categoryMap = new Map(
    currentCategories.map((item) => [item.cost_lv1, item])
  );
  const prevCategoryMap = new Map(
    prevCategories.map((item) => [item.cost_lv1, item])
  );

  // 좌측 차트 데이터 (대분류별)
  const level1Data = Array.from(categoryMap.entries())
    .map(([category, current]) => {
      const prev = prevCategoryMap.get(category);
      const yoy =
        prev && prev.amount > 0
          ? ((current.amount - prev.amount) / prev.amount) * 100
          : null;
      return {
        category,
        current: current.amount,
        previous: prev?.amount || 0,
        yoy,
      };
    })
    .sort((a, b) => b.current - a.current);

  // 우측 차트 데이터 (중분류/소분류별)
  let level2Data: any[] = [];
  if (selectedCategory) {
    const details = getCategoryDetail(bizUnit, year, month, selectedCategory, mode);
    const prevDetails = getCategoryDetail(
      bizUnit,
      year - 1,
      month,
      selectedCategory,
      mode
    );

    const detailMap = new Map(
      details.map((item) => [`${item.cost_lv2}|${item.cost_lv3}`, item])
    );
    const prevDetailMap = new Map(
      prevDetails.map((item) => [`${item.cost_lv2}|${item.cost_lv3}`, item])
    );

    level2Data = Array.from(detailMap.entries())
      .map(([key, current]) => {
        const prev = prevDetailMap.get(key);
        const yoy =
          prev && prev.amount > 0
            ? ((current.amount - prev.amount) / prev.amount) * 100
            : null;
        const label =
          current.cost_lv3 && current.cost_lv3 !== current.cost_lv2
            ? `${current.cost_lv2} - ${current.cost_lv3}`
            : current.cost_lv2;
        return {
          label,
          current: current.amount,
          previous: prev?.amount || 0,
          yoy,
        };
      })
      .sort((a, b) => b.current - a.current);
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === "current");
      const previous = payload.find((p: any) => p.dataKey === "previous");
      const yoy = current?.payload?.yoy;

      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {current && (
            <p className="text-sm" style={{ color: current.color }}>
              당년: {formatK(current.value)}
            </p>
          )}
          {previous && (
            <p className="text-sm" style={{ color: previous.color }}>
              전년: {formatK(previous.value)}
            </p>
          )}
          {yoy !== null && yoy !== undefined && (
            <p className="text-sm mt-1 font-semibold">
              YOY: {formatPercent(yoy)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 좌측: 대분류 */}
      <Card>
        <CardHeader>
          <CardTitle>대분류별 비용</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={level1Data}
              layout="vertical"
              onClick={(data) => {
                if (data && data.activePayload) {
                  const category = data.activePayload[0].payload.category;
                  setSelectedCategory(category);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                dataKey="category"
                type="category"
                width={100}
                onClick={(data) => {
                  setSelectedCategory(data.value);
                }}
                style={{ cursor: "pointer" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="current"
                fill="#3b82f6"
                name="당년"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="previous"
                fill="#9ca3af"
                name="전년"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-muted-foreground">
            * 대분류를 클릭하면 우측에 상세 내역이 표시됩니다.
          </div>
        </CardContent>
      </Card>

      {/* 우측: 중분류/소분류 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCategory
              ? `${selectedCategory} 상세 내역`
              : "대분류를 선택하세요"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCategory && level2Data.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={level2Data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="current"
                  fill="#3b82f6"
                  name="당년"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="previous"
                  fill="#9ca3af"
                  name="전년"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              좌측에서 대분류를 선택하세요
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

