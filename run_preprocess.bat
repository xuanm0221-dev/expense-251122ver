@echo off
chcp 65001 >nul
echo ========================================
echo 비용 데이터 전처리 실행
echo ========================================
echo.

cd /d "%~dp0"

echo Python 환경 확인 중...
python --version
if errorlevel 1 (
    echo 오류: Python이 설치되어 있지 않습니다.
    echo Python을 설치한 후 다시 실행해주세요.
    pause
    exit /b 1
)

echo.
echo 전처리 스크립트 실행 중...
python scripts/preprocess_expense.py

if errorlevel 1 (
    echo.
    echo 오류가 발생했습니다. 위의 오류 메시지를 확인해주세요.
    pause
    exit /b 1
)

echo.
echo ========================================
echo 전처리 완료!
echo ========================================
pause

