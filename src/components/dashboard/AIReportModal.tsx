"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Loader2, Download, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface KpiItem {
  label: string;
  monthlyCurrent: string;
  monthlyYoy: string;
  ytdCurrent: string;
  ytdYoy: string;
  direction: string;
}

interface CostRow {
  type: string;
  items: string;
  amount: string;
  ratio: string;
  yoy: string;
}

interface ParsedReport {
  meta: { year: string; yearType: string; title: string } | null;
  bullets: string[];
  kpi: KpiItem[];
  brandTable: string;
  riskTable: string;
  yoyTable: string;
  costRows: CostRow[];
  costInsight: string;
  keyInsight: string;
  detailed: string;
}

// ─────────────────────────────────────────────
// Parsing utilities
// ─────────────────────────────────────────────
function getSection(text: string, name: string): string {
  const marker = `===${name}===`;
  const start = text.indexOf(marker);
  if (start === -1) return "";
  const contentStart = start + marker.length;
  const rest = text.slice(contentStart);
  const nextIdx = rest.indexOf("\n===");
  return nextIdx === -1 ? rest.trim() : rest.slice(0, nextIdx).trim();
}

function parseMeta(s: string) {
  const p = s.split("|");
  if (p.length < 3) return null;
  return { year: p[0].trim(), yearType: p[1].trim(), title: p[2].trim() };
}

function parseBullets(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.replace(/^[•▸\-*]\s*/, "").trim())
    .filter(Boolean);
}

function parseKpi(s: string): KpiItem[] {
  return s
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const p = line.split("|").map((x) => x.trim());
      return {
        label: p[0] || "",
        monthlyCurrent: p[1] || "-",
        monthlyYoy: p[2] || "-",
        ytdCurrent: p[3] || "-",
        ytdYoy: p[4] || "-",
        direction: p[5] || "",
      };
    });
}

function parseCostRows(s: string): CostRow[] {
  return s
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const p = line.split("|").map((x) => x.trim());
      return {
        type: p[0] || "",
        items: p[1] || "",
        amount: p[2] || "-",
        ratio: p[3] || "-",
        yoy: p[4] || "-",
      };
    });
}

function parseReport(text: string): ParsedReport {
  return {
    meta: parseMeta(getSection(text, "META")),
    bullets: parseBullets(getSection(text, "BULLETS")),
    kpi: parseKpi(getSection(text, "KPI")),
    brandTable: getSection(text, "BRAND_TABLE"),
    riskTable: getSection(text, "RISK_TABLE"),
    yoyTable: getSection(text, "YOY_TABLE"),
    costRows: parseCostRows(getSection(text, "COST_STRUCTURE")),
    costInsight: getSection(text, "COST_INSIGHT"),
    keyInsight: getSection(text, "KEY_INSIGHT"),
    detailed: getSection(text, "DETAILED"),
  };
}

// ─────────────────────────────────────────────
// Markdown table renderer (compact, styled)
// ─────────────────────────────────────────────
const mdTableComponents = {
  table: ({ ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <table className="w-full border-collapse text-xs leading-tight" {...props} />
  ),
  thead: ({ ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-gray-100" {...props} />
  ),
  th: ({ ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap"
      {...props}
    />
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
    const text = String(children ?? "");
    let cls = "border border-gray-200 px-2 py-1 text-xs";
    if (/개선/.test(text)) cls += " text-green-700 font-semibold";
    else if (/악화|경고/.test(text)) cls += " text-red-700 font-semibold";
    else if (/주의/.test(text)) cls += " text-yellow-700 font-semibold";
    if (/🔴/.test(text)) cls += " text-red-700";
    if (/🟡/.test(text)) cls += " text-yellow-700";
    if (/🟢/.test(text)) cls += " text-green-700";
    return (
      <td className={cls} {...props}>
        {children}
      </td>
    );
  },
  tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => {
    const cells = React.Children.toArray(children);
    const firstCell = cells[0];
    const isGroupHeader =
      React.isValidElement(firstCell) &&
      React.Children.toArray(
        (firstCell as React.ReactElement<{ children?: React.ReactNode }>).props.children
      ).some(
        (c) =>
          React.isValidElement(c) &&
          (c.type === "strong" ||
            (c as React.ReactElement).type?.toString?.() === "strong")
      );
    return (
      <tr
        className={isGroupHeader ? "bg-slate-200 font-semibold text-slate-700" : "hover:bg-gray-50"}
        {...props}
      >
        {children}
      </tr>
    );
  },
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-xs text-gray-600 leading-relaxed my-1" {...props}>
      {children}
    </p>
  ),
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function ExecSummaryHeader({
  meta,
  bullets,
}: {
  meta: ParsedReport["meta"];
  bullets: string[];
}) {
  return (
    <div className="mb-3 rounded-xl overflow-hidden border border-purple-200 shadow-sm">
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-indigo-600 px-4 py-2.5">
        <span className="text-white font-bold text-xs tracking-widest">
          EXECUTIVE SUMMARY
        </span>
        <span className="text-purple-200 text-xs">
          {meta?.title ?? "중국법인 연간 예산 구조 진단 요약"}
        </span>
      </div>
      <div className="bg-purple-50 px-4 py-2.5 space-y-1.5">
        {bullets.length > 0 ? (
          bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-snug">
              <span className="text-purple-500 font-bold flex-shrink-0 mt-px">▸</span>
              <span>{b}</span>
            </div>
          ))
        ) : (
          <div className="text-[10px] text-gray-400 animate-pulse py-1">분석 중...</div>
        )}
      </div>
    </div>
  );
}

const KPI_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  판매매출: { border: "border-blue-200", bg: "bg-blue-50", label: "text-blue-600" },
  총비용: { border: "border-orange-200", bg: "bg-orange-50", label: "text-orange-600" },
  비용률: { border: "border-emerald-200", bg: "bg-emerald-50", label: "text-emerald-600" },
  인원: { border: "border-violet-200", bg: "bg-violet-50", label: "text-violet-600" },
};

