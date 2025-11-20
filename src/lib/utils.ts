import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatK(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  return `${(value / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}K`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("ko-KR");
}

export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(decimals)}%`;
}

export function formatPercentPoint(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%p`;
}

export function calculateYOY(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0 || isNaN(current) || isNaN(previous)) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

