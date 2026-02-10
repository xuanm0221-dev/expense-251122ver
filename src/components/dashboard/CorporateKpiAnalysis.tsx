"use client";

import React from "react";
import { formatPercent } from "@/lib/utils";

interface UnitYoYSummary {
  costYoy: number | null;
  salesYoy: number | null;
}

interface CorporateKpiAnalysisProps {
  corporate: UnitYoYSummary;
  mlb: UnitYoYSummary;
  kids: UnitYoYSummary;
  discovery: UnitYoYSummary;
  commonCostYoy: number | null;
}

function fmt(yoy: number | null): string {
  return yoy == null ? "-" : formatPercent(yoy, 0);
}

function direction(yoy: number | null): "증가" | "감소" | "중립" {
  if (yoy == null) return "중립";
  return yoy >= 100 ? "증가" : "감소";
}

function relation(costYoy: number | null, salesYoy: number | null): "상회" | "하회" | "판단불가" {
  if (costYoy == null || salesYoy == null) return "판단불가";
  return costYoy >= salesYoy ? "상회" : "하회";
}

function brandSentence(name: string, data: UnitYoYSummary): string {
  const rel = relation(data.costYoy, data.salesYoy);
  if (rel === "판단불가") {
    return `${name}: 비용/매출 YOY 정보가 제한되어 방향성 판단은 보수적으로 해석 필요.`;
  }
  if (direction(data.salesYoy) === "감소" && direction(data.costYoy) === "증가") {
    return `${name}: 매출(${fmt(data.salesYoy)}) 감소 대비 비용(${fmt(data.costYoy)}) 증가로 비용 선행 리스크.`;
  }
  if (rel === "상회") {
    return `${name}: 비용 YOY(${fmt(data.costYoy)})가 매출 YOY(${fmt(data.salesYoy)})를 상회.`;
  }
  return `${name}: 비용 YOY(${fmt(data.costYoy)})가 매출 YOY(${fmt(data.salesYoy)})를 하회해 상대적으로 연동 구조.`;
}

export function CorporateKpiAnalysis({
  corporate,
  mlb,
  kids,
  discovery,
  commonCostYoy,
}: CorporateKpiAnalysisProps) {
  const corpRel = relation(corporate.costYoy, corporate.salesYoy);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200">
        <h2 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900">
          [AI분석] 2026년 법인 예산 구조 심층 점검 (KPI/비용계정 표 기반)
        </h2>
        <p className="mt-1 text-[11.4px] sm:text-[13.2px] text-slate-600">
          영업이익 데이터 없이, 비용/매출 YOY만으로 예산 구조의 연동성·리스크·관리 포인트를 정리합니다.
        </p>
      </div>

      <div className="px-4 py-3 sm:px-5 sm:py-4 grid grid-cols-1 xl:grid-cols-5 gap-3">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-1">[1] Executive Summary</h3>
          <div className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-1">
            <p>26년 법인 예산은 브랜드(MLB/KIDS/DISCOVERY) + 공통 구조이며, 비용–매출 연동성 점검이 핵심입니다.</p>
            <p>법인 비용 YOY {fmt(corporate.costYoy)}, 매출 YOY {fmt(corporate.salesYoy)}로 비용이 매출 대비 {corpRel} 구간입니다.</p>
            <p>핵심 포인트: 브랜드별 YOY 괴리, 공통 비용 고정비화 가능성, 비용 선행 구간 통제.</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-1">[2] 법인 전체 관점</h3>
          <div className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-1">
            <p>법인 총비용 YOY {fmt(corporate.costYoy)}, 판매매출 YOY {fmt(corporate.salesYoy)}.</p>
            <p>비용 YOY가 매출 YOY를 {corpRel}하면 비용 선행/연동 여부를 월중 집행에서 분리 점검해야 합니다.</p>
            <p>공통 비용 YOY {fmt(commonCostYoy)}는 매출과 분리된 고정비 성격 가능성을 별도 관리해야 합니다.</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-1">[3] 브랜드별 연관성</h3>
          <ul className="list-disc pl-4 text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-1">
            <li>{brandSentence("MLB", mlb)}</li>
            <li>{brandSentence("KIDS", kids)}</li>
            <li>{brandSentence("DISCOVERY", discovery)}</li>
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-1">[4] FP&amp;A 리스크/통제</h3>
          <ul className="list-disc pl-4 text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6 space-y-1">
            <li>매출 둔화 구간에서 비용 YOY 유지/증가 시 레버리지 리스크 확대 가능.</li>
            <li>브랜드별 비용 YOY가 매출 YOY를 상회하는 항목(인건비·광고비·수수료) 우선 통제.</li>
            <li>공통 비용은 집행률/상한 관리로 고정비화 리스크를 사전 관리.</li>
            <li>월·분기 추적: 브랜드별 비용YOY-매출YOY 갭, 공통 비용 집행률, 핵심 항목 증감.</li>
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[11.4px] sm:text-[13.2px] font-semibold text-slate-900 mb-1">[5] 한 줄 결론</h3>
          <p className="text-[11.4px] sm:text-[13.2px] text-slate-700 leading-6">
            26년 법인 예산은 “비용 YOY와 매출 YOY의 상회/하회”를 기준으로 브랜드별 연동성은 유지하되, 공통 및 선행 비용 구간은 본사 통제 가이드를 강화해야 합니다.
          </p>
        </section>
      </div>
    </div>
  );
}

