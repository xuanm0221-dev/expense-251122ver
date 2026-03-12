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

const COST_ROW_TYPES = ["고정비", "준고정비", "변동비"];

function parseCostRows(s: string): CostRow[] {
  return s
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("※"))
    .map((line) => {
      const p = line.split("|").map((x) => x.trim());
      return { type: p[0] || "", items: p[1] || "", amount: p[2] || "-", ratio: p[3] || "-", yoy: p[4] || "-" };
    })
    .filter((row) => COST_ROW_TYPES.includes(row.type));
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
    <div className="overflow-x-auto">
      <table className="rpt-tbl" {...props} />
    </div>
  ),
  thead: ({ ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-gray-100" {...props} />
  ),
  th: ({ ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-gray-200 text-gray-700 bg-gray-50" {...props} />
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
    const text = String(children ?? "");
    let cls = "border border-gray-200 text-gray-700";
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
        className={isGroupHeader ? "brand-header" : "hover:bg-gray-50"}
        {...props}
      >
        {children}
      </tr>
    );
  },
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-[12px] text-gray-600 leading-5 my-1.5" {...props}>
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
    <div className="mb-5 rounded-2xl overflow-hidden border border-purple-200 shadow-sm">
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-indigo-600 px-5 py-3.5">
        <span className="text-white font-bold text-sm tracking-[0.2em]">
          EXECUTIVE SUMMARY
        </span>
        <span className="text-purple-100 text-sm">
          {meta?.title ?? "중국법인 연간 예산 구조 진단 요약"}
        </span>
      </div>
      <div className="bg-purple-50 px-5 py-4 space-y-1.5">
        {bullets.length > 0 ? (
          bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-3 text-[14.5px] text-gray-700 leading-6">
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

function YoyBadge({ value, isBad, isGood }: { value: string; isBad: boolean; isGood: string | boolean }) {
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
    <div className="grid grid-cols-4 gap-3 mb-5">
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
            className={`border ${s.border} ${s.bg} rounded-2xl p-4 flex flex-col gap-2 shadow-sm`}
          >
            {/* 카드 라벨 */}
            <div className={`text-sm font-semibold ${s.label}`}>{item.label}</div>

            {isInwon ? (
              /* 인원 카드 */
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-bold leading-none text-gray-800">{item.monthlyCurrent}</span>
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
    <div className={`border border-gray-200 rounded-2xl bg-white shadow-sm ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
        <span className="text-sm font-semibold text-gray-800 tracking-tight">
          {title}
        </span>
      </div>
      <div className="p-4 overflow-x-auto">
        {markdown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdTableComponents as never}>
            {markdown}
          </ReactMarkdown>
        ) : (
          <div className="text-xs text-gray-400 animate-pulse py-4 text-center">
            생성 중...
          </div>
        )}
      </div>
    </div>
  );
}

const COST_TYPE_STYLES: Record<string, string> = {
  고정비:   "bg-blue-50 text-blue-700 font-semibold",
  준고정비: "bg-yellow-50 text-yellow-700 font-semibold",
  변동비:   "bg-green-50 text-green-700 font-semibold",
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
    <div className="border border-gray-200 rounded-2xl bg-white shadow-sm mb-5">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
        <span className="text-sm font-semibold text-gray-800 tracking-tight">
          비용 구조 (고정 / 준고정 / 변동 비중)
        </span>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full border-collapse text-[12px] leading-6">
          <colgroup>
            <col style={{ width: "80px" }} />
            <col />
            <col style={{ width: "90px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "90px" }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-2 text-center font-semibold text-gray-700">분류</th>
              <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">포함 항목</th>
              <th className="border border-gray-200 px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">금액</th>
              <th className="border border-gray-200 px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">구성비</th>
              <th className="border border-gray-200 px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">YOY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className={`border border-gray-200 px-2 py-2 text-center ${COST_TYPE_STYLES[r.type] ?? ""}`}>
                  {r.type}
                </td>
                <td className="border border-gray-200 px-3 py-2 text-gray-600 text-[12px]">
                  {r.items}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-right font-mono font-medium text-gray-800 whitespace-nowrap">
                  {r.amount}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-right text-gray-700 whitespace-nowrap">
                  {r.ratio}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-right text-gray-700 whitespace-nowrap">
                  {r.yoy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-500 mt-2">※ YTD 법인 전체 기준</p>
        {insight && (
          <div className="mt-3 text-[12px] text-indigo-800 bg-indigo-50 border-l-2 border-indigo-400 px-3.5 py-2.5 rounded-r-md leading-6">
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
    <div className="flex items-start gap-3 bg-gradient-to-r from-purple-700 to-indigo-500 text-white px-4 py-3 rounded-2xl mb-5 shadow-sm">
      <span className="font-bold text-[12px] whitespace-nowrap pt-0.5 shrink-0">
        Key Insight
      </span>
      <div className="border-l border-purple-300 pl-3 text-[12px] leading-5 opacity-95">
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

  // ── 컬럼 그룹 배경 헬퍼 ──────────────────────────────
  const getGroupBg = (idx: number, isHeaderRow: boolean): React.CSSProperties => {
    const BL = "2px solid #D1D5DB";
    if (idx === 0)               return {};
    if (idx >= 1 && idx <= 3)   return { background: isHeaderRow ? "#DBEAFE" : "#EFF6FF", ...(idx === 1 ? { borderLeft: BL } : {}) };
    if (idx >= 4 && idx <= 6)   return { background: isHeaderRow ? "#DCFCE7" : "#F0FDF4", ...(idx === 4 ? { borderLeft: BL } : {}) };
    if (idx >= 7 && idx <= 10)  return { background: isHeaderRow ? "#FEF9C3" : "#FEFCE8", ...(idx === 7 ? { borderLeft: BL } : {}) };
    /* idx === 11 */             return { background: isHeaderRow ? "#F3F4F6" : "#F9FAFB", borderLeft: BL };
  };

  // YOY 수치 색상 (순수 %숫자 패턴)
  const getYoyColor = (text: string): string | undefined => {
    const m = text.trim().match(/^(\d+)%$/);
    if (!m) return undefined;
    const v = parseInt(m[1]);
    if (v >= 110) return "#DC2626";
    if (v < 90)   return "#2563EB";
    return undefined;
  };

  const detailMdComponents = {
    ...mdTableComponents,
    // DETAILED: thead → 12열 이상이면 그룹 헤더 행 주입
    thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => {
      const rows = React.Children.toArray(children);
      const firstRow = rows[0];
      const colCount = React.isValidElement(firstRow)
        ? React.Children.count((firstRow as React.ReactElement<{ children?: React.ReactNode }>).props.children)
        : 0;
      const GH: React.CSSProperties = { fontSize: "10px", fontWeight: 700, padding: "2px 6px", textAlign: "center" };
      return (
        <thead {...props}>
          {colCount >= 12 && (
            <tr>
              <th style={{ background: "#F9FAFB", padding: "2px 4px" }} />
              <th colSpan={3} style={{ ...GH, background: "#DBEAFE", color: "#1D4ED8", borderLeft: "2px solid #D1D5DB" }}>당월</th>
              <th colSpan={3} style={{ ...GH, background: "#DCFCE7", color: "#15803D", borderLeft: "2px solid #D1D5DB" }}>YTD 누적</th>
              <th colSpan={4} style={{ ...GH, background: "#FEF9C3", color: "#92400E", borderLeft: "2px solid #D1D5DB" }}>계획 대비</th>
              <th style={{ background: "#F3F4F6", padding: "2px 4px", borderLeft: "2px solid #D1D5DB" }} />
            </tr>
          )}
          {children}
        </thead>
      );
    },
    // tbody tr: 그룹 배경을 각 셀에 cloneElement로 주입
    tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => {
      const cells = React.Children.toArray(children);
      const firstCell = cells[0];
      const isBrandHeader =
        React.isValidElement(firstCell) &&
        React.Children.toArray((firstCell as React.ReactElement<{ children?: React.ReactNode }>).props.children).some(
          (c) => React.isValidElement(c) && (c.type === "strong" || (c as React.ReactElement).type?.toString?.() === "strong")
        );
      const isThRow = cells.some((c) => React.isValidElement(c) && (c as React.ReactElement).type === "th");
      const styledCells = isBrandHeader
        ? cells
        : cells.map((cell, idx) => {
            if (!React.isValidElement(cell)) return cell;
            const existing = ((cell as React.ReactElement).props as { style?: React.CSSProperties }).style ?? {};
            return React.cloneElement(cell as React.ReactElement, {
              style: { ...getGroupBg(idx, isThRow), ...existing },
            });
          });
      return (
        <tr className={isBrandHeader ? "brand-header" : "hover:bg-gray-50"} {...props}>
          {styledCells}
        </tr>
      );
    },
    td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
      const text = String(children ?? "");
      const isIndented = text.startsWith("　");
      const yoyColor = getYoyColor(text);
      let cls = "border border-gray-200 text-gray-700";
      if (isIndented) cls += " pl-5";
      if (/개선/.test(text)) cls += " text-green-700 font-semibold";
      else if (/악화|경고/.test(text)) cls += " text-red-700 font-semibold";
      else if (/주의/.test(text)) cls += " text-yellow-700 font-semibold";
      if (/🔴/.test(text)) cls += " text-red-700";
      if (/🟡/.test(text)) cls += " text-yellow-700";
      if (/🟢/.test(text)) cls += " text-green-700";
      return (
        <td className={cls} style={yoyColor ? { color: yoyColor, fontWeight: 600 } : undefined} {...props}>
          {children}
        </td>
      );
    },
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2
        className="text-[14px] font-bold text-[#1E3A5F] flex items-center gap-2"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3
        className="text-[13px] font-semibold text-gray-700 mt-4 mb-1.5 border-b border-gray-100 pb-1"
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className="text-[12px] text-gray-600 leading-5 my-1.5" {...props}>
        {children}
      </p>
    ),
    li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
      <li className="text-[12px] text-gray-600 my-0.5 ml-4 list-disc leading-5" {...props}>
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
        className="border-l-2 border-purple-300 pl-3 text-[12px] text-purple-800 bg-purple-50 py-2 my-1.5 rounded-r-xl leading-5"
        {...props}
      >
        {children}
      </blockquote>
    ),
  };

  return (
    <div className="border-t border-gray-200 pt-5 mt-2 space-y-4">
      {parts.map((section, i) => {
        const lines = section.trimStart().split("\n");
        const titleLine = lines[0] ?? "";
        const body = lines.slice(1).join("\n").trim();
        // 이모지 + 제목 추출
        const titleText = titleLine.replace(/^##\s*/, "");

        return (
          <div
            key={i}
            className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden"
          >
            {/* 섹션 헤더 */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100">
              <span className="text-[14px] font-bold text-[#1E3A5F]">{titleText}</span>
            </div>
            {/* 섹션 본문 */}
            <div className="p-4 overflow-x-auto">
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
  const [isSavingStatic, setIsSavingStatic] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reportBodyRef = useRef<HTMLDivElement>(null);
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

  const staticFileName = `${year}-${month}-${yearType}-${mode}.txt`;

  const handleDownloadTxt = useCallback(() => {
    if (!rawText) return;
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = staticFileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rawText, staticFileName]);

  const handleSaveStatic = useCallback(async () => {
    if (!rawText) return;
    setIsSavingStatic(true);
    try {
      const res = await fetch("/api/ai-report/save-static", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, yearType, mode, content: rawText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      window.alert(`${json.path}\n저장 완료. git add & commit & push 하세요.`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setIsSavingStatic(false);
    }
  }, [rawText, year, month, yearType, mode]);

  const handleDownload = useCallback(() => {
    if (!reportBodyRef.current) return;
    const inner = reportBodyRef.current.innerHTML;
    const title = `AI보고서_${year}년_${yearType === "plan" ? "예산" : "실적"}_${month}월`;
    const fullDoc = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* ── 전체 레이아웃 ── */
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #F3F4F6;
      padding: 16px;
      color: #374151;
    }
    .report-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
      background: #F3F4F6;
    }
    .section-card {
      background: white;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
      padding: 16px 20px;
      margin-bottom: 16px;
    }

    /* ── 표 스타일 ── */
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th {
      font-size: 12px;
      font-weight: 600;
      color: #4B5563;
      background: #F9FAFB;
      padding: 5px 8px;
      white-space: nowrap;
      text-align: center;
      border: 1px solid #E5E7EB;
    }
    td {
      font-size: 12px;
      color: #374151;
      padding: 4px 8px;
      line-height: 1.4;
      border: 1px solid #E5E7EB;
    }
    td.number { text-align: right; white-space: nowrap; }
    td.label  { text-align: left; min-width: 90px; }
    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 9999px;
      white-space: nowrap;
    }

    /* ── 섹션 제목 ── */
    h2.section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1E3A5F;
      margin-bottom: 12px;
      margin-top: 24px;
      border-left: 3px solid #6366F1;
      padding-left: 8px;
    }
    h3.sub-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      margin-top: 16px;
    }

    /* ── 본문 텍스트 ── */
    .insight-text {
      font-size: 12px;
      line-height: 1.7;
      color: #374151;
      margin-bottom: 6px;
    }
    .proposal-item {
      font-size: 12px;
      line-height: 1.8;
      color: #374151;
      margin-bottom: 10px;
      padding-left: 4px;
    }
    .proposal-bullet {
      font-size: 12px;
      line-height: 1.7;
      color: #4B5563;
      margin-bottom: 4px;
    }

    /* ── KPI 카드 ── */
    .kpi-label  { font-size: 11px; color: #6B7280; }
    .kpi-value  { font-size: 14px; font-weight: 700; color: #111827; }
    .kpi-badge  { font-size: 11px; padding: 2px 7px; border-radius: 9999px; }
  </style>
</head>
<body>
<div class="report-container">
${inner}
</div>
</body>
</html>`;
    const blob = new Blob([fullDoc], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [year, month, yearType]);

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
                {process.env.NEXT_PUBLIC_AI_REPORT_ALLOW_REGENERATE === "true" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generate(true)}
                    className="text-xs h-7 gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    재생성
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveStatic}
                  disabled={isSavingStatic}
                  className="text-xs h-7 gap-1 bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
                  title="data/ai-reports/에 저장 (로컬 전용)"
                >
                  {isSavingStatic ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  정적 파일로 저장
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTxt}
                  className="text-xs h-7 gap-1"
                  title="다운로드"
                >
                  <Download className="w-3 h-3" />
                  TXT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-xs h-7 gap-1"
                >
                  <Download className="w-3 h-3" />
                  HTML
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
            <div ref={reportBodyRef}>
              {/* 표 공통 scoped 스타일 */}
              <style>{`
                .rpt-tbl { width: 100%; border-collapse: collapse; }
                .rpt-tbl th { font-size: 11px; font-weight: 600; padding: 3px 8px; white-space: nowrap; line-height: 1.35; }
                .rpt-tbl td { font-size: 12px; padding: 3px 8px; line-height: 1.35; }
                .rpt-tbl td:first-child, .rpt-tbl th:first-child { width: 110px; min-width: 90px; max-width: 130px; text-align: left; }
                .rpt-tbl td:not(:first-child), .rpt-tbl th:not(:first-child) { width: 90px; min-width: 80px; text-align: right; white-space: nowrap; }
                .rpt-tbl td:last-child, .rpt-tbl th:last-child { width: 160px; min-width: 140px; text-align: left; white-space: normal; }
                .rpt-tbl tr.brand-header td { padding: 4px 8px; background: #F1F5F9; font-weight: 600; font-size: 12px; color: #1E3A5F; }
                .rpt-tbl tbody tr:nth-child(even) td { filter: brightness(0.97); }
              `}</style>
              {/* 1. Executive Summary */}
              <ExecSummaryHeader meta={report.meta} bullets={report.bullets} />

              {/* 2. KPI Cards */}
              <KpiCards kpi={report.kpi} />

              {/* 3. Brand table (full width) + Risk/YOY (2-col below) */}
              <div className="mb-5 flex flex-col gap-4">
                <TableBox
                  title="브랜드별 비용 효율성"
                  markdown={report.brandTable}
                />
                <div className="grid grid-cols-2 gap-4">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
