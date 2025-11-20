import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatK, formatPercent, formatPercentPoint } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  yoy?: number | null;
  yoyLabel?: string;
  changeAmount?: number | null;
  description?: string;
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
  className,
}: KpiCardProps) {
  const displayValue =
    typeof value === "number" ? (unit === "K" ? formatK(value) : value.toLocaleString("ko-KR")) : value || "-";

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        {yoy !== null && yoy !== undefined && (
          <div className="mt-2 text-sm">
            <span className={yoy >= 0 ? "text-red-600" : "text-blue-600"}>
              {yoy >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(yoy))}
            </span>
            <span className="text-muted-foreground ml-1">
              ({yoyLabel})
            </span>
          </div>
        )}
        {changeAmount !== null && changeAmount !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">
            {changeAmount >= 0 ? "+" : ""}
            {formatK(changeAmount)} 변화
          </div>
        )}
        {description && (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        )}
      </CardContent>
    </Card>
  );
}

