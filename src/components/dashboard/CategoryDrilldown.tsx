"use client";

import { useState, useEffect } from "react";
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
  getAnnualData,
  getPreviousYearTotal,
  type BizUnit,
  type Mode,
  type CategoryDetail,
} from "@/lib/expenseData";
import { EXPENSE_COLOR_MAP, PREVIOUS_YEAR_COLOR, DEFAULT_COLOR } from "@/lib/expenseColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { t, getDisplayLabel } from "@/lib/translations";

interface CategoryDrilldownProps {
  bizUnit: BizUnit;
  year: number;
  month: number;
  mode: Mode;
  yearType?: 'actual' | 'plan';
}

export function CategoryDrilldown({
  bizUnit,
  year,
  month,
  mode,
  yearType = 'actual',
}: CategoryDrilldownProps) {
  const { lang } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [axisFontSize, setAxisFontSize] = useState(16);
  useEffect(() => {
    const update = () => setAxisFontSize(window.innerWidth < 640 ? 12 : window.innerWidth < 1024 ? 16 : 20);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const is2026Plan = year === 2026 && yearType === "plan";
  let currentCategories = getMonthlyAggregatedByCategory(
    bizUnit,
    year,
    month,
    mode,
    yearType
  );
  if (is2026Plan && currentCategories.length === 0) {
    const annualRows = getAnnualData(bizUnit, year, "", "", "", yearType);
    const yyyymm = `${year}12`;
    const byLv1 = new Map<string, { cost_lv1: string; cost_lv1_cn?: string; amount: number; biz_unit: string; year: number; month: number; yyyymm: string; headcount: number; sales: number }>();
    annualRows.forEach((row) => {
      const key = row.cost_lv1;
      if (byLv1.has(key)) {
        const existing = byLv1.get(key)!;
        existing.amount += row.annual_amount;
      } else {
        byLv1.set(key, {
          cost_lv1: key,
          cost_lv1_cn: row.cost_lv1_cn,
          amount: row.annual_amount,
          biz_unit: row.biz_unit,
          year,
          month: 12,
          yyyymm,
          headcount: 0,
          sales: 0,
        });
      }
    });
    currentCategories = Array.from(byLv1.values());
  }
  const prevCategories =
    mode === "monthly"
      ? getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode, "actual")
      : getMonthlyAggregatedByCategory(bizUnit, year - 1, month, mode, "actual");

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
        displayLabel: getDisplayLabel(category, current.cost_lv1_cn, lang),
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

  // 우측 차트 데이터 (중분류/소분류별)
  let level2Data: any[] = [];
  if (selectedCategory) {
    const is2026Plan = year === 2026 && yearType === "plan";
    let details: CategoryDetail[];
    let prevDetails: CategoryDetail[];
    if (is2026Plan) {
      // 2026년(예산): 상세 내역은 연간 합계 기준, 전년은 2025년 실적 1~12월 합계
      const annualCurrent = getAnnualData(bizUnit, year, selectedCategory, "", "", yearType);
      const annualPrev = getAnnualData(bizUnit, year - 1, selectedCategory, "", "", "actual");
      details = annualCurrent.map(({ annual_amount, ...rest }) => ({
        ...rest,
        month: 12,
        yyyymm: `${rest.year}12`,
        amount: annual_amount,
      }));
      prevDetails = annualPrev.map(({ annual_amount, ...rest }) => ({
        ...rest,
        month: 12,
        yyyymm: `${rest.year}12`,
        amount: annual_amount,
      }));
    } else {
      details = getCategoryDetail(bizUnit, year, month, selectedCategory, mode, yearType);
      prevDetails = getCategoryDetail(
        bizUnit,
        year - 1,
        month,
        selectedCategory,
        mode,
        yearType
      );
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
            ? `${getDisplayLabel(lv2, current.cost_lv2_cn, lang)} - ${getDisplayLabel(current.cost_lv3, current.cost_lv3_cn, lang)}`
            : getDisplayLabel(lv2, current.cost_lv2_cn, lang);
        return {
          label,
          current: current.amount,
          previous: prev?.amount || 0,
          yoy,
        };
      })
      .filter((item) => item.current > 0 || item.previous > 0) // 당년 또는 전년 금액이 있는 항목만 표시
      .sort((a, b) => b.current - a.current);
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === "current");
      const previous = payload.find((p: any) => p.dataKey === "previous");
      const yoy = current?.payload?.yoy;
      const displayTitle = level1Data.find((d) => d.category === label)?.displayLabel ?? label;

      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold mb-2">{displayTitle}</p>
          {current && (
            <p className="text-sm" style={{ color: current.color }}>
              {t("당년", lang)}: {formatK(current.value)}
            </p>
          )}
          {previous && (
            <p className="text-sm" style={{ color: previous.color }}>
              {t("전년", lang)}: {formatK(previous.value)}
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
          <CardTitle className="text-xs sm:text-sm lg:text-lg">{t("대분류별 비용", lang)}</CardTitle>
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
                tick={{ fontSize: axisFontSize }}
              />
              <YAxis
                dataKey="category"
                type="category"
                width={100}
                tick={{ fontSize: axisFontSize, textAnchor: "end" }}
                tickFormatter={(value) => level1Data.find((d) => d.category === value)?.displayLabel ?? value}
                onClick={(data) => {
                  setSelectedCategory(data.value);
                }}
                style={{ cursor: "pointer" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: axisFontSize }} iconSize={Math.min(14, axisFontSize)} />
              <Bar
                dataKey="current"
                name={t("당년", lang)}
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
                name={t("전년", lang)}
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
            {t("대분류를 클릭하면 우측에 상세 내역이 표시됩니다.", lang)}
          </div>
        </CardContent>
      </Card>

      {/* 우측: 중분류/소분류 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs sm:text-sm lg:text-lg">
            {selectedCategory
              ? `${selectedCategory} 상세 내역`
              : t("대분류를 선택하세요", lang)}
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
                    tick={{ fontSize: axisFontSize }}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={150}
                    tick={{ fontSize: axisFontSize, textAnchor: "end" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: axisFontSize }} iconSize={Math.min(14, axisFontSize)} />
                  <Bar
                    dataKey="current"
                    name={t("당년", lang)}
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
                    name={t("전년", lang)}
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
              {t("좌측에서 대분류를 선택하세요", lang)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

