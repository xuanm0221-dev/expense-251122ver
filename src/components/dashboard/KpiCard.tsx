import { Card, CardContent } from "@/components/ui/card";
import { formatK, formatM, formatPercent, formatPercentPoint } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  yoy?: number | null;
  yoyLabel?: string;
  changeAmount?: number | null;
  description?: string;
  previousValue?: string | number | null;
  className?: string;
  detailItems?: { label: string; value: string }[];
}

export function KpiCard({
  title,
  value,
  unit,
  yoy,
  yoyLabel = "전년동월대비",
  changeAmount,
  description,
  previousValue,
  className,
  detailItems,
}: KpiCardProps) {
  const displayValue =
    typeof value === "number" 
      ? (unit === "K" 
          ? formatK(value, title === "인당 비용" ? 1 : 0)
          : unit === "M"
          ? formatM(value, 0)
          : title.includes("비용률")
            ? formatPercent(value, 1)
            : (title === "공통비용 YOY" || title === "법인비용 YOY")
            ? formatPercent(value, 0)
            : value.toLocaleString("ko-KR")) 
      : value || "-";

  // YOY가 percentage point인지 확인 (매출대비 비용률의 경우)
  const isPercentagePoint = yoy !== null && yoy !== undefined && Math.abs(yoy) < 10 && title.includes("비용률");

  // 네이비 색상 (navy blue)
  const navyColor = "#001f3f"; // 또는 "#1e3a8a"
  
  return (
    <Card className={`${className} relative overflow-hidden`} style={{ borderColor: navyColor, borderWidth: "1px" }}>
      {/* 왼쪽 네이비 세로선 */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: navyColor }}></div>
      
      <CardContent className="p-3 pl-4 sm:p-4 sm:pl-5">
        {detailItems && detailItems.length > 0 ? (
          // 좌우 분할 레이아웃
          <div className="grid grid-cols-[1fr_auto] gap-4">
            {/* 좌측: 기본 정보 */}
            <div>
              {/* 제목 */}
              <div className="text-xs sm:text-sm font-medium mb-2 sm:mb-3" style={{ color: navyColor }}>{title}</div>
              
              {/* 주요 숫자와 YOY 버블을 나란히 배치 */}
              <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                {/* 주요 숫자 - 큰 글씨, 네이비 */}
                <div className="font-bold text-xs sm:text-sm lg:text-lg" style={{ color: navyColor }}>
                  {displayValue}
                </div>

                {/* YOY 타원형 버블 - 우측 정렬 */}
                {yoy !== null && yoy !== undefined && (
                  <div className="flex flex-col items-end pt-0.5 sm:pt-1">
                    <span
                      className={`inline-block px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold ${
                        (isPercentagePoint && yoy > 0) || (!isPercentagePoint && yoy >= 100)
                          ? "bg-red-100 text-red-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {isPercentagePoint ? formatPercentPoint(yoy) : formatPercent(yoy, 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* 전년도 값과 YOY 라벨을 나란히 배치 */}
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                {/* 전년도 값 - 주요 숫자 아래 */}
                {previousValue !== null && previousValue !== undefined && (
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    전년 {typeof previousValue === "number" 
                      ? (title.includes("비용률") 
                          ? formatPercent(previousValue, 1)
                          : unit === "K" 
                            ? formatK(previousValue, title === "인당 비용" ? 1 : 0)
                            : unit === "M"
                            ? formatM(previousValue, 0)
                            : previousValue.toLocaleString("ko-KR"))
                      : previousValue}
                  </div>
                )}

                {/* YOY 라벨 - 우측 정렬 */}
                {yoy !== null && yoy !== undefined && (
                  <div className="text-[10px] sm:text-xs text-gray-500 pt-0.5 sm:pt-1 text-right">
                    {yoyLabel}
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 상세 항목 */}
            <div className="flex flex-col justify-center space-y-0.5">
              {detailItems.map((item, idx) => (
                <div key={idx} className="flex justify-between gap-3 text-[10px] sm:text-xs text-gray-600">
                  <span>{item.label}</span>
                  <span className="font-medium whitespace-nowrap">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // 기존 수직 레이아웃
          <>
            {/* 제목 */}
            <div className="text-xs sm:text-sm font-medium mb-2 sm:mb-3" style={{ color: navyColor }}>{title}</div>
            
            {/* 주요 숫자와 YOY 버블을 나란히 배치 */}
            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2">
              {/* 주요 숫자 - 큰 글씨, 네이비 */}
              <div className="font-bold text-xs sm:text-sm lg:text-lg" style={{ color: navyColor }}>
                {displayValue}
              </div>

              {/* YOY 타원형 버블 - 우측 정렬 */}
              {yoy !== null && yoy !== undefined && (
                <div className="flex flex-col items-end pt-0.5 sm:pt-1">
                  <span
                    className={`inline-block px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold ${
                      (isPercentagePoint && yoy > 0) || (!isPercentagePoint && yoy >= 100)
                        ? "bg-red-100 text-red-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {isPercentagePoint ? formatPercentPoint(yoy) : formatPercent(yoy, 0)}
                  </span>
                </div>
              )}
            </div>

            {/* 전년도 값과 YOY 라벨을 나란히 배치 */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              {/* 전년도 값 - 주요 숫자 아래 */}
              {previousValue !== null && previousValue !== undefined && (
                <div className="text-[10px] sm:text-xs text-gray-500">
                  전년 {typeof previousValue === "number" 
                    ? (title.includes("비용률") 
                        ? formatPercent(previousValue, 1)
                        : unit === "K" 
                          ? formatK(previousValue, title === "인당 비용" ? 1 : 0)
                          : unit === "M"
                          ? formatM(previousValue, 0)
                          : previousValue.toLocaleString("ko-KR"))
                    : previousValue}
                </div>
              )}

              {/* YOY 라벨 - 우측 정렬 */}
              {yoy !== null && yoy !== undefined && (
                <div className="text-[10px] sm:text-xs text-gray-500 pt-0.5 sm:pt-1 text-right">
                  {yoyLabel}
                </div>
              )}
            </div>

            {/* 설명 텍스트 */}
            {description && (
              <div className="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">{description}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

