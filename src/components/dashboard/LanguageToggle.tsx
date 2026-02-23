"use client";

import React from "react";
import { useLanguage, type Lang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  compact?: boolean;
}

export function LanguageToggle({ compact }: LanguageToggleProps = {}) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex h-7 items-center rounded-lg border border-gray-200 bg-gray-50",
        compact ? "gap-1 px-2 py-1" : "gap-1 px-2 py-1.5"
      )}
    >
      <button
        type="button"
        onClick={() => setLang("ko")}
        className={cn(
          "rounded-md font-medium transition-colors",
          compact ? "px-2 py-1 text-xs" : "px-2.5 py-1 text-[10px] sm:text-xs",
          lang === "ko"
            ? "bg-white text-gray-800 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        한국어
      </button>
      <span className="text-gray-300 px-0.5">|</span>
      <button
        type="button"
        onClick={() => setLang("zh")}
        className={cn(
          "rounded-md font-medium transition-colors",
          compact ? "px-2 py-1 text-xs" : "px-2.5 py-1 text-[10px] sm:text-xs",
          lang === "zh"
            ? "bg-white text-gray-800 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        中文
      </button>
    </div>
  );
}
