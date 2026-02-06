export interface ExpenseAccountRow {
  id: string;
  level: 1 | 2 | 3 | 4; // 1: 대분류, 2: 사업부구분(브랜드) 또는 중분류(공통), 3: 중분류(브랜드) 또는 소분류(공통), 4: 소분류(브랜드)
  category_l1: string; // 대분류
  biz_unit?: string; // 사업부구분 (level 2 또는 level 3에서 사용)
  category_l2: string; // 중분류
  category_l3: string; // 소분류
  prev_month: number;
  curr_month: number;
  prev_ytd: number;
  curr_ytd: number;
  prev_year_annual: number | null;
  curr_year_annual: number | null;
  description: string;
  isExpanded: boolean;
  children?: ExpenseAccountRow[];
}