function YoyBadge({ value, isBad, isGood }: { value: string; isBad: boolean; isGood: boolean }) {
  if (!value || value === "-") return null;
  return (
    <span
      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
        isBad ? "bg-red-100 text-red-700" : isGood ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {value}
    </span>
  );
}

function KpiCards({ kpi }: { kpi: KpiItem[] }) {
  if (kpi.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-2.5 mb-3">
      {kpi.map((item) => {
        const s = KPI_STYLES[item.label] ?? {
          border: "border-gray-200",
          bg: "bg-gray-50",
          label: "text-gray-500",
        };
        const isGood =
          item.direction === "개선" ||
          (item.label === "판매매출" && item.ytdYoy && parseFloat(item.ytdYoy) > 100);
        const isBad = item.direction === "악화";
        const isInwon = item.label === "인원";
        const isBiyongYul = item.label === "비용률";

        return (
          <div
            key={item.label}
            className={`border ${s.border} ${s.bg} rounded-xl p-3 flex flex-col gap-1.5 shadow-sm`}
          >
            {/* 카드 라벨 */}
            <div className={`text-xs font-semibold ${s.label}`}>{item.label}</div>

            {isInwon ? (
              /* 인원 카드 */
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gray-800">{item.monthlyCurrent}</span>
                  <span className={`text-xs font-medium ${item.monthlyYoy?.startsWith("+") ? "text-green-600" : item.monthlyYoy?.startsWith("-") ? "text-red-600" : "text-gray-500"}`}>
                    {item.monthlyYoy}
                  </span>
                  <span className="text-xs text-gray-400">전년비</span>
                </div>
                <div className="border-t border-gray-200 pt-1 mt-0.5">
                  <div className="text-[11px] text-gray-500 mb-0.5">인당매출 (YTD)</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-800">{item.ytdCurrent}</span>
                    <YoyBadge value={item.ytdYoy} isBad={isBad} isGood={isGood} />
                  </div>
                </div>
              </>
            ) : isBiyongYul ? (
              /* 비용률 카드 */
              <>
                <div>
                  <div className="text-[11px] text-gray-500">당월</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-800">{item.monthlyCurrent}</span>
                    <span className="text-xs text-gray-500">{item.monthlyYoy}</span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-1 mt-0.5">
                  <div className="text-[11px] text-gray-500">YTD 누적</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-800">{item.ytdCurrent}</span>
                    <span className="text-xs text-gray-500">{item.ytdYoy}</span>
                    {item.direction && (
                      <span className={`text-xs font-medium ${isGood ? "text-green-600" : isBad ? "text-red-600" : "text-gray-500"}`}>
                        {item.direction}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* 판매매출 / 총비용 카드 */
              <>
                <div>
                  <div className="text-[11px] text-gray-500">당월</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-800">{item.monthlyCurrent}</span>
                    <YoyBadge value={item.monthlyYoy} isBad={isBad} isGood={isGood} />
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-1 mt-0.5">
                  <div className="text-[11px] text-gray-500">YTD 누적</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-800">{item.ytdCurrent}</span>
                    <YoyBadge value={item.ytdYoy} isBad={isBad} isGood={isGood} />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableBox({
  title,
  markdown,
  className = "",
}: {
  title: string;
  markdown: string;
  className?: string;
}) {
  return (
    <div className={`border border-gray-200 rounded-xl bg-white shadow-sm ${className}`}>
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <span className="text-[10px] font-bold text-gray-600 tracking-wide uppercase">
          {title}
        </span>
      </div>
      <div className="p-2 overflow-x-auto">
        {markdown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdTableComponents as never}>
            {markdown}
          </ReactMarkdown>
        ) : (
          <div className="text-[10px] text-gray-400 animate-pulse py-2 text-center">
            생성 중...
          </div>
        )}
      </div>
    </div>
  );
}

const COST_TYPE_COLORS: Record<string, string> = {
  고정비: "bg-blue-100 text-blue-800 font-bold",
  준고정비: "bg-amber-100 text-amber-800 font-bold",
  변동비: "bg-emerald-100 text-emerald-800 font-bold",
};

function CostStructureSection({
  rows,
  insight,
}: {
  rows: CostRow[];
  insight: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm mb-3">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <span className="text-[10px] font-bold text-gray-600 tracking-wide uppercase">
          비용 구조 (고정 / 준고정 / 변동 비중)
        </span>
      </div>
      <div className="p-2 overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-100">
              {["분류", "포함 항목", "금액", "구성비", "YOY"].map((h) => (
                <th
                  key={h}
                  className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td
                  className={`border border-gray-200 px-2 py-1 ${
                    COST_TYPE_COLORS[r.type] ?? ""
                  }`}
                >
                  {r.type}
                </td>
                <td className="border border-gray-200 px-2 py-1 text-gray-600">
                  {r.items}
                </td>
                <td className="border border-gray-200 px-2 py-1 text-right font-mono font-medium text-gray-800">
                  {r.amount}
                </td>
                <td className="border border-gray-200 px-2 py-1 text-right text-gray-700">
                  {r.ratio}
                </td>
                <td className="border border-gray-200 px-2 py-1 text-right text-gray-700">
                  {r.yoy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {insight && (
          <div className="mt-2 text-[10px] text-purple-800 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-lg font-medium leading-snug">
            {insight}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyInsightBar({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 bg-gradient-to-r from-purple-700 to-indigo-500 text-white px-4 py-3 rounded-xl mb-3 shadow-sm">
      <span className="font-bold text-[11px] whitespace-nowrap pt-0.5 shrink-0">
        Key Insight
      </span>
      <div className="border-l border-purple-300 pl-3 text-[11px] leading-relaxed opacity-95">
        {text}
      </div>
    </div>
  );
}

// h2(##) 기준으로 섹션 분리 → 카드 박스로 렌더링
function DetailedSections({ markdown }: { markdown: string }) {
  if (!markdown) return null;

  // "## " 로 시작하는 h2 헤더 기준으로 분리
  const parts = markdown.split(/(?=^## )/m).filter(Boolean);

  const detailMdComponents = {
    ...mdTableComponents,
    // tbody tr: 첫 번째 셀에 <strong>(bold)이 포함된 행은 대분류 → 배경색 강조
    tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => {
      const cells = React.Children.toArray(children);
      const firstCell = cells[0];
      const isHeader =
        React.isValidElement(firstCell) &&
        React.Children.toArray((firstCell as React.ReactElement<{ children?: React.ReactNode }>).props.children).some(
          (c) => React.isValidElement(c) && (c.type === "strong" || (c as React.ReactElement).type?.toString?.() === "strong")
        );
      return (
        <tr
          className={isHeader ? "bg-blue-50 font-semibold" : "hover:bg-gray-50"}
          {...props}
        >
          {children}
        </tr>
      );
    },
    td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
      const text = String(children ?? "");
      // 전각공백(　) 접두사가 있으면 들여쓰기 적용
      const isIndented = text.startsWith("　");
      let cls = "border border-gray-200 px-2 py-1 text-xs";
      if (isIndented) cls += " pl-5";
      if (/개선/.test(text)) cls += " text-green-700 font-semibold";
      else if (/악화|경고/.test(text)) cls += " text-red-700 font-semibold";
      else if (/주의/.test(text)) cls += " text-yellow-700 font-semibold";
      if (/🔴/.test(text)) cls += " text-red-700";
      if (/🟡/.test(text)) cls += " text-yellow-700";
      if (/🟢/.test(text)) cls += " text-green-700";
      return (
        <td className={cls} {...props}>
          {children}
        </td>
      );
    },
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2
        className="text-xs font-bold text-gray-800 flex items-center gap-1"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3
        className="text-[11px] font-semibold text-gray-700 mt-3 mb-1 border-b border-gray-100 pb-0.5"
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className="text-xs text-gray-600 leading-relaxed my-1" {...props}>
        {children}
      </p>
    ),
    li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
      <li className="text-xs text-gray-600 my-0.5 ml-3 list-disc" {...props}>
        {children}
      </li>
    ),
    strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <strong className="font-bold text-gray-800" {...props}>
        {children}
      </strong>
    ),
    hr: () => <hr className="border-gray-200 my-2" />,
    blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
      <blockquote
        className="border-l-2 border-purple-300 pl-3 text-xs text-purple-800 bg-purple-50 py-1 my-1 rounded-r"
        {...props}
      >
        {children}
      </blockquote>
    ),
  };

  return (
    <div className="border-t border-gray-200 pt-3 mt-1 space-y-2.5">
      {parts.map((section, i) => {
        const lines = section.trimStart().split("\n");
        const titleLine = lines[0] ?? "";
        const body = lines.slice(1).join("\n").trim();
        // 이모지 + 제목 추출
        const titleText = titleLine.replace(/^##\s*/, "");

        return (
          <div
            key={i}
            className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden"
          >
            {/* 섹션 헤더 */}
            <div className="px-4 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">{titleText}</span>
            </div>
            {/* 섹션 본문 */}
            <div className="p-3 overflow-x-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={detailMdComponents as never}
              >
                {body}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────
interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  mode: "monthly" | "ytd";
  yearType: "actual" | "plan";
}

export function AIReportModal({
  isOpen,
  onClose,
  year,
  month,
  mode,
  yearType,
}: AIReportModalProps) {
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 조건별 캐시: key = "year-month-mode-yearType"
  const cacheRef = useRef<Record<string, string>>({});

  const report = useMemo(() => parseReport(rawText), [rawText]);

  const cacheKey = `${year}-${month}-${mode}-${yearType}`;

  const generate = useCallback(async (forceRefresh = false) => {
    // 캐시 히트 시 즉시 반환 (조건이 같고 강제 재생성 아닌 경우)
    if (!forceRefresh && cacheRef.current[cacheKey]) {
      setRawText(cacheRef.current[cacheKey]);
      setIsGenerated(true);
      setIsLoading(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      return;
    }

    setIsLoading(true);
    setRawText("");
    setError(null);
    setIsGenerated(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, mode, yearType, forceRefresh }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setRawText(acc);
      }
      // 완료 후 캐시 저장
      cacheRef.current[cacheKey] = acc;
      setIsGenerated(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "보고서 생성 오류");
    } finally {
      setIsLoading(false);
    }
  }, [year, month, mode, yearType, cacheKey]);

  useEffect(() => {
    if (isOpen) generate();
    return () => abortRef.current?.abort();
  }, [isOpen, generate]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `AI보고서_${year}년_${yearType === "plan" ? "예산" : "실적"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rawText, year, yearType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col bg-gray-100 rounded-2xl shadow-2xl w-[96vw] max-w-6xl h-[94vh]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white rounded-t-2xl border-b shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-gray-800 text-sm">
              AI 리포트
            </span>
            <span className="text-[10px] text-gray-400 ml-1">
              {year}년 {yearType === "plan" ? "예산" : "실적"} /{" "}
              {mode === "ytd" ? "연누계" : `${month}월`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isGenerated && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generate(true)}
                  className="text-xs h-7 gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  재생성
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-xs h-7 gap-1"
                >
                  <Download className="w-3 h-3" />
                  다운로드
                </Button>
              </>
            )}
            <button
              onClick={() => {
                abortRef.current?.abort();
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {/* Loading initial */}
          {isLoading && rawText === "" && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm">Claude가 CEO 보고서를 생성하고 있습니다...</p>
              <p className="text-xs text-gray-300">약 30~60초 소요</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-red-500">
              <p className="text-sm font-medium">오류: {error}</p>
              <Button variant="outline" size="sm" onClick={() => generate()}>
                다시 시도
              </Button>
            </div>
          )}

          {/* Dashboard content */}
          {rawText && (
            <>
              {/* 1. Executive Summary */}
              <ExecSummaryHeader meta={report.meta} bullets={report.bullets} />

              {/* 2. KPI Cards */}
              <KpiCards kpi={report.kpi} />

              {/* 3. Brand table (left 60%) + Risk/YOY (right 40%) */}
              <div className="grid grid-cols-5 gap-2.5 mb-3">
                <div className="col-span-3">
                  <TableBox
                    title="브랜드별 비용 효율성"
                    markdown={report.brandTable}
                    className="h-full"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-2.5">
                  <TableBox title="리스크 플래그" markdown={report.riskTable} />
                  <TableBox title="YOY 이상 신호" markdown={report.yoyTable} />
                </div>
              </div>

              {/* 4. Cost Structure */}
              <CostStructureSection
                rows={report.costRows}
                insight={report.costInsight}
              />

              {/* 5. Key Insight */}
              <KeyInsightBar text={report.keyInsight} />

              {/* 6. Detailed Analysis */}
              <DetailedSections markdown={report.detailed} />

              {/* Streaming indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 mt-3 text-gray-400 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>상세 분석 생성 중...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
