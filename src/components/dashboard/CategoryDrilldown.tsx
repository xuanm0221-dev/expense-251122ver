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
  type CategoryDetail,
} from "@/lib/expenseData";
import { EXPENSE_COLOR_MAP, PREVIOUS_YEAR_COLOR, DEFAULT_COLOR } from "@/lib/expenseColors";

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

  // 카테고리 이름 정규화 함수 (EXPENSE_COLOR_MAP의 키와 매칭)
  function normalizeCategoryName(raw: string): string {
    // 공백 제거 및 정규화
    const normalized = raw.trim();
    // 이미 EXPENSE_COLOR_MAP에 있는 키면 그대로 반환
    if (EXPENSE_COLOR_MAP[normalized]) {
      return normalized;
    }
    // 별칭 매핑
    const aliasMap: Record<string, string> = {
      "광고선전비": "광고비",
    };
    return aliasMap[normalized] || normalized;
  }

  // 좌측 차트 데이터 (대분류별)
  const level1Data = Array.from(categoryMap.entries())
    .map(([category, current]) => {
      const prev = prevCategoryMap.get(category);
      const yoy =
        prev && prev.amount > 0
          ? (current.amount / prev.amount) * 100
          : null;
      // 카테고리 이름 정규화 후 색상 결정
      const normalizedCategory = normalizeCategoryName(category);
      const color = EXPENSE_COLOR_MAP[normalizedCategory] || DEFAULT_COLOR;
      return {
        category,
        current: current.amount,
        previous: prev?.amount || 0,
        yoy,
        // 당년도 막대기용 색상 속성
        fill: color, // Recharts가 인식할 수 있는 fill 속성
        currentFill: color,
        currentColor: color,
      };
    })
    .sort((a, b) => b.current - a.current);
  
  // 디버깅: level1Data 확인
  console.log("level1Data:", level1Data);
  console.log("카테고리별 색상:", level1Data.map(d => ({ category: d.category, color: d.fill })));

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

    // 디버깅: 데이터 확인
    console.log(`[CategoryDrilldown] Selected: ${selectedCategory}, Details count: ${details.length}`);
    if (details.length > 0) {
      console.log(`[CategoryDrilldown] Sample details:`, details.slice(0, 10));
      // 중분류별로 그룹화된 데이터 확인
      const lv2Counts = new Map<string, number>();
      details.forEach((item) => {
        const lv2 = (item.cost_lv2 || "").trim() || "기타";
        lv2Counts.set(lv2, (lv2Counts.get(lv2) || 0) + 1);
      });
      console.log(`[CategoryDrilldown] 중분류별 데이터 개수:`, Array.from(lv2Counts.entries()));
    } else {
      console.warn(`[CategoryDrilldown] ⚠️ 데이터가 없습니다! bizUnit=${bizUnit}, year=${year}, month=${month}, costLv1=${selectedCategory}, mode=${mode}`);
    }

    // 중분류별로 그룹화하되, 소분류가 있으면 소분류까지 표시
    // 먼저 중분류별로 그룹화
    const lv2Grouped = new Map<string, CategoryDetail[]>();
    details.forEach((item) => {
      // cost_lv2가 비어있거나 null인 경우 "기타"로 처리
      const lv2Key = (item.cost_lv2 && item.cost_lv2.trim() !== "") ? item.cost_lv2.trim() : "기타";
      if (!lv2Grouped.has(lv2Key)) {
        lv2Grouped.set(lv2Key, []);
      }
      lv2Grouped.get(lv2Key)!.push(item);
    });

    console.log(`[CategoryDrilldown] Lv2 groups:`, Array.from(lv2Grouped.keys()));

    // 각 중분류 내에서 소분류가 있는지 확인하고 데이터 구성
    const detailMap = new Map<string, CategoryDetail>();
    lv2Grouped.forEach((items, lv2Key) => {
      // 소분류가 있는 항목들 확인 (비어있지 않고, 중분류와 다른 경우)
      const itemsWithLv3 = items.filter((item) => {
        const lv3 = (item.cost_lv3 || "").trim();
        return lv3 !== "" && lv3 !== item.cost_lv2 && lv3 !== lv2Key;
      });
      
      if (itemsWithLv3.length > 0) {
        // 소분류가 있으면 소분류별로 표시
        items.forEach((item) => {
          const lv3 = (item.cost_lv3 || "").trim();
          // 소분류가 있고 중분류와 다르면 소분류별로, 아니면 중분류별로
          if (lv3 !== "" && lv3 !== item.cost_lv2 && lv3 !== lv2Key) {
            const key = `${lv2Key}|${lv3}`;
            if (detailMap.has(key)) {
              const existing = detailMap.get(key)!;
              existing.amount += item.amount;
            } else {
              detailMap.set(key, { ...item });
            }
          } else {
            // 소분류가 없거나 중분류와 같으면 중분류별로 합계
            if (detailMap.has(lv2Key)) {
              const existing = detailMap.get(lv2Key)!;
              existing.amount += item.amount;
            } else {
              detailMap.set(lv2Key, { ...item, cost_lv3: "" });
            }
          }
        });
      } else {
        // 소분류가 없으면 중분류별로 합계
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        const firstItem = items[0];
        detailMap.set(lv2Key, {
          ...firstItem,
          amount: total,
          cost_lv3: "",
        });
      }
    });

    // 전년도 데이터도 동일하게 처리
    const prevLv2Grouped = new Map<string, CategoryDetail[]>();
    prevDetails.forEach((item) => {
      const lv2Key = (item.cost_lv2 && item.cost_lv2.trim() !== "") ? item.cost_lv2.trim() : "기타";
      if (!prevLv2Grouped.has(lv2Key)) {
        prevLv2Grouped.set(lv2Key, []);
      }
      prevLv2Grouped.get(lv2Key)!.push(item);
    });

    const prevDetailMap = new Map<string, CategoryDetail>();
    prevLv2Grouped.forEach((items, lv2Key) => {
      const itemsWithLv3 = items.filter((item) => {
        const lv3 = (item.cost_lv3 || "").trim();
        return lv3 !== "" && lv3 !== item.cost_lv2 && lv3 !== lv2Key;
      });
      
      if (itemsWithLv3.length > 0) {
        items.forEach((item) => {
          const lv3 = (item.cost_lv3 || "").trim();
          if (lv3 !== "" && lv3 !== item.cost_lv2 && lv3 !== lv2Key) {
            const key = `${lv2Key}|${lv3}`;
            if (prevDetailMap.has(key)) {
              const existing = prevDetailMap.get(key)!;
              existing.amount += item.amount;
            } else {
              prevDetailMap.set(key, { ...item });
            }
          } else {
            if (prevDetailMap.has(lv2Key)) {
              const existing = prevDetailMap.get(lv2Key)!;
              existing.amount += item.amount;
            } else {
              prevDetailMap.set(lv2Key, { ...item, cost_lv3: "" });
            }
          }
        });
      } else {
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        const firstItem = items[0];
        prevDetailMap.set(lv2Key, {
          ...firstItem,
          amount: total,
          cost_lv3: "",
        });
      }
    });

    // 전년도 데이터 매핑 디버깅
    console.log(`[CategoryDrilldown] DetailMap keys (${detailMap.size}):`, Array.from(detailMap.keys()));
    console.log(`[CategoryDrilldown] PrevDetailMap keys (${prevDetailMap.size}):`, Array.from(prevDetailMap.keys()));
    
    // 키 매칭 확인
    const allKeys = new Set([...detailMap.keys(), ...prevDetailMap.keys()]);
    console.log(`[CategoryDrilldown] All unique keys:`, Array.from(allKeys));
    
    // 전년도 데이터를 cost_lv2, cost_lv3 값으로 직접 찾기 위한 매핑 생성
    const prevDataByLv = new Map<string, CategoryDetail>();
    prevDetailMap.forEach((item, key) => {
      const lv2 = (item.cost_lv2 || "").trim() || "기타";
      const lv3 = (item.cost_lv3 || "").trim();
      // 소분류가 있고 중분류와 다르면 소분류 포함 키 사용, 아니면 중분류만
      const lookupKey = lv3 !== "" && lv3 !== lv2 ? `${lv2}|${lv3}` : lv2;
      // 이미 있으면 amount 합산
      if (prevDataByLv.has(lookupKey)) {
        prevDataByLv.get(lookupKey)!.amount += item.amount;
      } else {
        prevDataByLv.set(lookupKey, { ...item });
      }
    });

    level2Data = Array.from(detailMap.entries())
      .map(([key, current]) => {
        // 키로 먼저 시도
        let prev = prevDetailMap.get(key);
        
        // 키로 찾지 못한 경우, cost_lv2/cost_lv3 값으로 직접 찾기
        if (!prev) {
          const lv2 = (current.cost_lv2 || "").trim() || "기타";
          const lv3 = (current.cost_lv3 || "").trim();
          const lookupKey = lv3 !== "" && lv3 !== lv2 ? `${lv2}|${lv3}` : lv2;
          prev = prevDataByLv.get(lookupKey);
          
          if (!prev && prevDetailMap.size > 0) {
            console.log(`[CategoryDrilldown] 전년도 데이터 없음 - key: "${key}", lookupKey: "${lookupKey}", current:`, {
              lv2: current.cost_lv2,
              lv3: current.cost_lv3,
              amount: current.amount
            });
          }
        }
        
        const yoy =
          prev && prev.amount > 0
            ? (current.amount / prev.amount) * 100
            : null;
        // 라벨: 소분류가 있으면 "중분류 - 소분류", 없으면 "중분류"
        const lv3 = (current.cost_lv3 || "").trim();
        const lv2 = (current.cost_lv2 || "").trim() || "기타";
        const label =
          lv3 !== "" && lv3 !== lv2
            ? `${lv2} - ${current.cost_lv3}`
            : lv2;
        return {
          label,
          current: current.amount,
          previous: prev?.amount || 0,
          yoy,
        };
      })
      .filter((item) => item.current > 0 || item.previous > 0) // 당년 또는 전년 금액이 있는 항목만 표시
      .sort((a, b) => b.current - a.current);

    console.log(`[CategoryDrilldown] Level2Data (${level2Data.length} items):`, level2Data);
    console.log(`[CategoryDrilldown] 전년도 데이터 포함된 항목:`, level2Data.filter(item => item.previous > 0).map(item => ({ label: item.label, previous: item.previous })));
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
              YOY: {formatPercent(yoy, 0)}
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
          <CardTitle style={{ fontSize: "28px" }}>대분류별 비용</CardTitle>
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
              <XAxis 
                type="number" 
                tickFormatter={(value) => formatK(value)}
                tick={{ fontSize: 20 }}
              />
              <YAxis
                dataKey="category"
                type="category"
                width={100}
                tick={{ fontSize: 20, textAnchor: "end" }}
                onClick={(data) => {
                  setSelectedCategory(data.value);
                }}
                style={{ cursor: "pointer" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="current"
                name="당년"
                radius={[0, 4, 4, 0]}
                shape={(props: any) => {
                  const { payload, x, y, width, height } = props;
                  if (!payload) {
                    return <rect x={x} y={y} width={width} height={height} fill={DEFAULT_COLOR} rx={4} />;
                  }
                  // 카테고리 이름 정규화 후 색상 결정
                  const normalizedCategory = normalizeCategoryName(payload.category);
                  const fill = EXPENSE_COLOR_MAP[normalizedCategory] || payload.fill || payload.currentFill || DEFAULT_COLOR;
                  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
                }}
              />
              <Bar
                dataKey="previous"
                name="전년"
                radius={[0, 4, 4, 0]}
                fill={PREVIOUS_YEAR_COLOR}
                shape={(props: any) => {
                  // 전년도는 항상 회색으로 고정
                  const { x, y, width, height } = props;
                  return <rect x={x} y={y} width={width} height={height} fill={PREVIOUS_YEAR_COLOR} rx={4} />;
                }}
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
          <CardTitle style={{ fontSize: "28px" }}>
            {selectedCategory
              ? `${selectedCategory} 상세 내역`
              : "대분류를 선택하세요"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCategory ? (
            level2Data.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={level2Data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => formatK(value)}
                    tick={{ fontSize: 20 }}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={150}
                    tick={{ fontSize: 20, textAnchor: "end" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="current"
                    name="당년"
                    radius={[0, 4, 4, 0]}
                    fill={selectedCategory ? (EXPENSE_COLOR_MAP[selectedCategory] || DEFAULT_COLOR) : DEFAULT_COLOR}
                    shape={(props: any) => {
                      const { payload, x, y, width, height } = props;
                      if (!payload) {
                        return <rect x={x} y={y} width={width} height={height} fill={DEFAULT_COLOR} rx={4} />;
                      }
                      const fill = selectedCategory 
                        ? (EXPENSE_COLOR_MAP[selectedCategory] || DEFAULT_COLOR) 
                        : DEFAULT_COLOR;
                      return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
                    }}
                  />
                  <Bar
                    dataKey="previous"
                    name="전년"
                    radius={[0, 4, 4, 0]}
                    fill={PREVIOUS_YEAR_COLOR}
                    shape={(props: any) => {
                      // 전년도는 항상 회색으로 고정
                      const { x, y, width, height } = props;
                      return <rect x={x} y={y} width={width} height={height} fill={PREVIOUS_YEAR_COLOR} rx={4} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <p>데이터가 없습니다.</p>
                <p className="text-xs mt-2">콘솔에서 디버깅 정보를 확인하세요.</p>
              </div>
            )
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

