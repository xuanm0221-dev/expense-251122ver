"""
ETL 스크립트: 여러 데이터 소스를 병합하여 KPI 데이터 생성
"""
import pandas as pd
import json
import os
from pathlib import Path

# 프로젝트 루트 기준 경로
PROJECT_ROOT = Path(__file__).parent.parent
DASHBOARD_DATA_DIR = PROJECT_ROOT / "dashboard_data"
EXPORTS_DIR = PROJECT_ROOT / "exports"

# 디렉토리 생성
DASHBOARD_DATA_DIR.mkdir(exist_ok=True)
EXPORTS_DIR.mkdir(exist_ok=True)


def load_parquet_files():
    """
    parquet 파일들을 로드하고 병합
    실제 파일 경로는 프로젝트 구조에 맞게 수정 필요
    """
    # TODO: 실제 parquet 파일 경로로 수정
    # sales_agg = pd.read_parquet("path/to/sales_agg.parquet")
    # stock_agg = pd.read_parquet("path/to/stock_agg.parquet")
    # expense_agg = pd.read_parquet("path/to/expense_agg.parquet")
    # headcount_agg = pd.read_parquet("path/to/headcount_agg.parquet")
    
    # 병합 예시 (실제 merge 로직에 맞게 수정)
    # kpi_df = pd.merge(sales_agg, stock_agg, on=["year", "month", "biz_unit"], how="outer")
    # kpi_df = pd.merge(kpi_df, expense_agg, on=["year", "month", "biz_unit"], how="outer")
    # kpi_df = pd.merge(kpi_df, headcount_agg, on=["year", "month", "biz_unit"], how="outer")
    
    # 샘플 데이터 (실제로는 위의 parquet 파일들을 사용)
    kpi_df = pd.DataFrame({
        "year": [2025, 2025, 2025],
        "month": [10, 10, 10],
        "biz_unit": ["MLB", "KIDS", "DISCOVERY"],
        "channel": ["온라인", "오프라인", "온라인"],
        "subcategory": ["APP001", "APP002", "ACC001"],
        "account_major": ["인건비", "광고비", "인건비"],
        "sales": [849376921, 234567890, 123456789],
        "expense": [19393000, 5234000, 3456000],
        "stock": [150000000, 50000000, 30000000],
        "headcount": [206, 183, 98],
        "expense_ratio": [2.28, 2.23, 2.80],
        "stock_days": [45, 60, 55],
        "yoy_sales": [91.5, 102.1, 108.9],
        "yoy_expense": [88.6, 95.3, 110.5],
    })
    
    return kpi_df


def create_kpi_summary(kpi_df: pd.DataFrame):
    """
    kpi_df를 요약하여 dashboard_data/kpi_summary.json 생성
    """
    # 요약 로직 (실제 요구사항에 맞게 수정)
    summary = kpi_df.groupby(["year", "month", "biz_unit"]).agg({
        "sales": "sum",
        "expense": "sum",
        "headcount": "mean",  # 또는 first, last 등
    }).reset_index()
    
    # YOY 계산 등 추가 처리
    # ...
    
    # JSON으로 저장
    output_file = DASHBOARD_DATA_DIR / "kpi_summary.json"
    summary.to_json(output_file, orient="records", force_ascii=False, indent=2)
    print(f"✓ kpi_summary.json 생성 완료: {output_file}")


def export_for_claude(kpi_df: pd.DataFrame):
    """
    kpi_df를 클로드 분석용 CSV로 저장
    """
    # 컬럼 매핑 (실제 컬럼명에 맞게 수정 필요)
    column_mapping = {
        # 원본 컬럼명: 새 컬럼명
        # 예시:
        # "사업부구분": "biz_unit",
        # "비용_대분류": "account_major",
        # "매출": "sales",
        # "비용": "expense",
        # "재고": "stock",
        # "인원": "headcount",
        # "비용률": "expense_ratio",
        # "재고주수": "stock_days",
        # "전년대비_매출": "yoy_sales",
        # "전년대비_비용": "yoy_expense",
    }
    
    # 컬럼명 변경 (매핑이 있는 경우)
    if column_mapping:
        kpi_df = kpi_df.rename(columns=column_mapping)
    
    # 필요한 컬럼만 선택 (있는 컬럼만)
    desired_columns = [
        "year",
        "month",
        "biz_unit",
        "channel",
        "subcategory",
        "account_major",
        "sales",
        "expense",
        "stock",
        "headcount",
        "expense_ratio",
        "stock_days",
        "yoy_sales",
        "yoy_expense",
    ]
    
    # 존재하는 컬럼만 선택
    available_columns = [col for col in desired_columns if col in kpi_df.columns]
    export_df = kpi_df[available_columns].copy()
    
    # 컬럼 순서 정렬 (desired_columns 순서대로)
    column_order = [col for col in desired_columns if col in export_df.columns]
    export_df = export_df[column_order]
    
    # CSV로 저장
    output_file = EXPORTS_DIR / "kpi_for_claude_detailed.csv"
    export_df.to_csv(
        output_file,
        index=False,
        encoding="utf-8",
    )
    print(f"✓ kpi_for_claude_detailed.csv 생성 완료: {output_file}")
    print(f"  - 행 수: {len(export_df)}")
    print(f"  - 컬럼: {list(export_df.columns)}")


def main():
    """
    메인 ETL 프로세스
    """
    print("ETL 프로세스를 시작합니다...")
    
    # 1. parquet 파일 로드 및 병합
    print("\n1. 데이터 로드 및 병합 중...")
    kpi_df = load_parquet_files()
    print(f"   - kpi_df 행 수: {len(kpi_df)}")
    print(f"   - kpi_df 컬럼: {list(kpi_df.columns)}")
    
    # 2. 요약 데이터 생성 (대시보드 카드용)
    print("\n2. 요약 데이터 생성 중...")
    create_kpi_summary(kpi_df)
    
    # 3. 클로드 분석용 CSV 생성
    print("\n3. 클로드 분석용 CSV 생성 중...")
    export_for_claude(kpi_df)
    
    print("\n✓ ETL 프로세스 완료!")


if __name__ == "__main__":
    main()

