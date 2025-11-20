"""
비용 데이터 전처리 스크립트
CSV 파일을 읽어 공통 스키마로 변환하고 JSON으로 저장합니다.
"""

import pandas as pd
import json
import os
from pathlib import Path
from typing import Dict, List, Any

# CSV 파일 경로 설정
CSV_BASE_PATH = r"C:\2.대시보드(파일)\비용엑셀"
OUTPUT_DIR = Path(__file__).parent.parent / "data"
OUTPUT_DIR.mkdir(exist_ok=True)

# 분석 대상 사업부 (DUVETICA, SUPRA 제외)
TARGET_BIZ_UNITS = ["MLB", "KIDS", "DISCOVERY", "공통"]


def parse_month_column(col: str) -> tuple[int, int] | None:
    """월 컬럼명(예: '24-Jan', '25-Oct')을 (year, month)로 파싱"""
    try:
        parts = col.split("-")
        if len(parts) != 2:
            return None
        year_str, month_str = parts
        year = 2000 + int(year_str)
        month_map = {
            "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
            "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
            "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
        }
        month = month_map.get(month_str)
        if month:
            return (year, month)
    except:
        pass
    return None


def load_expense_data() -> pd.DataFrame:
    """비용 CSV 파일들을 읽어서 long-format으로 변환"""
    expense_files = [
        ("2024년비용.csv", 2024),
        ("2025년비용.csv", 2025)
    ]
    
    all_data = []
    
    for filename, default_year in expense_files:
        filepath = os.path.join(CSV_BASE_PATH, filename)
        if not os.path.exists(filepath):
            print(f"경고: {filepath} 파일을 찾을 수 없습니다.")
            continue
        
        df = pd.read_csv(filepath, encoding="utf-8-sig")
        
        # 비용 관련 컬럼 추출
        id_cols = ["사업부구분", "대분류", "중분류", "소분류"]
        month_cols = [col for col in df.columns if col not in id_cols]
        
        # Long format으로 변환
        df_melted = df.melt(
            id_vars=id_cols,
            value_vars=month_cols,
            var_name="month_col",
            value_name="amount"
        )
        
        # 연도/월 파싱
        df_melted["parsed"] = df_melted["month_col"].apply(parse_month_column)
        df_melted = df_melted[df_melted["parsed"].notna()]
        df_melted[["year", "month"]] = pd.DataFrame(
            df_melted["parsed"].tolist(),
            index=df_melted.index
        )
        
        # yyyymm 생성
        df_melted["yyyymm"] = df_melted["year"].astype(str) + df_melted["month"].astype(str).str.zfill(2)
        
        # 컬럼명 변경
        df_melted = df_melted.rename(columns={
            "사업부구분": "biz_unit",
            "대분류": "cost_lv1",
            "중분류": "cost_lv2",
            "소분류": "cost_lv3"
        })
        
        # amount를 숫자로 변환 (NaN은 0으로)
        df_melted["amount"] = pd.to_numeric(df_melted["amount"], errors="coerce").fillna(0)
        
        # 필요한 컬럼만 선택
        df_melted = df_melted[[
            "year", "month", "yyyymm", "biz_unit",
            "cost_lv1", "cost_lv2", "cost_lv3", "amount"
        ]]
        
        all_data.append(df_melted)
    
    if not all_data:
        raise ValueError("비용 데이터를 로드할 수 없습니다.")
    
    expense_df = pd.concat(all_data, ignore_index=True)
    return expense_df


def load_headcount_data() -> pd.DataFrame:
    """인원수 CSV를 읽어서 biz_unit & yyyymm 기준으로 집계"""
    filepath = os.path.join(CSV_BASE_PATH, "인원수.csv")
    if not os.path.exists(filepath):
        print(f"경고: {filepath} 파일을 찾을 수 없습니다.")
        return pd.DataFrame(columns=["biz_unit", "yyyymm", "headcount"])
    
    df = pd.read_csv(filepath, encoding="utf-8-sig")
    
    # 사업부 기준으로 집계 (사업부(소분류)는 무시)
    id_cols = ["사업부"]
    month_cols = [col for col in df.columns if col not in id_cols]
    
    df_melted = df.melt(
        id_vars=id_cols,
        value_vars=month_cols,
        var_name="month_col",
        value_name="headcount"
    )
    
    # 연도/월 파싱
    df_melted["parsed"] = df_melted["month_col"].apply(parse_month_column)
    df_melted = df_melted[df_melted["parsed"].notna()]
    df_melted[["year", "month"]] = pd.DataFrame(
        df_melted["parsed"].tolist(),
        index=df_melted.index
    )
    
    df_melted["yyyymm"] = df_melted["year"].astype(str) + df_melted["month"].astype(str).str.zfill(2)
    
    # 사업부 기준으로 집계
    headcount_df = df_melted.groupby(["사업부", "yyyymm"], as_index=False)["headcount"].sum()
    headcount_df = headcount_df.rename(columns={"사업부": "biz_unit"})
    
    # headcount를 숫자로 변환
    headcount_df["headcount"] = pd.to_numeric(headcount_df["headcount"], errors="coerce").fillna(0)
    
    return headcount_df[["biz_unit", "yyyymm", "headcount"]]


