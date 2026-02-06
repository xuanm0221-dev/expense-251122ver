import { Card, CardContent } from "@/components/ui/card";
import { formatK, formatPercent, formatPercentPoint } from "@/lib/utils";

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
}: KpiCardProps) {
  const displayValue =
    typeof value === "number" 
      ? (unit === "K" 
          ? formatK(value, title === "인당 비용" ? 1 : 0) 
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
      
      <CardContent className="p-4 pl-5">
        {/* 제목 */}
        <div className="text-sm font-medium mb-3" style={{ color: navyColor }}>{title}</div>
        
        {/* 주요 숫자와 YOY 버블을 나란히 배치 */}
        <div className="flex items-start justify-between gap-3 mb-2">
          {/* 주요 숫자 - 큰 글씨, 네이비 */}
          <div className="font-bold" style={{ color: navyColor, fontSize: "30px" }}>
            {displayValue}
          </div>

          {/* YOY 타원형 버블 - 우측 정렬 */}
          {yoy !== null && yoy !== undefined && (
            <div className="flex flex-col items-end pt-1">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
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
        <div className="flex items-start justify-between gap-3">
          {/* 전년도 값 - 주요 숫자 아래 */}
          {previousValue !== null && previousValue !== undefined && (
            <div className="text-xs text-gray-500">
              전년 {typeof previousValue === "number" 
                ? (title.includes("비용률") 
                    ? formatPercent(previousValue, 1)
                    : unit === "K" 
                      ? formatK(previousValue, title === "인당 비용" ? 1 : 0) 
                      : previousValue.toLocaleString("ko-KR"))
                : previousValue}
            </div>
          )}

          {/* YOY 라벨 - 우측 정렬 */}
          {yoy !== null && yoy !== undefined && (
            <div className="text-xs text-gray-500 pt-1 text-right">
              {yoyLabel}
            </div>
          )}
        </div>

        {/* 설명 텍스트 */}
        {description && (
          <div className="text-xs text-gray-500 mt-2">{description}</div>
        )}
      </CardContent>
    </Card>
  );
}

