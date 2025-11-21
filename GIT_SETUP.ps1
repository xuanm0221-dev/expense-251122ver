# Git 설정 및 푸시 스크립트
# 프로젝트 디렉토리에서 실행하세요: C:\1.대시보드(cursor)\비용

Write-Host "=== Git 설정 시작 ===" -ForegroundColor Green

# 1. Git 초기화
Write-Host "`n1. Git 저장소 초기화..." -ForegroundColor Yellow
if (Test-Path .git) {
    Write-Host "   Git 저장소가 이미 존재합니다." -ForegroundColor Cyan
} else {
    git init -b main
    Write-Host "   Git 저장소 초기화 완료" -ForegroundColor Green
}

# 2. 원격 저장소 설정
Write-Host "`n2. 원격 저장소 설정..." -ForegroundColor Yellow
$remoteUrl = "https://github.com/xuanm0221-dev/expense.git"
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    if ($existingRemote -eq $remoteUrl) {
        Write-Host "   원격 저장소가 이미 올바르게 설정되어 있습니다." -ForegroundColor Cyan
    } else {
        Write-Host "   기존 원격 저장소를 업데이트합니다..." -ForegroundColor Yellow
        git remote set-url origin $remoteUrl
        Write-Host "   원격 저장소 업데이트 완료" -ForegroundColor Green
    }
} else {
    git remote add origin $remoteUrl
    Write-Host "   원격 저장소 추가 완료" -ForegroundColor Green
}

# 3. 파일 추가
Write-Host "`n3. 변경 사항 추가..." -ForegroundColor Yellow
git add .
Write-Host "   파일 추가 완료" -ForegroundColor Green

# 4. 커밋
Write-Host "`n4. 커밋 생성..." -ForegroundColor Yellow
$commitMessage = "chore: 현재 대시보드 버전 커밋"
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Host "   커밋 완료" -ForegroundColor Green
} else {
    Write-Host "   커밋 실패 또는 변경 사항 없음" -ForegroundColor Yellow
}

# 5. 푸시
Write-Host "`n5. GitHub에 푸시..." -ForegroundColor Yellow
git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== 푸시 완료! ===" -ForegroundColor Green
} else {
    Write-Host "`n=== 푸시 실패 ===" -ForegroundColor Red
    Write-Host "수동으로 다음 명령을 실행해주세요:" -ForegroundColor Yellow
    Write-Host "  git push -u origin main" -ForegroundColor Cyan
}

Write-Host "`n현재 상태 확인:" -ForegroundColor Yellow
git status