def load_sales_data() -> pd.DataFrame:
    """판매매출 CSV를 읽어서 biz_unit & yyyymm 기준으로 변환"""
    filepath = os.path.join(CSV_BASE_PATH, "판매매출.csv")
    if not os.path.exists(filepath):
        print(f"경고: {filepath} 파일을 찾을 수 없습니다.")
        return pd.DataFrame(columns=["biz_unit", "yyyymm", "sales"])
    
    df = pd.read_csv(filepath, encoding="utf-8-sig")
    
    id_cols = ["사업부"]
    month_cols = [col for col in df.columns if col not in id_cols]
    
    df_melted = df.melt(
        id_vars=id_cols,
        value_vars=month_cols,
        var_name="month_col",
        value_name="sales"
    )
    
    # 연도/월 파싱
    df_melted["parsed"] = df_melted["month_col"].apply(parse_month_column)
    df_melted = df_melted[df_melted["parsed"].notna()]
    df_melted[["year", "month"]] = pd.DataFrame(
        df_melted["parsed"].tolist(),
        index=df_melted.index
    )
    
    df_melted["yyyymm"] = df_melted["year"].astype(str) + df_melted["month"].astype(str).str.zfill(2)
    
    sales_df = df_melted.rename(columns={"사업부": "biz_unit"})
    sales_df["sales"] = pd.to_numeric(sales_df["sales"], errors="coerce").fillna(0)
    
    return sales_df[["biz_unit", "yyyymm", "sales"]]


def merge_all_data(expense_df: pd.DataFrame, headcount_df: pd.DataFrame, sales_df: pd.DataFrame) -> pd.DataFrame:
    """모든 데이터를 병합"""
    # expense_df를 기준으로 left join
    merged = expense_df.merge(
        headcount_df,
        on=["biz_unit", "yyyymm"],
        how="left"
    ).merge(
        sales_df,
        on=["biz_unit", "yyyymm"],
        how="left"
    )
    
    # NaN을 0으로 채우기
    merged["headcount"] = merged["headcount"].fillna(0)
    merged["sales"] = merged["sales"].fillna(0)
    
    return merged


def calculate_aggregations(df: pd.DataFrame) -> Dict[str, Any]:
    """집계 데이터 계산"""
    # 전체 데이터 (DUVETICA, SUPRA 포함)
    full_df = df.copy()
    
    # 분석 대상만 필터링
    target_df = df[df["biz_unit"].isin(TARGET_BIZ_UNITS)].copy()
    
    # 기본 집계: biz_unit, year, month, cost_lv1 기준
    monthly_agg = target_df.groupby(
        ["biz_unit", "year", "month", "yyyymm", "cost_lv1"],
        as_index=False
    ).agg({
        "amount": "sum",
        "headcount": "first",  # 같은 yyyymm, biz_unit이면 동일하므로 first
        "sales": "first"
    })
    
    # 월별 총합 (cost_lv1 무시)
    monthly_total = target_df.groupby(
        ["biz_unit", "year", "month", "yyyymm"],
        as_index=False
    ).agg({
        "amount": "sum",
        "headcount": "first",
        "sales": "first"
    })
    
    # 대분류별 상세 (중분류, 소분류 포함)
    category_detail = target_df.groupby(
        ["biz_unit", "year", "month", "yyyymm", "cost_lv1", "cost_lv2", "cost_lv3"],
        as_index=False
    ).agg({
        "amount": "sum"
    })
    
    # JSON 직렬화를 위해 리스트로 변환
    result = {
        "monthly_aggregated": monthly_agg.to_dict("records"),
        "monthly_total": monthly_total.to_dict("records"),
        "category_detail": category_detail.to_dict("records"),
        "metadata": {
            "target_biz_units": TARGET_BIZ_UNITS,
            "years": sorted(target_df["year"].unique().tolist()),
            "months": sorted(target_df["month"].unique().tolist())
        }
    }
    
    return result


def main():
    print("비용 데이터 전처리를 시작합니다...")
    
    try:
        # 데이터 로드
        print("1. 비용 데이터 로드 중...")
        expense_df = load_expense_data()
        print(f"   - 비용 데이터: {len(expense_df)} 행")
        
        print("2. 인원수 데이터 로드 중...")
        headcount_df = load_headcount_data()
        print(f"   - 인원수 데이터: {len(headcount_df)} 행")
        
        print("3. 매출 데이터 로드 중...")
        sales_df = load_sales_data()
        print(f"   - 매출 데이터: {len(sales_df)} 행")
        
        # 데이터 병합
        print("4. 데이터 병합 중...")
        merged_df = merge_all_data(expense_df, headcount_df, sales_df)
        print(f"   - 병합된 데이터: {len(merged_df)} 행")
        
        # 집계 계산
        print("5. 집계 데이터 계산 중...")
        aggregated = calculate_aggregations(merged_df)
        
        # JSON 저장
        output_file = OUTPUT_DIR / "aggregated-expense.json"
        print(f"6. JSON 파일 저장 중: {output_file}")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(aggregated, f, ensure_ascii=False, indent=2)
        
        print("전처리 완료!")
        print(f"출력 파일: {output_file}")
        
    except Exception as e:
        print(f"오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

