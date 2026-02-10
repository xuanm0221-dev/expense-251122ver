"use client";

import React from "react";
import { formatPercent } from "@/lib/utils";

export type AiBizUnit = "법인" | "MLB" | "KIDS" | "DISCOVERY" | "공통";

export interface AiUnitSummary {
  bizUnit: AiBizUnit;
  /** 2026 연간 예산 비용(합계) */
  cost: number;
  /** 전년(2025.12 YTD) 대비 비용 YOY (당년/전년*100) */
  costYoy: number | null;
  /** 2026 연간 예산 판매매출(합계). 공통은 참고값으로만 해석 */
  sales: number | null;
  /** 전년(2025.12 YTD) 대비 판매매출 YOY (당년/전년*100) */
  salesYoy: number | null;
}

interface HomeAIAnalysisProps {
  corporate: AiUnitSummary; // 법인
  mlb: AiUnitSummary;
  kids: AiUnitSummary;
  discovery: AiUnitSummary;
  common: AiUnitSummary;
}

function direction(yoy: number | null): "증가" | "감소" | "N/A" {
  if (yoy == null) return "N/A";
  return yoy >= 100 ? "증가" : "감소";
}

function compareCostVsSales(costYoy: number | null, salesYoy: number | null): "상회" | "하회" | "N/A" {
  if (costYoy == null || salesYoy == null) return "N/A";
  return costYoy >= salesYoy ? "상회" : "하회";
}

function fmtYoy(yoy: number | null): string {
  return yoy == null ? "-" : formatPercent(yoy, 0);
}

function brandLine(u: AiUnitSummary): string {
  const salesDir = direction(u.salesYoy);
  const costDir = direction(u.costYoy);
  const rel = compareCostVsSales(u.costYoy, u.salesYoy);

  // 숫자 재계산/추정 없이: 카드에 표시되는 YOY(지수)만으로 방향/상대 비교만 서술
  if (u.salesYoy == null || u.costYoy == null) {
    return `${u.bizUnit}: 판매매출/비용 YOY 정보가 일부 부족해 방향성 해석은 제한적입니다.`;
  }

  if (salesDir === "감소" && costDir === "증가") {
    return `${u.bizUnit}: 판매매출은 전년 대비 감소(${fmtYoy(u.salesYoy)})인데 비용은 증가(${fmtYoy(u.costYoy)})해, 비용이 매출 대비 선행되는 구조 리스크가 있습니다.`;
  }
  if (salesDir === "증가" && costDir === "증가" && rel === "상회") {
    return `${u.bizUnit}: 매출 성장(${fmtYoy(u.salesYoy)}) 대비 비용 증가(${fmtYoy(u.costYoy)})가 상회해, 효율성(레버리지) 관점의 관리 포인트입니다.`;
  }
  if (salesDir === "증가" && costDir === "증가" && rel === "하회") {
    return `${u.bizUnit}: 매출 성장(${fmtYoy(u.salesYoy)}) 대비 비용 증가(${fmtYoy(u.costYoy)})가 하회해, 비용 구조가 매출 성장을 상대적으로 “지원”하는 형태로 해석됩니다.`; // 성과 판단 표현은 피하고 구조 해석만
  }
  if (salesDir === "감소" && costDir === "감소") {
    return `${u.bizUnit}: 매출(${fmtYoy(u.salesYoy)})과 비용(${fmtYoy(u.costYoy)})이 모두 감소 방향으로, 비용이 매출 흐름과 동행하는지 점검이 필요합니다.`;
  }
  return `${u.bizUnit}: 판매매출(${fmtYoy(u.salesYoy)})과 비용(${fmtYoy(u.costYoy)})의 방향성을 기준으로, 비용–매출 연동 구조를 추가 점검하세요.`;
}

