"""
CSV 파일 구조 확인 스크립트
"""
import pandas as pd
import os

CSV_BASE_PATH = r"D:\dashboard\비용대시보드\비용엑셀"

def check_csv_structure():
    """CSV 파일 구조 확인"""
    files = ["2024년비용.csv", "2025년비용.csv"]
    
    for filename in files:
        filepath = os.path.join(CSV_BASE_PATH, filename)
        if not os.path.exists(filepath):
            print(f"파일 없음: {filepath}")
            continue
        
        print(f"\n{'='*60}")
        print(f"파일: {filename}")
        print(f"{'='*60}")
        
        df = pd.read_csv(filepath, encoding="utf-8-sig")
        
        print(f"\n컬럼명 (전체):")
        for i, col in enumerate(df.columns):
            print(f"  {i+1}. '{col}'")
        
        print(f"\n데이터 행 수: {len(df)}")
        print(f"\n첫 5행 데이터:")
        print(df.head(5).to_string())
        
        print(f"\n숫자 컬럼 샘플 (첫 번째 숫자 컬럼):")
        numeric_cols = [col for col in df.columns if col not in ["사업부구분", "대분류", "중분류", "소분류"]]
        if numeric_cols:
            sample_col = numeric_cols[0]
            print(f"  컬럼: '{sample_col}'")
            print(f"  데이터 타입: {df[sample_col].dtype}")
            print(f"  샘플 값 (처음 10개):")
            for idx, val in enumerate(df[sample_col].head(10)):
                print(f"    [{idx}] '{val}' (type: {type(val).__name__})")
            
            # 숫자로 변환 시도
            try:
                numeric_vals = pd.to_numeric(df[sample_col], errors="coerce")
                print(f"\n  숫자 변환 결과:")
                print(f"    null 개수: {numeric_vals.isna().sum()}")
                print(f"    변환 성공 샘플: {numeric_vals.dropna().head(5).tolist()}")
                print(f"    통계: min={numeric_vals.min()}, max={numeric_vals.max()}, sum={numeric_vals.sum()}")
            except Exception as e:
                print(f"  숫자 변환 오류: {e}")

if __name__ == "__main__":
    check_csv_structure()



