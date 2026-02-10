"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronDown, ChevronsDownUp, Edit2, Check, X, PieChart, Calendar, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryDetail, getAnnualData, data, getMonthlyTotal, type BizUnit } from "@/lib/expenseData";
import { useToast } from "@/components/ui/toast";

type BizUnitOrAll = BizUnit | "ALL";
import { formatK, formatPercent, calculateYOY } from "@/lib/utils";

import { ExpenseAccountRow } from "@/types/expense";
import { PasswordModal } from "@/components/dashboard/PasswordModal";

interface ExpenseAccountHierTableProps {
  bizUnit?: BizUnit | "ALL";
  year: number;
  month: number;
  title?: string;
  onHierarchyReady?: (rows: ExpenseAccountRow[]) => void;
  onAnnualTotalsChange?: (totals: { prevYear: number; currYear: number }) => void;
  yearType?: 'actual' | 'plan';
}

export function ExpenseAccountHierTable({
  bizUnit = "ALL",
  year,
  month,
  title,
  onHierarchyReady,
  onAnnualTotalsChange,
  yearType = 'actual',
}: ExpenseAccountHierTableProps) {
  const [viewMode, setViewMode] = useState<"monthly" | "ytd" | "annual">("ytd");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // 설명 편집을 위한 상태 관리
  const [descriptions, setDescriptions] = useState<Map<string, string>>(new Map());
  const [basisMap, setBasisMap] = useState<Map<string, string>>(new Map());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [basisPopoverRowId, setBasisPopoverRowId] = useState<string | null>(null);
  const [basisEditValue, setBasisEditValue] = useState<string>("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingSaveType, setPendingSaveType] = useState<"description" | "basis" | "reset" | null>(null);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { addToast } = useToast();

  const is2026AnnualOnly = year === 2026 && yearType === 'plan';

  // API에서 설명 데이터 로드
  useEffect(() => {
    const loadDescriptions = async () => {
      try {
        const ym = `${year}${String(month).padStart(2, "0")}`;
        const response = await fetch(
          `/api/cost-descriptions?brand=${bizUnit}&ym=${ym}&mode=${viewMode}&yearType=${yearType}`
        );
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setDescriptions(new Map(Object.entries(result.data)));
          }
          if (result.success && result.basis) {
            setBasisMap(new Map(Object.entries(result.basis)));
          }
        }
      } catch (error) {
        console.error("설명 데이터 로드 실패:", error);
        // 실패 시 localStorage에서 fallback (선택적)
        const storageKey = `expense-descriptions-${bizUnit}-${year}-${month}-${yearType}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setDescriptions(new Map(Object.entries(parsed)));
          } catch (e) {
            console.error("localStorage fallback 실패:", e);
          }
        }
      }
    };

    loadDescriptions();
  }, [bizUnit, year, month, viewMode, yearType, refreshKey]);

  // 편집 시작
  const startEdit = (rowId: string, currentDescription: string) => {
    setEditingRowId(rowId);
    setEditValue(currentDescription);
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingRowId(null);
    setEditValue("");
  };

  // 편집 저장 시 비밀번호 모달 열기
  const requestSaveEdit = (rowId: string) => {
    setPendingSaveType("description");
    setPendingRowId(rowId);
    setPasswordModalOpen(true);
  };

  const requestSaveBasis = (rowId: string) => {
    setPendingSaveType("basis");
    setPendingRowId(rowId);
    setPasswordModalOpen(true);
  };

  const requestReset = () => {
    setPendingSaveType("reset");
    setPasswordModalOpen(true);
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!pendingSaveType) return;
    if (pendingSaveType !== "reset" && !pendingRowId) return;
    const ym = `${year}${String(month).padStart(2, "0")}`;

    if (pendingSaveType === "reset") {
      const response = await fetch("/api/cost-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          brand: bizUnit,
          ym,
          mode: viewMode,
          yearType,
          password,
        }),
      });
      const result = await response.json();
      if (response.status === 401) {
        addToast({ type: "error", message: "비밀번호가 올바르지 않습니다." });
        throw new Error("비밀번호 불일치");
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || "초기화에 실패했습니다.");
      }
      addToast({ type: "success", message: "초기화되었습니다." });
      setPasswordModalOpen(false);
      setPendingSaveType(null);
      setPendingRowId(null);
      setRefreshKey((k) => k + 1);
      return;
    }

    const isDescription = pendingSaveType === "description";
    const body: Record<string, unknown> = {
      brand: bizUnit,
      ym,
      mode: viewMode,
      accountPath: pendingRowId!,
      yearType,
      password,
    };
    if (isDescription) body.description = editValue;
    else body.basis = basisEditValue;

    const response = await fetch("/api/cost-descriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (response.status === 401) {
      addToast({ type: "error", message: "비밀번호가 올바르지 않습니다." });
      throw new Error("비밀번호 불일치");
    }
    if (!response.ok || !result.success) {
      throw new Error(result.error || "저장에 실패했습니다.");
    }

    if (isDescription) {
      const newDescriptions = new Map(descriptions);
      newDescriptions.set(pendingRowId!, editValue);
      setDescriptions(newDescriptions);
      const storageKey = `expense-descriptions-${bizUnit}-${year}-${month}-${yearType}`;
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(newDescriptions)));
      addToast({ type: "success", message: "설명이 저장되었습니다." });
      setEditingRowId(null);
      setEditValue("");
    } else {
      const newBasis = new Map(basisMap);
if (basisEditValue.trim()) newBasis.set(pendingRowId!, basisEditValue);
        else newBasis.delete(pendingRowId!);
      setBasisMap(newBasis);
      addToast({ type: "success", message: "계산 근거가 저장되었습니다." });
      closeBasisPopover();
    }
    setPasswordModalOpen(false);
    setPendingSaveType(null);
    setPendingRowId(null);
  };

  const openBasisPopover = (rowId: string) => {
    setBasisPopoverRowId(rowId);
    setBasisEditValue(basisMap.get(rowId) || "");
  };

  const closeBasisPopover = () => {
    setBasisPopoverRowId(null);
    setBasisEditValue("");
  };

  const saveBasis = async (rowId: string) => {
    try {
      const ym = `${year}${String(month).padStart(2, "0")}`;
      const response = await fetch("/api/cost-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: bizUnit,
          ym,
          mode: viewMode,
          accountPath: rowId,
          basis: basisEditValue,
          yearType,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const newBasis = new Map(basisMap);
        if (basisEditValue.trim()) newBasis.set(rowId, basisEditValue);
        else newBasis.delete(rowId);
        setBasisMap(newBasis);
        addToast({ type: "success", message: "계산 근거가 저장되었습니다." });
        closeBasisPopover();
      } else {
        throw new Error(result.error || "저장에 실패했습니다.");
      }
    } catch (error: any) {
      addToast({ type: "error", message: error.message || "계산 근거 저장 중 오류가 발생했습니다." });
    }
  };

  // 계층 데이터 변환 및 집계
  const hierarchicalData = useMemo(() => {
    // bizUnit이 "ALL"이면 모든 사업부(MLB, KIDS, DISCOVERY, 공통) 포함
    // 모든 대분류 가져오기 (costLv1을 빈 문자열로 전달하면 모든 대분류 반환)
    const bizUnitFilter: BizUnitOrAll = bizUnit || "ALL";
    // 2026년(예산)이면 연간만 사용하므로 YTD로 가져옴. viewMode가 "annual"이면 "ytd"로 변환
    const modeForDataFetch: "monthly" | "ytd" = (is2026AnnualOnly || viewMode === "annual") ? "ytd" : viewMode;
    const allDetails = getCategoryDetail(bizUnitFilter, year, month, "", modeForDataFetch, yearType);
    // 2026년(예산)일 때는 전년도를 2025년 12월 YTD actual로 가져옴
    const prevYearDetails = is2026AnnualOnly
      ? getCategoryDetail(bizUnitFilter, 2025, 12, "", "ytd", 'actual')
      : getCategoryDetail(bizUnitFilter, year - 1, month, "", modeForDataFetch, yearType);

    // 대분류별로 그룹화
    const l1Map = new Map<string, ExpenseAccountRow>();
    const l2Map = new Map<string, ExpenseAccountRow>();
    const l3Map = new Map<string, ExpenseAccountRow>();

    // 전년도 데이터를 먼저 처리하여 구조 생성 (전년도에만 존재하는 데이터도 포함)
    prevYearDetails.forEach((detail) => {
      const l1Key = detail.cost_lv1 || "";
      if (!l1Key) return;

      const isAdExpense = l1Key === "광고비";
      const isInteriorDev = l1Key === "지급수수료" && detail.cost_lv2 === "인테리어 개발";
      const isTravelExpense = l1Key === "출장비" && (detail.cost_lv2 === "국내출장비" || detail.cost_lv2 === "해외출장비");
      
      // 디버깅: 복리후생비 KIDS 데이터 확인
      if (l1Key === "복리후생비" && detail.biz_unit === "KIDS" && modeForDataFetch === "ytd") {
        console.log(`[전년도] 복리후생비 KIDS: cost_lv2=${detail.cost_lv2}, cost_lv3=${detail.cost_lv3}, amount=${detail.amount}`);
      }

      // 대분류 생성 또는 가져오기
      if (!l1Map.has(l1Key)) {
        l1Map.set(l1Key, {
          id: `l1-${l1Key}`,
          level: 1,
          category_l1: l1Key,
          category_l2: "",
          category_l3: "",
          prev_month: 0,
          curr_month: 0,
          prev_ytd: 0,
          curr_ytd: 0,
          prev_year_annual: null,
          curr_year_annual: null,
          description: "",
          isExpanded: expandedRows.has(`l1-${l1Key}`),
          children: [],
        });
      }
      const l1Row = l1Map.get(l1Key)!;

      if (isAdExpense) {
        // 광고비인 경우
        const bizUnitKey = detail.biz_unit || "기타";
        
        if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
          // 홈 페이지 & 법인 페이지: 대분류 → 사업부구분 → 중분류(L3). L3 합계 = L2
          const l2Key = `${l1Key}|${bizUnitKey}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${bizUnitKey}`,
              level: 2,
              category_l1: l1Key,
              biz_unit: bizUnitKey,
              category_l2: bizUnitKey,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${bizUnitKey}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
            const l3Key = `${l2Key}|${detail.cost_lv2}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${bizUnitKey}-${detail.cost_lv2}`,
                level: 3,
                category_l1: l1Key,
                biz_unit: bizUnitKey,
                category_l2: detail.cost_lv2,
                category_l3: detail.cost_lv2,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: false,
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }
            if (viewMode === "monthly") {
              l3Row.prev_month += detail.amount;
            } else {
              l3Row.prev_ytd += detail.amount;
            }
          } else {
            if (viewMode === "monthly") {
              l2Row.prev_month += detail.amount;
            } else {
              l2Row.prev_ytd += detail.amount;
            }
          }
        } else {
          // 브랜드 페이지: 대분류 → 중분류 (사업부구분 스킵)
          if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
            const l2Key = `${l1Key}|${detail.cost_lv2}`;
            let l2Row = l2Map.get(l2Key);
            if (!l2Row) {
              l2Row = {
                id: `l2-${l1Key}-${detail.cost_lv2}`,
                level: 2,
                category_l1: l1Key,
                category_l2: detail.cost_lv2,
                category_l3: "",
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
                children: [],
              };
              l2Map.set(l2Key, l2Row);
              l1Row.children!.push(l2Row);
            }
            if (viewMode === "monthly") {
              l2Row.prev_month += detail.amount;
            } else {
              l2Row.prev_ytd += detail.amount;
            }
          } else {
            // 중분류가 없으면 대분류에 직접 집계
            if (viewMode === "monthly") {
              l1Row.prev_month += detail.amount;
            } else {
              l1Row.prev_ytd += detail.amount;
            }
          }
        }
      } else if (isInteriorDev) {
        // 지급수수료 > 인테리어 개발인 경우
        if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
          const l2Key = `${l1Key}|${detail.cost_lv2}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${detail.cost_lv2}`,
              level: 2,
              category_l1: l1Key,
              category_l2: detail.cost_lv2,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          const bizUnitKey = detail.biz_unit || "기타";
          
          if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
            // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
            const l3Key = `${l2Key}|${bizUnitKey}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`,
                level: 3,
                category_l1: l1Key,
                biz_unit: bizUnitKey,
                category_l2: detail.cost_lv2,
                category_l3: bizUnitKey,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: expandedRows.has(`l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`),
                children: [],
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }

            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l4Key = `${l3Key}|${detail.cost_lv3}`;
              let l4Row = l3Map.get(l4Key);
              if (!l4Row) {
                l4Row = {
                  id: `l4-${l1Key}-${detail.cost_lv2}-${bizUnitKey}-${detail.cost_lv3}`,
                  level: 4,
                  category_l1: l1Key,
                  biz_unit: bizUnitKey,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l4Key, l4Row);
                l3Row.children!.push(l4Row);
              }
              if (viewMode === "monthly") {
                l4Row.prev_month += detail.amount;
              } else {
                l4Row.prev_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l3Row.prev_month += detail.amount;
              } else {
                l3Row.prev_ytd += detail.amount;
              }
            }
          } else {
            // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l3Key = `${l2Key}|${detail.cost_lv3}`;
              let l3Row = l3Map.get(l3Key);
              if (!l3Row) {
                l3Row = {
                  id: `l3-${l1Key}-${detail.cost_lv2}-${detail.cost_lv3}`,
                  level: 3,
                  category_l1: l1Key,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l3Key, l3Row);
                l2Row.children!.push(l3Row);
              }
              if (viewMode === "monthly") {
                l3Row.prev_month += detail.amount;
              } else {
                l3Row.prev_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l2Row.prev_month += detail.amount;
              } else {
                l2Row.prev_ytd += detail.amount;
              }
            }
          }
        } else {
          if (viewMode === "monthly") {
            l1Row.prev_month += detail.amount;
          } else {
            l1Row.prev_ytd += detail.amount;
          }
        }
      } else if (isTravelExpense) {
        // 출장비 > 국내출장비/해외출장비인 경우
        if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
          const l2Key = `${l1Key}|${detail.cost_lv2}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${detail.cost_lv2}`,
              level: 2,
              category_l1: l1Key,
              category_l2: detail.cost_lv2,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          const bizUnitKey = detail.biz_unit || "기타";
          
          if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
            // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
            const l3Key = `${l2Key}|${bizUnitKey}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`,
                level: 3,
                category_l1: l1Key,
                biz_unit: bizUnitKey,
                category_l2: detail.cost_lv2,
                category_l3: bizUnitKey,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: expandedRows.has(`l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`),
                children: [],
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }

            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l4Key = `${l3Key}|${detail.cost_lv3}`;
              let l4Row = l3Map.get(l4Key);
              if (!l4Row) {
                l4Row = {
                  id: `l4-${l1Key}-${detail.cost_lv2}-${bizUnitKey}-${detail.cost_lv3}`,
                  level: 4,
                  category_l1: l1Key,
                  biz_unit: bizUnitKey,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l4Key, l4Row);
                l3Row.children!.push(l4Row);
              }
              if (viewMode === "monthly") {
                l4Row.prev_month += detail.amount;
              } else {
                l4Row.prev_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l3Row.prev_month += detail.amount;
              } else {
                l3Row.prev_ytd += detail.amount;
              }
            }
          } else {
            // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l3Key = `${l2Key}|${detail.cost_lv3}`;
              let l3Row = l3Map.get(l3Key);
              if (!l3Row) {
                l3Row = {
                  id: `l3-${l1Key}-${detail.cost_lv2}-${detail.cost_lv3}`,
                  level: 3,
                  category_l1: l1Key,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l3Key, l3Row);
                l2Row.children!.push(l3Row);
              }
              if (viewMode === "monthly") {
                l3Row.prev_month += detail.amount;
              } else {
                l3Row.prev_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l2Row.prev_month += detail.amount;
              } else {
                l2Row.prev_ytd += detail.amount;
              }
            }
          }
        } else {
          if (viewMode === "monthly") {
            l1Row.prev_month += detail.amount;
          } else {
            l1Row.prev_ytd += detail.amount;
          }
        }
      } else {
        // 광고비가 아닌 경우: 기존 로직 (대분류 → 중분류 → 소분류)
        if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
          const l2Key = `${l1Key}|${detail.cost_lv2}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${detail.cost_lv2}`,
              level: 2,
              category_l1: l1Key,
              category_l2: detail.cost_lv2,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
            const l3Key = `${l2Key}|${detail.cost_lv3}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${detail.cost_lv2}-${detail.cost_lv3}`,
                level: 3,
                category_l1: l1Key,
                category_l2: detail.cost_lv2,
                category_l3: detail.cost_lv3,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: false,
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }
            if (viewMode === "monthly") {
              l3Row.prev_month += detail.amount;
            } else {
              l3Row.prev_ytd += detail.amount;
            }
          } else {
            if (viewMode === "monthly") {
              l2Row.prev_month += detail.amount;
            } else {
              l2Row.prev_ytd += detail.amount;
            }
          }
        } else {
          if (viewMode === "monthly") {
            l1Row.prev_month += detail.amount;
          } else {
            l1Row.prev_ytd += detail.amount;
          }
        }
      }
    });

    // 당년 데이터 처리
    allDetails.forEach((detail) => {
      const l1Key = detail.cost_lv1 || "";
      if (!l1Key) return;

      // 광고비인지 확인
      const isAdExpense = l1Key === "광고비";
      const isInteriorDev = l1Key === "지급수수료" && detail.cost_lv2 === "인테리어 개발";
      const isTravelExpense = l1Key === "출장비" && (detail.cost_lv2 === "국내출장비" || detail.cost_lv2 === "해외출장비");

      // 대분류 생성 또는 가져오기
      if (!l1Map.has(l1Key)) {
        l1Map.set(l1Key, {
          id: `l1-${l1Key}`,
          level: 1,
          category_l1: l1Key,
          category_l2: "",
          category_l3: "",
          prev_month: 0,
          curr_month: 0,
          prev_ytd: 0,
          curr_ytd: 0,
          prev_year_annual: null,
          curr_year_annual: null,
          description: "",
          isExpanded: expandedRows.has(`l1-${l1Key}`),
          children: [],
        });
      }
      const l1Row = l1Map.get(l1Key)!;

      // 광고비인 경우
      if (isAdExpense) {
        const bizUnitKey = detail.biz_unit || "기타";
        
        if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
          // 홈/법인: 대분류 → 사업부구분(L2) → 중분류(L3). L3 하단에 별도 L2로 나오던 중복 제거(법인도 동일 구조)
          const l2Key = `${l1Key}|${bizUnitKey}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${bizUnitKey}`,
              level: 2,
              category_l1: l1Key,
              biz_unit: bizUnitKey,
              category_l2: bizUnitKey,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${bizUnitKey}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
            const l3Key = `${l2Key}|${detail.cost_lv2}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${bizUnitKey}-${detail.cost_lv2}`,
                level: 3,
                category_l1: l1Key,
                biz_unit: bizUnitKey,
                category_l2: detail.cost_lv2,
                category_l3: detail.cost_lv2,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: false,
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }
            if (viewMode === "monthly") {
              l3Row.curr_month += detail.amount;
            } else {
              l3Row.curr_ytd += detail.amount;
            }
          } else {
            if (viewMode === "monthly") {
              l2Row.curr_month += detail.amount;
            } else {
              l2Row.curr_ytd += detail.amount;
            }
          }
        } else {
          // 브랜드 페이지: 대분류 → 중분류 (사업부구분 스킵)
          if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
            const l2Key = `${l1Key}|${detail.cost_lv2}`;
            let l2Row = l2Map.get(l2Key);
            if (!l2Row) {
              l2Row = {
                id: `l2-${l1Key}-${detail.cost_lv2}`,
                level: 2,
                category_l1: l1Key,
                category_l2: detail.cost_lv2,
                category_l3: "",
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
                children: [],
              };
              l2Map.set(l2Key, l2Row);
              l1Row.children!.push(l2Row);
            }
            if (viewMode === "monthly") {
              l2Row.curr_month += detail.amount;
            } else {
              l2Row.curr_ytd += detail.amount;
            }
          } else {
            // 중분류가 없으면 대분류에 직접 집계
            if (viewMode === "monthly") {
              l1Row.curr_month += detail.amount;
            } else {
              l1Row.curr_ytd += detail.amount;
            }
          }
        }
      } else if (isInteriorDev) {
        // 지급수수료 > 인테리어 개발인 경우
        if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
          const l2Key = `${l1Key}|${detail.cost_lv2}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${detail.cost_lv2}`,
              level: 2,
              category_l1: l1Key,
              category_l2: detail.cost_lv2,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          const bizUnitKey = detail.biz_unit || "기타";
          
          if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
            // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
            const l3Key = `${l2Key}|${bizUnitKey}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`,
                level: 3,
                category_l1: l1Key,
                biz_unit: bizUnitKey,
                category_l2: detail.cost_lv2,
                category_l3: bizUnitKey,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: expandedRows.has(`l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`),
                children: [],
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }

            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l4Key = `${l3Key}|${detail.cost_lv3}`;
              let l4Row = l3Map.get(l4Key);
              if (!l4Row) {
                l4Row = {
                  id: `l4-${l1Key}-${detail.cost_lv2}-${bizUnitKey}-${detail.cost_lv3}`,
                  level: 4,
                  category_l1: l1Key,
                  biz_unit: bizUnitKey,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l4Key, l4Row);
                l3Row.children!.push(l4Row);
              }
              if (viewMode === "monthly") {
                l4Row.curr_month += detail.amount;
              } else {
                l4Row.curr_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l3Row.curr_month += detail.amount;
              } else {
                l3Row.curr_ytd += detail.amount;
              }
            }
          } else {
            // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l3Key = `${l2Key}|${detail.cost_lv3}`;
              let l3Row = l3Map.get(l3Key);
              if (!l3Row) {
                l3Row = {
                  id: `l3-${l1Key}-${detail.cost_lv2}-${detail.cost_lv3}`,
                  level: 3,
                  category_l1: l1Key,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l3Key, l3Row);
                l2Row.children!.push(l3Row);
              }
              if (viewMode === "monthly") {
                l3Row.curr_month += detail.amount;
              } else {
                l3Row.curr_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l2Row.curr_month += detail.amount;
              } else {
                l2Row.curr_ytd += detail.amount;
              }
            }
          }
        } else {
          if (viewMode === "monthly") {
            l1Row.curr_month += detail.amount;
          } else {
            l1Row.curr_ytd += detail.amount;
          }
        }
      } else if (isTravelExpense) {
        // 출장비 > 국내출장비/해외출장비인 경우
        if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
          const l2Key = `${l1Key}|${detail.cost_lv2}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${detail.cost_lv2}`,
              level: 2,
              category_l1: l1Key,
              category_l2: detail.cost_lv2,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          const bizUnitKey = detail.biz_unit || "기타";
          
          if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
            // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
            const l3Key = `${l2Key}|${bizUnitKey}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`,
                level: 3,
                category_l1: l1Key,
                biz_unit: bizUnitKey,
                category_l2: detail.cost_lv2,
                category_l3: bizUnitKey,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: expandedRows.has(`l3-${l1Key}-${detail.cost_lv2}-${bizUnitKey}`),
                children: [],
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }

            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l4Key = `${l3Key}|${detail.cost_lv3}`;
              let l4Row = l3Map.get(l4Key);
              if (!l4Row) {
                l4Row = {
                  id: `l4-${l1Key}-${detail.cost_lv2}-${bizUnitKey}-${detail.cost_lv3}`,
                  level: 4,
                  category_l1: l1Key,
                  biz_unit: bizUnitKey,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l4Key, l4Row);
                l3Row.children!.push(l4Row);
              }
              if (viewMode === "monthly") {
                l4Row.curr_month += detail.amount;
              } else {
                l4Row.curr_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l3Row.curr_month += detail.amount;
              } else {
                l3Row.curr_ytd += detail.amount;
              }
            }
          } else {
            // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
            if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
              const l3Key = `${l2Key}|${detail.cost_lv3}`;
              let l3Row = l3Map.get(l3Key);
              if (!l3Row) {
                l3Row = {
                  id: `l3-${l1Key}-${detail.cost_lv2}-${detail.cost_lv3}`,
                  level: 3,
                  category_l1: l1Key,
                  category_l2: detail.cost_lv2,
                  category_l3: detail.cost_lv3,
                  prev_month: 0,
                  curr_month: 0,
                  prev_ytd: 0,
                  curr_ytd: 0,
                  prev_year_annual: null,
                  curr_year_annual: null,
                  description: "",
                  isExpanded: false,
                };
                l3Map.set(l3Key, l3Row);
                l2Row.children!.push(l3Row);
              }
              if (viewMode === "monthly") {
                l3Row.curr_month += detail.amount;
              } else {
                l3Row.curr_ytd += detail.amount;
              }
            } else {
              if (viewMode === "monthly") {
                l2Row.curr_month += detail.amount;
              } else {
                l2Row.curr_ytd += detail.amount;
              }
            }
          }
        } else {
          if (viewMode === "monthly") {
            l1Row.curr_month += detail.amount;
          } else {
            l1Row.curr_ytd += detail.amount;
          }
        }
      } else {
        // 광고비가 아닌 경우: 기존 로직 (대분류 → 중분류 → 소분류)
        if (detail.cost_lv2 && detail.cost_lv2.trim() !== "") {
          const l2Key = `${l1Key}|${detail.cost_lv2}`;
          let l2Row = l2Map.get(l2Key);
          if (!l2Row) {
            l2Row = {
              id: `l2-${l1Key}-${detail.cost_lv2}`,
              level: 2,
              category_l1: l1Key,
              category_l2: detail.cost_lv2,
              category_l3: "",
              prev_month: 0,
              curr_month: 0,
              prev_ytd: 0,
              curr_ytd: 0,
              prev_year_annual: null,
              curr_year_annual: null,
              description: "",
              isExpanded: expandedRows.has(`l2-${l1Key}-${detail.cost_lv2}`),
              children: [],
            };
            l2Map.set(l2Key, l2Row);
            l1Row.children!.push(l2Row);
          }

          // 소분류 처리
          if (detail.cost_lv3 && detail.cost_lv3.trim() !== "") {
            const l3Key = `${l2Key}|${detail.cost_lv3}`;
            let l3Row = l3Map.get(l3Key);
            if (!l3Row) {
              l3Row = {
                id: `l3-${l1Key}-${detail.cost_lv2}-${detail.cost_lv3}`,
                level: 3,
                category_l1: l1Key,
                category_l2: detail.cost_lv2,
                category_l3: detail.cost_lv3,
                prev_month: 0,
                curr_month: 0,
                prev_ytd: 0,
                curr_ytd: 0,
                prev_year_annual: null,
                curr_year_annual: null,
                description: "",
                isExpanded: false,
              };
              l3Map.set(l3Key, l3Row);
              l2Row.children!.push(l3Row);
            }

            // 소분류에 금액 추가
            if (viewMode === "monthly") {
              l3Row.curr_month += detail.amount;
            } else {
              l3Row.curr_ytd += detail.amount;
            }
          } else {
            // 소분류가 없으면 중분류에 직접 추가
            if (viewMode === "monthly") {
              l2Row.curr_month += detail.amount;
            } else {
              l2Row.curr_ytd += detail.amount;
            }
          }
        } else {
          // 중분류가 없으면 대분류에 직접 추가
          if (viewMode === "monthly") {
            l1Row.curr_month += detail.amount;
          } else {
            l1Row.curr_ytd += detail.amount;
          }
        }
      }
    });

    // 전년 데이터는 이미 위에서 처리했으므로 여기서는 제거

    // 재귀적으로 하위 노드의 합계를 계산하는 헬퍼 함수
    const aggregateNode = (node: ExpenseAccountRow): {
      prevYtd: number;
      currYtd: number;
      prevYearAnnual: number;
      currYearAnnual: number;
    } => {
      if (!node.children || node.children.length === 0) {
        // 리프 노드: 자신의 값 반환
        return {
          prevYtd: node.prev_ytd,
          currYtd: node.curr_ytd,
          prevYearAnnual: node.prev_year_annual ?? 0,
          currYearAnnual: node.curr_year_annual ?? 0,
        };
      }

      // 하위 노드들의 집계값 계산
      const childAggs = node.children.map(aggregateNode);
      const prevYtdSum = childAggs.reduce((sum, agg) => sum + agg.prevYtd, 0);
      const currYtdSum = childAggs.reduce((sum, agg) => sum + agg.currYtd, 0);
      const prevYearAnnualSum = childAggs.reduce((sum, agg) => sum + agg.prevYearAnnual, 0);
      const currYearAnnualSum = childAggs.reduce((sum, agg) => sum + agg.currYearAnnual, 0);

      return {
        prevYtd: prevYtdSum,
        currYtd: currYtdSum,
        prevYearAnnual: prevYearAnnualSum,
        currYearAnnual: currYearAnnualSum,
      };
    };

    // 연간 계획 데이터 처리 (먼저 개별 노드에 할당)
    if (data.annual_data && data.annual_data.length > 0) {
      // 당년 연간 데이터
      const bizUnitFilter: BizUnitOrAll = bizUnit || "ALL";
      const currAnnualData = getAnnualData(bizUnitFilter, year, "", "", "", yearType);
      currAnnualData.forEach((annual) => {
        const l1Key = annual.cost_lv1 || "";
        const l1Row = l1Map.get(l1Key);
        if (l1Row) {
          const isAdExpense = l1Key === "광고비";
          const isInteriorDev = l1Key === "지급수수료" && annual.cost_lv2 === "인테리어 개발";
          const isTravelExpense = l1Key === "출장비" && (annual.cost_lv2 === "국내출장비" || annual.cost_lv2 === "해외출장비");
          
          if (isAdExpense) {
            // 광고비인 경우: L2(브랜드) 하위 L3(비용상세)에 할당, L3 합계 = L2
            const bizUnitKey = annual.biz_unit || "기타";
            
            if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
              const l2Key = `${l1Key}|${bizUnitKey}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
                  const l3Key = `${l2Key}|${annual.cost_lv2}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    l3Row.curr_year_annual = annual.annual_amount;
                  }
                } else {
                  l2Row.curr_year_annual = annual.annual_amount;
                }
              }
            } else {
              // 브랜드 페이지: 대분류 → 중분류 (사업부구분 스킵)
              if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
                const l2Key = `${l1Key}|${annual.cost_lv2}`;
                const l2Row = l2Map.get(l2Key);
                if (l2Row) {
                  l2Row.curr_year_annual = annual.annual_amount;
                }
              } else {
                l1Row.curr_year_annual = (l1Row.curr_year_annual || 0) + annual.annual_amount;
              }
            }
          } else if (isInteriorDev) {
            // 지급수수료 > 인테리어 개발인 경우
            if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
              const l2Key = `${l1Key}|${annual.cost_lv2}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                const bizUnitKey = annual.biz_unit || "기타";
                
                if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
                  // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
                  const l3Key = `${l2Key}|${bizUnitKey}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                      const l4Key = `${l3Key}|${annual.cost_lv3}`;
                      const l4Row = l3Map.get(l4Key);
                      if (l4Row) {
                        l4Row.curr_year_annual = annual.annual_amount;
                      }
                    } else {
                      l3Row.curr_year_annual = annual.annual_amount;
                    }
                  }
                } else {
                  // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
                  if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                    const l3Key = `${l2Key}|${annual.cost_lv3}`;
                    const l3Row = l3Map.get(l3Key);
                    if (l3Row) {
                      l3Row.curr_year_annual = annual.annual_amount;
                    }
                  } else {
                    l2Row.curr_year_annual = (l2Row.curr_year_annual || 0) + annual.annual_amount;
                  }
                }
              }
            }
          } else if (isTravelExpense) {
            // 출장비 > 국내출장비/해외출장비인 경우
            if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
              const l2Key = `${l1Key}|${annual.cost_lv2}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                const bizUnitKey = annual.biz_unit || "기타";
                
                if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
                  // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
                  const l3Key = `${l2Key}|${bizUnitKey}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                      const l4Key = `${l3Key}|${annual.cost_lv3}`;
                      const l4Row = l3Map.get(l4Key);
                      if (l4Row) {
                        l4Row.curr_year_annual = annual.annual_amount;
                      }
                    } else {
                      l3Row.curr_year_annual = annual.annual_amount;
                    }
                  }
                } else {
                  // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
                  if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                    const l3Key = `${l2Key}|${annual.cost_lv3}`;
                    const l3Row = l3Map.get(l3Key);
                    if (l3Row) {
                      l3Row.curr_year_annual = annual.annual_amount;
                    }
                  } else {
                    l2Row.curr_year_annual = (l2Row.curr_year_annual || 0) + annual.annual_amount;
                  }
                }
              }
            }
          } else {
            // 광고비가 아닌 경우: 기존 로직
            if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
              const l2Key = `${l1Key}|${annual.cost_lv2}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                  const l3Key = `${l2Key}|${annual.cost_lv3}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    l3Row.curr_year_annual = annual.annual_amount;
                  }
                } else {
                  l2Row.curr_year_annual = annual.annual_amount;
                }
              }
            } else {
              l1Row.curr_year_annual = annual.annual_amount;
            }
          }
        }
      });

      // 전년 연간 데이터
      // 2026년(예산)은 prevYearDetails(2025년 12월 YTD actual)에서 이미 처리했으므로 빈 배열
      // 그 외에는 연간 계획 데이터 사용
      const prevAnnualData = is2026AnnualOnly ? [] : getAnnualData(bizUnitFilter, year - 1, "", "", "", yearType);
      prevAnnualData.forEach((annual) => {
        const l1Key = annual.cost_lv1 || "";
        const l1Row = l1Map.get(l1Key);
        if (l1Row) {
          const isAdExpense = l1Key === "광고비";
          const isInteriorDev = l1Key === "지급수수료" && annual.cost_lv2 === "인테리어 개발";
          const isTravelExpense = l1Key === "출장비" && (annual.cost_lv2 === "국내출장비" || annual.cost_lv2 === "해외출장비");
          
          if (isAdExpense) {
            // 광고비인 경우: L2(브랜드) 하위 L3(비용상세)에 할당, L3 합계 = L2
            const bizUnitKey = annual.biz_unit || "기타";
            
            if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
              const l2Key = `${l1Key}|${bizUnitKey}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
                  const l3Key = `${l2Key}|${annual.cost_lv2}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    l3Row.prev_year_annual = annual.annual_amount;
                  }
                } else {
                  l2Row.prev_year_annual = annual.annual_amount;
                }
              }
            } else {
              // 브랜드 페이지: 대분류 → 중분류 (사업부구분 스킵)
              if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
                const l2Key = `${l1Key}|${annual.cost_lv2}`;
                const l2Row = l2Map.get(l2Key);
                if (l2Row) {
                  l2Row.prev_year_annual = annual.annual_amount;
                }
              } else {
                l1Row.prev_year_annual = (l1Row.prev_year_annual || 0) + annual.annual_amount;
              }
            }
          } else if (isInteriorDev) {
            // 지급수수료 > 인테리어 개발인 경우
            if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
              const l2Key = `${l1Key}|${annual.cost_lv2}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                const bizUnitKey = annual.biz_unit || "기타";
                
                if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
                  // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
                  const l3Key = `${l2Key}|${bizUnitKey}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                      const l4Key = `${l3Key}|${annual.cost_lv3}`;
                      const l4Row = l3Map.get(l4Key);
                      if (l4Row) {
                        l4Row.prev_year_annual = annual.annual_amount;
                      }
                    } else {
                      l3Row.prev_year_annual = annual.annual_amount;
                    }
                  }
                } else {
                  // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
                  if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                    const l3Key = `${l2Key}|${annual.cost_lv3}`;
                    const l3Row = l3Map.get(l3Key);
                    if (l3Row) {
                      l3Row.prev_year_annual = annual.annual_amount;
                    }
                  } else {
                    l2Row.prev_year_annual = (l2Row.prev_year_annual || 0) + annual.annual_amount;
                  }
                }
              }
            }
          } else if (isTravelExpense) {
            // 출장비 > 국내출장비/해외출장비인 경우
            if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
              const l2Key = `${l1Key}|${annual.cost_lv2}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                const bizUnitKey = annual.biz_unit || "기타";
                
                if (bizUnitFilter === "ALL" || bizUnitFilter === "법인") {
                  // 홈 페이지 & 법인 페이지: 대분류 → 중분류 → 사업부구분 → 소분류
                  const l3Key = `${l2Key}|${bizUnitKey}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                      const l4Key = `${l3Key}|${annual.cost_lv3}`;
                      const l4Row = l3Map.get(l4Key);
                      if (l4Row) {
                        l4Row.prev_year_annual = annual.annual_amount;
                      }
                    } else {
                      l3Row.prev_year_annual = annual.annual_amount;
                    }
                  }
                } else {
                  // 브랜드 페이지: 대분류 → 중분류 → 소분류 (사업부구분 스킵)
                  if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                    const l3Key = `${l2Key}|${annual.cost_lv3}`;
                    const l3Row = l3Map.get(l3Key);
                    if (l3Row) {
                      l3Row.prev_year_annual = annual.annual_amount;
                    }
                  } else {
                    l2Row.prev_year_annual = (l2Row.prev_year_annual || 0) + annual.annual_amount;
                  }
                }
              }
            }
          } else {
            // 광고비가 아닌 경우: 기존 로직
            if (annual.cost_lv2 && annual.cost_lv2.trim() !== "") {
              const l2Key = `${l1Key}|${annual.cost_lv2}`;
              const l2Row = l2Map.get(l2Key);
              if (l2Row) {
                if (annual.cost_lv3 && annual.cost_lv3.trim() !== "") {
                  const l3Key = `${l2Key}|${annual.cost_lv3}`;
                  const l3Row = l3Map.get(l3Key);
                  if (l3Row) {
                    l3Row.prev_year_annual = annual.annual_amount;
                  }
                } else {
                  l2Row.prev_year_annual = annual.annual_amount;
                }
              }
            } else {
              l1Row.prev_year_annual = annual.annual_amount;
            }
          }
        }
      });
    }

    // Level 3 합계 계산 (하위 Level 4 합계) - 모든 Level 3에 대해 처리
    // Level 3 합계를 먼저 계산해야 Level 2 합계 계산 시 올바른 값이 반영됨
    l3Map.forEach((l3Row) => {
      if (l3Row.level === 3 && l3Row.children && l3Row.children.length > 0) {
        if (viewMode === "monthly") {
          // 당월 모드: 소분류(level 4) 합계 계산
          let totalCurr = 0;
          let totalPrev = 0;
          l3Row.children.forEach((l4Row) => {
            totalCurr += l4Row.curr_month;
            totalPrev += l4Row.prev_month;
          });
          l3Row.curr_month = totalCurr;
          l3Row.prev_month = totalPrev;
        } else {
          // 누적(YTD) 모드: 재귀 집계 함수로 모든 하위 노드의 합계 계산 (연간 계획 포함)
          const aggregated = aggregateNode(l3Row);
          l3Row.prev_ytd = aggregated.prevYtd;
          l3Row.curr_ytd = aggregated.currYtd;
          l3Row.prev_year_annual = aggregated.prevYearAnnual > 0 ? aggregated.prevYearAnnual : null;
          l3Row.curr_year_annual = aggregated.currYearAnnual > 0 ? aggregated.currYearAnnual : null;
        }
      }
    });

    // 중분류 합계 계산 (하위 Level 3 합계) - 연간 계획 데이터 할당 후 실행
    // Level 3 합계 계산 후 실행하여 올바른 합계 반영
    l2Map.forEach((l2Row) => {
      if (l2Row.children && l2Row.children.length > 0) {
        if (viewMode === "monthly") {
          // 당월 모드: Level 3 합계 계산
          let totalCurr = 0;
          let totalPrev = 0;
          l2Row.children.forEach((l3Row) => {
            totalCurr += l3Row.curr_month;
            totalPrev += l3Row.prev_month;
          });
          l2Row.curr_month = totalCurr;
          l2Row.prev_month = totalPrev;
        } else {
          // 누적(YTD) 모드: 재귀 집계 함수로 모든 하위 노드의 합계 계산 (연간 계획 포함)
          const aggregated = aggregateNode(l2Row);
          l2Row.prev_ytd = aggregated.prevYtd;
          l2Row.curr_ytd = aggregated.currYtd;
          l2Row.prev_year_annual = aggregated.prevYearAnnual > 0 ? aggregated.prevYearAnnual : null;
          l2Row.curr_year_annual = aggregated.currYearAnnual > 0 ? aggregated.currYearAnnual : null;
        }
      }
    });

    // 대분류 합계 계산 (하위 Level 2 합계) - 연간 계획 데이터 할당 후 실행
    l1Map.forEach((l1Row) => {
      if (l1Row.children && l1Row.children.length > 0) {
        if (viewMode === "monthly") {
          // 당월 모드: 이미 계산된 Level 2 합계를 사용
          let totalCurr = 0;
          let totalPrev = 0;
          l1Row.children.forEach((l2Row) => {
            totalCurr += l2Row.curr_month;
            totalPrev += l2Row.prev_month;
          });
          l1Row.curr_month = totalCurr;
          l1Row.prev_month = totalPrev;
        } else {
          // 누적(YTD) 모드: 재귀 집계 함수로 모든 하위 노드의 합계 계산 (연간 계획 포함)
          const aggregated = aggregateNode(l1Row);
          l1Row.prev_ytd = aggregated.prevYtd;
          l1Row.curr_ytd = aggregated.currYtd;
          l1Row.prev_year_annual = aggregated.prevYearAnnual > 0 ? aggregated.prevYearAnnual : null;
          l1Row.curr_year_annual = aggregated.currYearAnnual > 0 ? aggregated.currYearAnnual : null;
        }
      }
    });

    // 2026(예산) 연간 전용 뷰: 2025년 연간(실적) = 2025년 12월 YTD 실적로 통일 (prev_ytd 사용)
    if (is2026AnnualOnly && !(viewMode === "monthly")) {
      const setPrevYearAnnualFromYtd = (row: ExpenseAccountRow) => {
        row.prev_year_annual = row.prev_ytd > 0 ? row.prev_ytd : null;
        row.children?.forEach(setPrevYearAnnualFromYtd);
      };
      l1Map.forEach(setPrevYearAnnualFromYtd);
    }

    // 대분류 순서 정의 (홈 대시보드와 동일)
    const categoryOrder = [
      "인건비",
      "복리후생비",
      "광고비",
      "수주회",
      "출장비",
      "지급수수료",
      "IT수수료",
      "감가상각비",
      "임차료",
      "세금과공과",
      "기타",
      "차량렌트비",
    ];

    // 사업부구분 순서 정의 (광고비의 경우)
    const bizUnitOrder = ["MLB", "KIDS", "DISCOVERY", "공통"];

    // 인건비 하위항목 순서 정의
    const laborCostOrder = ["기본급", "Red pack", "성과급충당금", "실제 지급 성과급", "잡급"];

    // 지급수수료 하위항목 순서 정의
    const paymentFeeOrder = ["인사", "법무", "재무", "Supply Chain", "Office Service", "인테리어 개발"];

    // 소분류 레벨 사업부구분 순서 정의 (경영지원 있는 경우 / 수주회는 경영지원 없음)
    const subcategoryOrderWithSupport = ["경영지원", "MLB", "KIDS", "DISCOVERY"];
    const subcategoryOrderNoSupport = ["MLB", "KIDS", "DISCOVERY"];

    // 광고비의 사업부구분 children 정렬
    l1Map.forEach((l1Row) => {
      if (l1Row.category_l1 === "광고비" && l1Row.children) {
        l1Row.children.sort((a, b) => {
          const bizUnitA = a.biz_unit || "";
          const bizUnitB = b.biz_unit || "";
          const indexA = bizUnitOrder.indexOf(bizUnitA);
          const indexB = bizUnitOrder.indexOf(bizUnitB);
          
          // 순서에 없는 항목은 맨 뒤로
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      }
      
      // 인건비의 중분류 children 정렬
      if (l1Row.category_l1 === "인건비" && l1Row.children) {
        l1Row.children.sort((a, b) => {
          const categoryA = a.category_l2 || "";
          const categoryB = b.category_l2 || "";
          const indexA = laborCostOrder.indexOf(categoryA);
          const indexB = laborCostOrder.indexOf(categoryB);
          
          // 순서에 없는 항목은 맨 뒤로
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      }

      // 지급수수료의 중분류 children 정렬
      if (l1Row.category_l1 === "지급수수료" && l1Row.children) {
        l1Row.children.sort((a, b) => {
          const categoryA = a.category_l2 || "";
          const categoryB = b.category_l2 || "";
          const indexA = paymentFeeOrder.indexOf(categoryA);
          const indexB = paymentFeeOrder.indexOf(categoryB);
          
          // 순서에 없는 항목은 맨 뒤로
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      }

      // IT수수료의 중분류 children 정렬 (당년도 금액 크기 순)
      if (l1Row.category_l1 === "IT수수료" && l1Row.children) {
        l1Row.children.sort((a, b) => {
          // viewMode에 따라 당년도 값 결정
          const valueA = viewMode === "monthly" ? (a.curr_month ?? 0) : (a.curr_ytd ?? 0);
          const valueB = viewMode === "monthly" ? (b.curr_month ?? 0) : (b.curr_ytd ?? 0);
          
          // 내림차순 (큰 금액부터)
          return valueB - valueA;
        });
      }
    });

    // 중분류의 소분류 children 정렬 (소분류가 있는 경우)
    l2Map.forEach((l2Row) => {
      if (l2Row.children && l2Row.children.length > 0) {
        const order = l2Row.category_l1 === "수주회" ? subcategoryOrderNoSupport : subcategoryOrderWithSupport;
        l2Row.children.sort((a, b) => {
          const subcategoryA = a.category_l3 || "";
          const subcategoryB = b.category_l3 || "";
          const indexA = order.indexOf(subcategoryA);
          const indexB = order.indexOf(subcategoryB);
          
          // 순서에 없는 항목은 맨 뒤로
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      }
    });

    // 순서에 따라 정렬
    const sortedL1Rows = Array.from(l1Map.values()).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.category_l1);
      const indexB = categoryOrder.indexOf(b.category_l1);
      
      // 순서에 없는 항목은 맨 뒤로
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });

    return sortedL1Rows;
  }, [bizUnit, year, month, viewMode, expandedRows, is2026AnnualOnly, yearType]);

  // 계층 데이터가 준비되면 부모에게 전달
  useEffect(() => {
    if (onHierarchyReady) {
      onHierarchyReady(hierarchicalData);
    }
  }, [hierarchicalData, onHierarchyReady]);

  // 평면화된 행 리스트 생성 (렌더링용) - 전년·당년 모두 없으면 해당 항목 숨김
  const flattenedRows = useMemo(() => {
    const result: ExpenseAccountRow[] = [];

    const traverse = (rows: ExpenseAccountRow[]) => {
      rows.forEach((row) => {
        let shouldHide = false;
        if (viewMode === "monthly") {
          shouldHide = (row.curr_month ?? 0) === 0 && (row.prev_month ?? 0) === 0;
        } else if (is2026AnnualOnly) {
          shouldHide = (row.prev_year_annual ?? 0) === 0 && (row.curr_year_annual ?? 0) === 0;
        } else {
          shouldHide = (row.prev_ytd ?? 0) === 0 && (row.curr_ytd ?? 0) === 0;
        }
        if (shouldHide) {
          if (row.isExpanded && row.children && row.children.length > 0) {
            traverse(row.children);
          }
          return;
        }

        result.push(row);
        if (row.isExpanded && row.children && row.children.length > 0) {
          traverse(row.children);
        }
      });
    };

    traverse(hierarchicalData);
    return result;
  }, [hierarchicalData, viewMode, is2026AnnualOnly]);

  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const expandAll = () => {
    // 대분류(level 1)까지만 펼치기
    const level1Ids = new Set<string>();
    hierarchicalData.forEach((row) => {
      // level 1이고 자식이 있는 경우만 추가
      if (row.level === 1 && row.children && row.children.length > 0) {
        level1Ids.add(row.id);
      }
    });
    setExpandedRows(level1Ids);
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const isAllExpanded = useMemo(() => {
    // 대분류(level 1)까지만 확인
    const level1Ids = new Set<string>();
    hierarchicalData.forEach((row) => {
      if (row.level === 1 && row.children && row.children.length > 0) {
        level1Ids.add(row.id);
      }
    });
    // level 1 행이 있고, 모두 펼쳐져 있는지 확인
    return level1Ids.size > 0 && Array.from(level1Ids).every((id) => expandedRows.has(id));
  }, [hierarchicalData, expandedRows]);

  const handleExpandCollapseAll = () => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  // 계산 헬퍼 함수
  const getDifference = (current: number, previous: number): number => {
    return current - previous;
  };

  const getYOY = (current: number, previous: number): number | null => {
    return calculateYOY(current, previous);
  };

  const getProgressRate = (ytd: number, annual: number | null): number | null => {
    if (annual === null || annual === 0) return null;
    return (ytd / annual) * 100;
  };

  const getYOYColor = (yoy: number | null): string => {
    if (yoy === null) return "text-gray-600";
    if (Math.abs(yoy - 100) < 0.1) return "text-gray-600";
    if (yoy > 100) return "text-red-500";
    return "text-blue-600";
  };

  // 차이금액 포맷 (양수는 +, 마이너스는 △로 표시)
  const formatDifference = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "-";
    }
    if (value === 0) {
      return "0";
    }
    if (value < 0) {
      // 마이너스는 △로 표시하고 절댓값 사용
      return `△${formatK(Math.abs(value))}`;
    }
    // 양수는 + 표시
    return `+${formatK(value)}`;
  };

  // 인건비 대분류 행의 설명 자동 계산 (기본급 설명 재사용)
  const calculateLaborCostDescription = (row: ExpenseAccountRow): string => {
    // 인건비 대분류(level 1)이고 당월 모드인 경우만 계산
    if (
      row.category_l1 !== "인건비" ||
      row.level !== 1 ||
      viewMode !== "monthly"
    ) {
      return "";
    }

    // 인건비 대분류의 children에서 기본급 행 찾기
    if (!row.children || row.children.length === 0) {
      return "";
    }

    const basicSalaryRow = row.children.find(
      (child) => child.category_l2 === "기본급"
    );

    if (!basicSalaryRow) {
      return "";
    }

    // 기본급 행의 설명 가져오기
    const basicSalaryDescription = calculateBasicSalaryDescription(basicSalaryRow);

    // 기본급 설명이 "-"이면 그대로 반환
    if (basicSalaryDescription === "-" || !basicSalaryDescription) {
      return "-";
    }

    // "인당 인건비"를 "인당 기본급"으로 치환
    return basicSalaryDescription.replace("인당 인건비", "인당 기본급");
  };

  // 인건비 > 기본급 행의 설명 자동 계산
  const calculateBasicSalaryDescription = (row: ExpenseAccountRow): string => {
    // 인건비 > 기본급이고 당월 모드인 경우만 계산
    if (
      row.category_l1 !== "인건비" ||
      row.category_l2 !== "기본급" ||
      viewMode !== "monthly"
    ) {
      return "";
    }

    try {
      // 헬퍼 함수: 특정 연도/월의 인원수 가져오기
      const getHeadcountForPeriod = (
        targetYear: number,
        targetMonth: number,
        targetSubcategory: string | null,
        isParent: boolean
      ): number | null => {
        if (isParent) {
          // 부모 행: 하위 행들의 인원수 합계
          if (!row.children || row.children.length === 0) {
            return null;
          }

          let sumHeadcount = 0;
          let hasValidHeadcount = false;

          for (const childRow of row.children) {
            if (childRow.level === 3 && childRow.category_l3) {
              const childSubcategory = childRow.category_l3;
              
              try {
                const categoryDetails = getCategoryDetail(
                  bizUnit === "ALL" ? "ALL" : bizUnit,
                  targetYear,
                  targetMonth,
                  "인건비",
                  "monthly",
                  yearType
                ).filter(
                  (detail) =>
                    detail.cost_lv2 === "기본급" &&
                    detail.cost_lv3 === childSubcategory
                );

                const filteredDetails =
                  bizUnit === "ALL"
                    ? categoryDetails
                    : categoryDetails.filter((detail) => detail.biz_unit === bizUnit);

                if (filteredDetails.length > 0) {
                  const matchedDetail = filteredDetails.find((d) => d.headcount && d.headcount > 0);
                  if (matchedDetail && matchedDetail.headcount) {
                    sumHeadcount += matchedDetail.headcount;
                    hasValidHeadcount = true;
                  }
                }
              } catch (e) {
                console.warn(`하위 인원수 조회 실패: ${childSubcategory}`, e);
              }
            }
          }

          return hasValidHeadcount ? sumHeadcount : null;
        } else {
          // 하위 행: 특정 소분류의 인원수
          if (!targetSubcategory) {
            return null;
          }

          try {
            const categoryDetails = getCategoryDetail(
              bizUnit === "ALL" ? "ALL" : bizUnit,
              targetYear,
              targetMonth,
              "인건비",
              "monthly",
              yearType
            ).filter(
              (detail) =>
                detail.cost_lv2 === "기본급" &&
                detail.cost_lv3 === targetSubcategory
            );

            const filteredDetails =
              bizUnit === "ALL"
                ? categoryDetails
                : categoryDetails.filter((detail) => detail.biz_unit === bizUnit);

            if (filteredDetails.length > 0) {
              const matchedDetail = filteredDetails.find((d) => d.headcount && d.headcount > 0);
              if (matchedDetail && matchedDetail.headcount) {
                return matchedDetail.headcount;
              }
            }
          } catch (e) {
            console.warn(`인원수 조회 실패: ${targetSubcategory}`, e);
          }

          return null;
        }
      };

      // 당월 인원수 가져오기
      const targetSubcategory = row.level === 3 ? row.category_l3 : null;
      const isParent = row.level === 2;
      const currHeadcount = getHeadcountForPeriod(year, month, targetSubcategory, isParent);

      // 인원수가 0이거나 null이면 "-" 반환
      if (currHeadcount === null || currHeadcount === 0 || isNaN(currHeadcount)) {
        return "-";
      }

      // 전년 인원수 가져오기 (전년 동일월)
      const prevHeadcount = getHeadcountForPeriod(year - 1, month, targetSubcategory, isParent);

      // 당년 인당 인건비 계산
      const currAmount = row.curr_month;
      const currPerPersonCostK = currAmount / currHeadcount / 1000; // K 단위

      // 전년 인당 인건비 계산
      const prevAmount = row.prev_month;
      let prevPerPersonCostK: number | null = null;
      let yoyPercent: number | null = null;

      if (
        prevHeadcount !== null &&
        prevHeadcount > 0 &&
        !isNaN(prevHeadcount) &&
        prevAmount !== null &&
        prevAmount !== undefined &&
        !isNaN(prevAmount)
      ) {
        prevPerPersonCostK = prevAmount / prevHeadcount / 1000; // K 단위

        // YOY 계산: (당년 / 전년 - 1) × 100
        if (prevPerPersonCostK > 0) {
          yoyPercent = (currPerPersonCostK / prevPerPersonCostK - 1) * 100;
        }
      }

      // 포맷팅
      let result = `[당월 인원수 ${Math.round(currHeadcount)}명`;

      // 전년 동월 대비 인원수 증감 계산 및 표시
      // prevHeadcount는 이미 1544번 라인에서 getHeadcountForPeriod(year - 1, month, ...)로 파일에서 읽어온 값
      if (prevHeadcount !== null && prevHeadcount > 0 && !isNaN(prevHeadcount)) {
        const headcountDiff = currHeadcount - prevHeadcount;
        if (headcountDiff !== 0) {
          const diffSign = headcountDiff > 0 ? "+" : "";
          result += `, 전년비 ${diffSign}${Math.round(headcountDiff)}명`;
        } else {
          result += `, 전년비 0명`;
        }
      }

      result += ` | 인당 인건비 ${currPerPersonCostK.toFixed(1)}K`;

      if (yoyPercent !== null && !isNaN(yoyPercent)) {
        // 전년비 표시
        const sign = yoyPercent >= 0 ? "+" : "△";
        const absYoy = Math.abs(yoyPercent);
        result += `, 전년비 ${sign}${absYoy.toFixed(1)}%`;
      } else {
        // 전년비 계산 불가
        result += `, 전년비 -`;
      }

      result += `]`;
      return result;
    } catch (error) {
      console.error("기본급 설명 계산 오류:", error);
      return "-";
    }
  };

  // YOY 포맷 (소수점 없이)
  const formatYOY = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "-";
    }
    return `${Math.round(value)}%`;
  };

  // Leaf 노드만 추출하는 함수
  const getLeafNodes = (rows: ExpenseAccountRow[]): ExpenseAccountRow[] => {
    const leaves: ExpenseAccountRow[] = [];
    const traverse = (nodes: ExpenseAccountRow[]) => {
      nodes.forEach((node) => {
        if (!node.children || node.children.length === 0) {
          // Leaf 노드
          leaves.push(node);
        } else {
          // 자식이 있으면 재귀적으로 탐색
          traverse(node.children);
        }
      });
    };
    traverse(rows);
    return leaves;
  };

  // 전체 합계 계산 함수
  const computeTotals = useMemo(() => {
    const leaves = getLeafNodes(hierarchicalData);
    
    if (viewMode === "monthly") {
      // 당월 모드
      const prevTotal = leaves.reduce((sum, leaf) => sum + leaf.prev_month, 0);
      const currTotal = leaves.reduce((sum, leaf) => sum + leaf.curr_month, 0);
      const diffTotal = currTotal - prevTotal;
      const yoyTotal = prevTotal > 0 ? (currTotal / prevTotal) * 100 : null;
      
      return {
        prevTotal,
        currTotal,
        diffTotal,
        yoyTotal,
        prevYtdTotal: null,
        currYtdTotal: null,
        diffYtdTotal: null,
        yoyYtdTotal: null,
        planDiffTotal: null,
        annual2024Total: null,
        annual2025Total: null,
        diffAnnualTotal: null,
        yoyAnnualTotal: null,
        progressTotal: null,
      };
    } else {
      // 누적(YTD) 모드: 전체 합계 = 표시되는 L1(대분류) 행 합계와 정확히 일치하도록 L1 기준으로 계산
      const prevYtdTotal = hierarchicalData.reduce((sum, row) => sum + row.prev_ytd, 0);
      const currYtdTotal = hierarchicalData.reduce((sum, row) => sum + row.curr_ytd, 0);
      const diffYtdTotal = currYtdTotal - prevYtdTotal;
      const yoyYtdTotal = prevYtdTotal > 0 ? (currYtdTotal / prevYtdTotal) * 100 : null;

      // 2026(예산) 연간 전용: 전체 합계는 KPI와 동일 출처 사용 (2025=monthly_total 12월 YTD, 2026=annual_data 연간 합계)
      let annual2024Total: number;
      let annual2025Total: number;
      if (is2026AnnualOnly && bizUnit !== "ALL") {
        annual2024Total = getMonthlyTotal(bizUnit as BizUnit, 2025, 12, "ytd", "actual")?.amount ?? 0;
        annual2025Total = hierarchicalData.reduce((sum, row) => sum + (row.curr_year_annual ?? row.curr_ytd ?? 0), 0);
      } else {
        annual2024Total = hierarchicalData.reduce((sum, row) => sum + (row.prev_year_annual ?? 0), 0);
        annual2025Total = hierarchicalData.reduce((sum, row) => sum + (is2026AnnualOnly ? (row.curr_year_annual ?? row.curr_ytd ?? 0) : (row.curr_year_annual ?? 0)), 0);
      }
      const diffAnnualTotal = annual2025Total - annual2024Total;
      const yoyAnnualTotal = annual2024Total > 0 ? (annual2025Total / annual2024Total) * 100 : null;
      const progressTotal = annual2025Total > 0 ? (currYtdTotal / annual2025Total) * 100 : null;
      const planDiffTotal = currYtdTotal - annual2025Total;
      
      return {
        prevTotal: null,
        currTotal: null,
        diffTotal: null,
        yoyTotal: null,
        prevYtdTotal,
        currYtdTotal,
        diffYtdTotal,
        yoyYtdTotal,
        planDiffTotal,
        annual2024Total,
        annual2025Total,
        diffAnnualTotal,
        yoyAnnualTotal,
        progressTotal,
      };
    }
  }, [hierarchicalData, viewMode, is2026AnnualOnly, bizUnit]);

  // 2026 연간 뷰 시 부모에 연간 합계 전달 (KPI 카드 등에서 표 합계 재사용용)
  useEffect(() => {
    if (
      is2026AnnualOnly &&
      bizUnit !== "ALL" &&
      onAnnualTotalsChange &&
      computeTotals.annual2024Total != null &&
      computeTotals.annual2025Total != null
    ) {
      onAnnualTotalsChange({
        prevYear: computeTotals.annual2024Total,
        currYear: computeTotals.annual2025Total,
      });
    }
  }, [is2026AnnualOnly, bizUnit, onAnnualTotalsChange, computeTotals]);

  // 전체 합계의 대분류별 당월 차이 설명 자동 생성 (항상 당월 기준)
  const totalDescription = useMemo(() => {
    if (hierarchicalData.length === 0) return "-";
    
    // 대분류별 당월 차이 계산
    const diffs: { name: string; diff: number }[] = hierarchicalData.map((l1Row) => ({
      name: l1Row.category_l1,
      diff: l1Row.curr_month - l1Row.prev_month,
    }));
    
    // 차이가 0이 아닌 항목만 필터링하고 절대값 기준 내림차순 정렬
    const significantDiffs = diffs
      .filter((d) => Math.abs(d.diff) >= 1000) // 1K 이상만 표시
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    
    if (significantDiffs.length === 0) return "-";
    
    // 포맷팅: "광고비 +225K, 인건비 △444K, ..."
    const formatted = significantDiffs.map((d) => {
      const sign = d.diff >= 0 ? "+" : "△";
      const absValue = Math.abs(d.diff);
      return `${d.name} ${sign}${formatK(absValue)}`;
    });
    
    return formatted.join(", ");
  }, [hierarchicalData]);

  // YOY/진척률 Badge 스타일 함수
  const getYOYBadgeClass = (value: number | null): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "inline-flex items-center rounded-full px-2 py-0.5 text-[15px] font-semibold bg-gray-100 text-gray-500";
    }
    if (value >= 100) {
      return "inline-flex items-center rounded-full px-2 py-0.5 text-[15px] font-semibold bg-pink-100 text-pink-700";
    }
    return "inline-flex items-center rounded-full px-2 py-0.5 text-[15px] font-semibold bg-blue-100 text-blue-700";
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden backdrop-blur-sm">
      {/* 상단 헤더 */}
      <div className="bg-slate-800 border-b-2 border-slate-600">
        <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <div className="flex items-center justify-between">
            {/* 왼쪽: 제목 + 날짜 태그 */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <h2 className="font-bold text-slate-50 text-[12px] sm:text-[13.5px] md:text-[15px] lg:text-[21px] xl:text-[24px]">
                {title || "전체 비용 계정 상세 분석"}
              </h2>
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-1.5 rounded-full border border-slate-600 bg-slate-700/50">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-200" />
                <span className="text-[13.5px] sm:text-[15px] font-medium text-slate-200">{is2026AnnualOnly ? "2026년 연간기준" : `${year}년 ${month}월 기준`}</span>
              </div>
            </div>
            {/* 우측: 탭과 버튼 */}
            <div className="flex items-center gap-2 sm:gap-3">
              {!is2026AnnualOnly && (
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "monthly" | "ytd" | "annual")}>
                  <TabsList className="bg-slate-700/50 p-1 sm:p-1.5 rounded-xl border border-slate-600 shadow-md">
                    <TabsTrigger 
                      value="monthly"
                      className="px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-[13.5px] sm:text-[15px] transition-all duration-300 ease-in-out hover:bg-slate-600 hover:shadow-sm data-[active=true]:bg-slate-600 data-[active=true]:text-slate-50 data-[active=true]:shadow-lg data-[active=true]:scale-105 text-slate-200 data-[active=false]:text-slate-300"
                    >
                      당월
                    </TabsTrigger>
                    <TabsTrigger 
                      value="ytd"
                      className="px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-[13.5px] sm:text-[15px] transition-all duration-300 ease-in-out hover:bg-slate-600 hover:shadow-sm data-[active=true]:bg-slate-600 data-[active=true]:text-slate-50 data-[active=true]:shadow-lg data-[active=true]:scale-105 text-slate-200 data-[active=false]:text-slate-300"
                    >
                      누적(YTD)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {is2026AnnualOnly && (
                <span className="text-[13.5px] sm:text-[15px] font-medium text-slate-200 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg border border-slate-600 bg-slate-700/50">
                  연간 계획 (2025 실적 vs 2026 계획)
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExpandCollapseAll}
                className="flex items-center gap-2 min-w-[100px] sm:min-w-[120px] md:min-w-[140px] justify-center px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-slate-50 font-medium shadow-md hover:shadow-lg transition-all duration-200 text-[13.5px] sm:text-[15px]"
              >
                <ChevronsDownUp className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="whitespace-nowrap">{isAllExpanded ? "모두 접기" : "모두 펼치기"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={requestReset}
                className="flex items-center gap-2 min-w-[80px] sm:min-w-[90px] justify-center px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-slate-50 font-medium shadow-md hover:shadow-lg transition-all duration-200 text-[13.5px] sm:text-[15px]"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="whitespace-nowrap">초기화</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto bg-white">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {viewMode === "monthly" && !is2026AnnualOnly ? (
              <>
                {/* 당월 모드: 구분 15% + 당월 데이터 4개 각 10% + 설명 45% */}
                <col style={{ width: "15%" }} />
                <col style={{ width: "0%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "0%" }} />
                <col style={{ width: "45%" }} />
              </>
            ) : is2026AnnualOnly ? (
              <>
                {/* 2026 연간만: 구분 20%, 전년/당년/차이/YOY 각 6%, 계산근거·설명 각 28% */}
                <col style={{ width: "20%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "28%" }} />
              </>
            ) : (
              <>
                {/* 누적(YTD) 모드: 구분 13% + 숫자 데이터 10개 각 6% + 설명 27% */}
                <col style={{ width: "13%" }} />
                <col style={{ width: "0%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "0%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "0%" }} />
                <col style={{ width: "27%" }} />
              </>
            )}
          </colgroup>
          <thead className="sticky top-0 z-10">
            {/* 첫 번째 헤더 행 */}
            <tr className="bg-slate-800 border-b border-slate-600">
              {is2026AnnualOnly ? (
                <>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-left text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">구분</th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    <div>{year - 1}년 연간</div>
                    <div>(실적)</div>
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    <div>{year}년 연간</div>
                    <div>(계획)</div>
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">차이(금액)</th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">YOY(%)</th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">계산근거</th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-left text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">설명</th>
                </>
              ) : (
                <>
              <th rowSpan={2} className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-left text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                구분
              </th>
              <th className="border-r border-slate-600"></th>
              {viewMode === "monthly" ? (
                <>
                  <th colSpan={4} className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    당월 데이터
                  </th>
                  <th className="border-r border-slate-600"></th>
                  <th rowSpan={2} className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-left text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    설명
                  </th>
                </>
              ) : (
                <>
                  <th colSpan={6} className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    누적(YTD)
                  </th>
                  <th className="border-r border-slate-600"></th>
                  <th colSpan={4} className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    연간 계획
                  </th>
                  <th className="border-r border-slate-600"></th>
                  <th rowSpan={2} className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-left text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    설명
                  </th>
                </>
              )}
                </>
              )}
            </tr>
            {/* 두 번째 헤더 행: 2026 연간만일 때는 렌더하지 않음 (헤더 1줄) */}
            {!is2026AnnualOnly && (
            <tr className="bg-slate-800 border-b-2 border-slate-600">
              <th className="border-r border-slate-600"></th>
              {viewMode === "monthly" ? (
                <>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    전년
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    당월
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    차이(금액)
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    YOY (%)
                  </th>
                  <th className="border-r border-slate-600"></th>
                </>
              ) : (
                <>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    전년누적
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    당년누적
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    차이(금액)
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    YOY (%)
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    계획비 증감
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    계획비 (%)
                  </th>
                  <th className="border-r border-slate-600"></th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    {year - 1}년 연간
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    {year}년 연간
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    차이(금액)
                  </th>
                  <th className="border-r border-slate-600 px-2 py-1.5 sm:px-3 sm:py-2 text-center text-[12px] sm:text-[13.5px] md:text-[15px] font-semibold text-slate-50">
                    YOY (%)
                  </th>
                  <th className="border-r border-slate-600"></th>
                </>
              )}
            </tr>
            )}
          </thead>
          <tbody>
            {/* 전체 합계 행 */}
            <tr className="bg-indigo-50 border-b border-indigo-100">
              <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] font-semibold text-gray-800">
                <div className="flex items-center gap-2">
                  <PieChart className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600" />
                  <span>전체 합계</span>
                </div>
              </td>
              {!is2026AnnualOnly && <td className="border-r border-gray-200"></td>}
              {is2026AnnualOnly ? (
                <>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.annual2024Total)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.annual2025Total)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatDifference(computeTotals.diffAnnualTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right">
                    <span className={getYOYBadgeClass(computeTotals.yoyAnnualTotal)}>
                      {formatYOY(computeTotals.yoyAnnualTotal)}
                    </span>
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-500">-</td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600">
                    {totalDescription}
                  </td>
                </>
              ) : viewMode === "monthly" ? (
                <>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.prevTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.currTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatDifference(computeTotals.diffTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right">
                    <span className={getYOYBadgeClass(computeTotals.yoyTotal)}>
                      {formatYOY(computeTotals.yoyTotal)}
                    </span>
                  </td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600">
                    {totalDescription}
                  </td>
                </>
              ) : (
                <>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.prevYtdTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.currYtdTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatDifference(computeTotals.diffYtdTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right">
                    <span className={getYOYBadgeClass(computeTotals.yoyYtdTotal)}>
                      {formatYOY(computeTotals.yoyYtdTotal)}
                    </span>
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium bg-teal-50">
                    {formatDifference(computeTotals.planDiffTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right bg-teal-50">
                    <span className={getYOYBadgeClass(computeTotals.progressTotal)}>
                      {formatYOY(computeTotals.progressTotal)}
                    </span>
                  </td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.annual2024Total)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatK(computeTotals.annual2025Total)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                    {formatDifference(computeTotals.diffAnnualTotal)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right">
                    <span className={getYOYBadgeClass(computeTotals.yoyAnnualTotal)}>
                      {formatYOY(computeTotals.yoyAnnualTotal)}
                    </span>
                  </td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600">
                    {totalDescription}
                  </td>
                </>
              )}
            </tr>
            {flattenedRows.map((row) => {
              const hasChildren = row.children && row.children.length > 0;
              
              // 들여쓰기 및 폰트 스타일 결정
              const getIndentClass = (level: number): string => {
                if (level === 1) return "pl-2";
                if (level === 2) return "pl-8";  // 적당한 들여쓰기
                if (level === 3) return "pl-12";
                return "pl-16"; // level 4
              };
              
              const getFontWeight = (level: number): string => {
                if (level === 1) return "font-bold";
                if (level === 2) return "font-semibold";
                return "font-normal";
              };
              
              // 표시할 텍스트 결정
              const getDisplayText = (row: ExpenseAccountRow): string => {
                if (row.level === 1) return row.category_l1 || "-";
                if (row.level === 2) {
                  // 광고비의 경우 level 2는 사업부구분
                  if (row.category_l1 === "광고비" && row.biz_unit) {
                    return row.biz_unit;
                  }
                  // 지급수수료 > 인테리어 개발의 경우 level 2는 중분류(인테리어 개발)
                  if (row.category_l1 === "지급수수료" && row.category_l2 === "인테리어 개발") {
                    return row.category_l2 || "-";
                  }
                  // 출장비 > 국내출장비/해외출장비의 경우 level 2는 중분류
                  if (row.category_l1 === "출장비" && (row.category_l2 === "국내출장비" || row.category_l2 === "해외출장비")) {
                    return row.category_l2 || "-";
                  }
                  return row.category_l2 || "-";
                }
                if (row.level === 3) {
                  // 광고비의 경우 level 3는 중분류
                  if (row.category_l1 === "광고비") {
                    return row.category_l2 || "-";
                  }
                  // 지급수수료 > 인테리어 개발의 경우 level 3는 사업부구분
                  if (row.category_l1 === "지급수수료" && row.category_l2 === "인테리어 개발" && row.biz_unit) {
                    return row.biz_unit;
                  }
                  // 출장비 > 국내출장비/해외출장비의 경우 level 3는 사업부구분
                  if (row.category_l1 === "출장비" && (row.category_l2 === "국내출장비" || row.category_l2 === "해외출장비") && row.biz_unit) {
                    return row.biz_unit;
                  }
                  // 일반적인 경우 level 3는 소분류
                  return row.category_l3 || "-";
                }
                // level 4: 지급수수료 > 인테리어 개발 또는 출장비 > 국내출장비/해외출장비의 경우 소분류
                if (row.level === 4) {
                  return row.category_l3 || "-";
                }
                return row.category_l3 || "-";
              };
              
              const indentClass = getIndentClass(row.level);
              const fontWeight = getFontWeight(row.level);
              const displayText = getDisplayText(row);

              const prevValue = (viewMode === "monthly" ? row.prev_month : row.prev_ytd) ?? 0;
              const currValue = (viewMode === "monthly" ? row.curr_month : row.curr_ytd) ?? 0;
              const diff = getDifference(currValue, prevValue);
              const yoy = getYOY(currValue, prevValue);

              // 2026(예산) 시 연간 계획 컬럼: 연간 예산(annual_data)만 사용, curr_ytd fallback 제거
              const effectiveCurrAnnual = is2026AnnualOnly ? row.curr_year_annual : (row.curr_year_annual ?? row.curr_ytd);

              // 진척률 계산 (누적 모드에서만 사용)
              // 진척률(%) = 당년누적 / 2025년 연간 * 100
              const progressRate = viewMode === "ytd" 
                ? getProgressRate(currValue, effectiveCurrAnnual)
                : null;

              // 계획비 증감 계산 (누적 모드에서만 사용)
              // 계획비 증감 = 당년누적 - 2025년 연간
              const planDiff = viewMode === "ytd" && effectiveCurrAnnual !== null
                ? currValue - effectiveCurrAnnual
                : null;

              // 연간 계획 데이터 계산 (누적 모드에서만 사용). 없으면 0으로 간주해 차액 계산
              const annualDiff = viewMode === "ytd"
                ? getDifference(effectiveCurrAnnual ?? 0, row.prev_year_annual ?? 0)
                : null;
              const annualYOY = viewMode === "ytd" ? getYOY(
                effectiveCurrAnnual ?? 0,
                row.prev_year_annual ?? 0
              ) : null;

              // 대분류(L1) 연한 하늘색, 그다음 분류(L2) 연한 회색
              const isLevel1 = row.level === 1;
              const isLevel2 = row.level === 2;
              
              return (
                <tr
                  key={row.id}
                  className={`transition-colors duration-150 cursor-pointer border-b border-gray-100 ${
                    isLevel1 
                      ? "bg-sky-50 hover:bg-sky-100" 
                      : isLevel2 
                        ? "bg-gray-100 hover:bg-gray-200"
                        : "hover:bg-blue-50/50"
                  }`}
                  onClick={() => hasChildren && toggleRow(row.id)}
                >
                  {/* 구분 영역 (단일 컬럼, 들여쓰기로 계층 표현) */}
                  <td
                    className={`border-r border-gray-100 pr-2 py-1.5 sm:pr-3 sm:py-2 text-[13.5px] sm:text-[15px] ${fontWeight} ${indentClass} transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      {hasChildren && (
                        <span className="flex-shrink-0">
                          {row.isExpanded ? (
                            <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
                          ) : (
                            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                          )}
                        </span>
                      )}
                      {!hasChildren && <span className="w-4" />}
                      <span>{displayText}</span>
                    </div>
                  </td>
                  {!is2026AnnualOnly && <td className="border-r border-gray-200"></td>}
                  
                  {/* 당월/누적 데이터 영역 */}
                  {viewMode === "monthly" ? (
                    <>
                      {/* 당월 모드: 전년, 당월, 차이, YOY */}
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatK(prevValue)}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatK(currValue)}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatDifference(diff)}
                      </td>
                      <td className={`border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium ${getYOYColor(yoy)}`}>
                        {yoy != null ? formatYOY(yoy) : formatDifference(diff)}
                      </td>
                      <td className="border-r border-gray-200"></td>
                      {/* 설명 (편집 가능) */}
                      <td 
                        className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600 relative group"
                        onClick={(e) => {
                          // 편집 모드가 아니고, 편집 버튼이 아닌 경우에만 편집 시작
                          if (editingRowId !== row.id && !(e.target as HTMLElement).closest('button')) {
                            const currentDesc = descriptions.get(row.id) || row.description || "";
                            startEdit(row.id, currentDesc);
                          }
                        }}
                      >
                        {editingRowId === row.id ? (
                          <div className="flex items-center gap-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) {
                                  requestSaveEdit(row.id);
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestSaveEdit(row.id);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="저장 (Ctrl+Enter)"
                              >
                                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="취소 (Esc)"
                              >
                                <X className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1 min-w-0">
                              {(() => {
                                // 인건비 대분류(level 1) 행의 경우 자동 계산된 설명 우선 표시
                                const laborCostDescription = calculateLaborCostDescription(row);
                                if (laborCostDescription) {
                                  return laborCostDescription;
                                }
                                // 인건비 > 기본급 행의 경우 자동 계산된 설명 우선 표시
                                const autoDescription = calculateBasicSalaryDescription(row);
                                if (autoDescription) {
                                  return autoDescription;
                                }
                                // 그 외의 경우 저장된 설명 또는 기본 설명 표시
                                return descriptions.get(row.id) || row.description || "-";
                              })()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentDesc = descriptions.get(row.id) || row.description || "";
                                  startEdit(row.id, currentDesc);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                                title="편집"
                              >
                                <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </>
                  ) : is2026AnnualOnly ? (
                    <>
                      {/* 2026 연간만: 2025 실적, 2026 계획(금액만), 차이, YOY, 계산근거, 설명 */}
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatK(row.prev_year_annual)}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {effectiveCurrAnnual != null ? formatK(effectiveCurrAnnual) : "-"}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatDifference(annualDiff)}
                      </td>
                      <td className={`border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium ${getYOYColor(annualYOY)}`}>
                        {annualYOY != null ? formatYOY(annualYOY) : formatDifference(annualDiff)}
                      </td>
                      {/* 계산근거 (텍스트 편집 가능) */}
                      <td
                        className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600 relative group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {basisPopoverRowId === row.id ? (
                          <div className="absolute left-0 top-0 z-20 min-w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                            <p className="text-xs font-semibold text-slate-700 mb-2">계산 근거 (연간 계획)</p>
                            <textarea
                              value={basisEditValue}
                              onChange={(e) => setBasisEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") closeBasisPopover();
                              }}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => closeBasisPopover()}
                                className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => requestSaveBasis(row.id)}
                                className="px-2 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1 min-w-0">{basisMap.get(row.id) || "-"}</span>
                            <button
                              type="button"
                              title="계산 근거 편집 (클릭)"
                              onClick={() => openBasisPopover(row.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                            >
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      {/* 설명 (편집 가능) */}
                      <td
                        className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600 relative group"
                        onClick={(e) => {
                          if (editingRowId !== row.id && !(e.target as HTMLElement).closest("button")) {
                            startEdit(row.id, descriptions.get(row.id) || row.description || "");
                          }
                        }}
                      >
                        {editingRowId === row.id ? (
                          <div className="flex items-center gap-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) requestSaveEdit(row.id);
                                else if (e.key === "Escape") cancelEdit();
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col gap-1">
                              <button onClick={(e) => { e.stopPropagation(); requestSaveEdit(row.id); }} className="p-1 text-green-600 hover:bg-green-50 rounded" title="저장"><Check className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="p-1 text-red-600 hover:bg-red-50 rounded" title="취소"><X className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1 min-w-0">{descriptions.get(row.id) || row.description || "-"}</span>
                            <button onClick={(e) => { e.stopPropagation(); startEdit(row.id, descriptions.get(row.id) || row.description || ""); }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity" title="편집"><Edit2 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                          </div>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* 누적(YTD) 모드: 전년누적, 당년누적, 차이, YOY, 계획비 증감, 계획비(%) */}
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatK(prevValue)}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatK(currValue)}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatDifference(diff)}
                      </td>
                      <td className={`border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium ${getYOYColor(yoy)}`}>
                        {yoy != null ? formatYOY(yoy) : formatDifference(diff)}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium bg-teal-50">
                        {formatDifference(planDiff)}
                      </td>
                      <td className={`border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium bg-teal-50 ${getYOYColor(progressRate)}`}>
                        {formatYOY(progressRate)}
                      </td>
                      <td className="border-r border-gray-200"></td>
                      {/* 연간 계획 영역 */}
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatK(row.prev_year_annual)}
                      </td>
                      <td
                        className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {basisPopoverRowId === row.id ? (
                          <div className="absolute right-0 top-0 z-20 min-w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                            <p className="text-xs font-semibold text-slate-700 mb-2">계산 근거 (연간 계획)</p>
                            <textarea
                              value={basisEditValue}
                              onChange={(e) => setBasisEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") closeBasisPopover();
                              }}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => closeBasisPopover()}
                                className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => requestSaveBasis(row.id)}
                                className="px-2 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span>{row.curr_year_annual != null ? formatK(row.curr_year_annual) : "-"}</span>
                            <button
                              type="button"
                              title={basisMap.get(row.id) || "계산 근거 입력 (클릭)"}
                              onClick={() => openBasisPopover(row.id)}
                              className="p-0.5 text-slate-400 hover:text-blue-600 rounded"
                            >
                              <Info className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium">
                        {formatDifference(annualDiff)}
                      </td>
                      <td className={`border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-right font-medium ${getYOYColor(annualYOY)}`}>
                        {annualYOY != null ? formatYOY(annualYOY) : formatDifference(annualDiff)}
                      </td>
                      <td className="border-r border-gray-200"></td>
                      {/* 설명 (편집 가능) */}
                      <td 
                        className="border-r border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 text-[13.5px] sm:text-[15px] text-gray-600 relative group"
                        onClick={(e) => {
                          // 편집 모드가 아니고, 편집 버튼이 아닌 경우에만 편집 시작
                          if (editingRowId !== row.id && !(e.target as HTMLElement).closest('button')) {
                            const currentDesc = descriptions.get(row.id) || row.description || "";
                            startEdit(row.id, currentDesc);
                          }
                        }}
                      >
                        {editingRowId === row.id ? (
                          <div className="flex items-center gap-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) {
                                  requestSaveEdit(row.id);
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestSaveEdit(row.id);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="저장 (Ctrl+Enter)"
                              >
                                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="취소 (Esc)"
                              >
                                <X className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1 min-w-0">
                              {(() => {
                                // 인건비 대분류(level 1) 행의 경우 자동 계산된 설명 우선 표시 (당월 모드만)
                                const laborCostDescription = calculateLaborCostDescription(row);
                                if (laborCostDescription) {
                                  return laborCostDescription;
                                }
                                // 인건비 > 기본급 행의 경우 자동 계산된 설명 우선 표시 (당월 모드만)
                                const autoDescription = calculateBasicSalaryDescription(row);
                                if (autoDescription) {
                                  return autoDescription;
                                }
                                // 그 외의 경우 저장된 설명 또는 기본 설명 표시
                                return descriptions.get(row.id) || row.description || "-";
                              })()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentDesc = descriptions.get(row.id) || row.description || "";
                                  startEdit(row.id, currentDesc);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                                title="편집"
                              >
                                <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    <PasswordModal
      open={passwordModalOpen}
      onClose={() => {
        setPasswordModalOpen(false);
        setPendingSaveType(null);
        setPendingRowId(null);
      }}
      onConfirm={handlePasswordConfirm}
    />
    </>
  );
}