export function HomeAIAnalysis({ corporate, mlb, kids, discovery, common }: HomeAIAnalysisProps) {
  const corpRel = compareCostVsSales(corporate.costYoy, corporate.salesYoy);
  const corpOneLine =
    corpRel === "상회"
      ? "법인 비용 증가가 매출 성장 대비 선행(또는 상회)하는 구간이 존재합니다."
      : corpRel === "하회"
        ? "법인 비용 증가가 매출 성장에 상대적으로 비례하는 구조로 보입니다."
        : "법인 비용–매출 연동 판단을 위한 YOY 정보가 일부 제한적입니다.";

  return (
    <div className="mb-8">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">[AI분석] 2026년 중국법인 연간 예산 구조 점검</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                예산 관점(실적 아님)이며, 대시보드에 표시되는 수치/구조만으로 비용–매출 연동과 통제 포인트를 해석합니다.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] sm:text-xs text-slate-500">YOY 표기</p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-700">당년/전년 × 100</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 sm:px-6 sm:py-5">
          {/* 5개 분석 박스: 큰 화면에서 가로 5개, 작은 화면에서 자동 줄바꿈 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-2">[1] Executive Summary</h3>
              <div className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-1">
                <p>26년 중국법인 연간 예산은 브랜드(MLB/KIDS/DISCOVERY)와 공통(지원조직)으로 구성된 비용 구조로, 전년 구조 대비 비용–매출 연동성을 중심으로 점검할 필요가 있습니다.</p>
                <p>{corpOneLine}</p>
                <p>핵심 관리 포인트는 (1) 매출 방향과 무관하게 선행될 수 있는 비용 영역, (2) 브랜드별 비용–매출 YOY 괴리(상회/하회) 구간, (3) 공통 비용의 고정비화 가능성입니다.</p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-2">[2] 법인 전체 관점</h3>
              <div className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-1">
                <p>
                  법인 총비용 YOY <span className="font-semibold">{fmtYoy(corporate.costYoy)}</span>, 판매매출 YOY{" "}
                  <span className="font-semibold">{fmtYoy(corporate.salesYoy)}</span>
                </p>
                <p>
                  비용 YOY가 매출 YOY를 <span className="font-semibold">{corpRel === "N/A" ? "판단 불가" : corpRel}</span>하는지에 따라,
                  연동/선행 구조를 구분해 점검하세요.
                </p>
                <p className="text-slate-600">
                  공통은 지원조직(매출 없음). 공통 카드 매출 표시는 참고값이며 공통 자체 매출로 해석하면 안 됩니다.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-2">[3] 브랜드별 연관성</h3>
              <div className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-2">
                <p className="text-slate-600">판매매출 YOY vs 비용 YOY 방향/상대 비교만으로 해석합니다.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{brandLine(mlb)}</li>
                  <li>{brandLine(kids)}</li>
                  <li>{brandLine(discovery)}</li>
                </ul>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-2">[4] FP&amp;A 리스크/통제</h3>
              <div className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6">
                <ul className="list-disc pl-5 space-y-1">
                  <li><span className="font-semibold">레버리지</span>: 매출 둔화 구간에서 비용 YOY 유지/상승(특히 매출↓+비용↑) 리스크.</li>
                  <li><span className="font-semibold">비동기</span>: 비용 YOY가 매출 YOY를 상회하는 영역 우선 식별/가이드.</li>
                  <li><span className="font-semibold">공통</span>: 항목별 상한/가이드 및 집행률 관리(고정비화 점검).</li>
                  <li><span className="font-semibold">추적</span>: 매출YOY-비용YOY 갭, 광고효율(가능 시), 헤드카운트, 공통 집행률.</li>
                </ul>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-2">[5] 한 줄 결론</h3>
              <p className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6">
                “26년 예산 구조는 <span className="font-semibold">매출 YOY 대비 비용 YOY의 상회/하회</span>를 기준으로, 비용–매출 연동(또는 선행) 구조를
                브랜드·공통 단위로 구분해 관리해야 합니다.”
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

