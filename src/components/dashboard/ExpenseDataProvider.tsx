"use client";

import React, { useEffect, useState } from "react";
import { setExpenseData, type AggregatedData } from "@/lib/expenseData";

interface ExpenseDataProviderProps {
  children: React.ReactNode;
}

export function ExpenseDataProvider({ children }: ExpenseDataProviderProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/expense-data")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: AggregatedData) => {
        setExpenseData(data);
        setLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
        <div className="text-center p-8 rounded-lg bg-slate-800 max-w-md">
          <p className="text-red-400 font-medium">비용 데이터를 불러올 수 없습니다.</p>
          <p className="text-slate-400 mt-2 text-sm">{error}</p>
          <p className="text-slate-500 mt-4 text-xs">
            CSV 파일이 <code className="bg-slate-700 px-1 rounded">파일</code> 폴더에 있는지 확인하고 새로고침해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto" />
          <p className="mt-4 text-slate-400">비용 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
