# AI 리포트 정적 파일

이 폴더에 보고서 파일이 있으면 모달을 열 때 **해당 파일 내용이 그대로 표시**되며,
정적 파일이 없으면 "보고서 미생성" 안내가 나타납니다 (자동 Claude 호출 금지).

## 파일명 규칙

`{year}-{month}-{yearType}-{mode}.txt`

예:
- `2026-3-actual-ytd.txt` — 2026년 3월 실적, YTD
- `2026-3-actual-monthly.txt` — 2026년 3월 실적, 당월
- `2026-12-plan-ytd.txt` — 2026년 예산, YTD

## 사용 방법 (로컬 전용)

1. `.env.local`에 `NEXT_PUBLIC_AI_REPORT_ALLOW_REGENERATE=true` 설정
2. 로컬에서 AI 리포트 모달 열기 → 상단 **"재생성 & 저장"** 버튼 클릭
3. Claude 스트리밍 완료 시 자동으로 `data/ai-reports/{filename}.txt`에 덮어쓰기
4. `git add data/ai-reports/*.txt && git commit && git push` → 배포

## 배포 환경 동작

- 정적 파일이 있으면 즉시 표시
- 정적 파일이 없거나 재생성을 시도해도 `Vercel=1` 환경에서는 차단 (403)
- 즉 배포 후에는 외부에서 Claude 재생성이 절대 발생하지 않음

새 월/모드 보고서가 필요하면 **로컬에서 생성 → 커밋 → 배포** 순으로만 반영하세요.
