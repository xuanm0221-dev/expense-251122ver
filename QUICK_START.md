# 🚀 빠른 시작 가이드

GitHub + Vercel 배포를 위한 최소한의 명령어만 정리한 빠른 참조 가이드입니다.

---

## 1️⃣ Git 초기화 & GitHub 푸시

```bash
# 전처리 실행 (JSON 생성)
run_preprocess.bat

# Git 초기화 및 푸시
git init
git add .
git commit -m "초기 대시보드 세팅"
git branch -M main
git remote add origin https://github.com/내계정/내리포.git
git push -u origin main
```

**⚠️ 중요:** `내계정`과 `내리포`를 실제 값으로 변경하세요!

---

## 2️⃣ Vercel 배포

1. https://vercel.com 접속 → GitHub 로그인
2. `Add New...` → `Project`
3. GitHub 리포지토리 선택 → `Import`
4. 설정 확인 (자동 감지됨):
   - Framework: Next.js
   - Build Command: `npm run build`
   - Root Directory: `./`
5. `Deploy` 클릭

**✅ 완료!** 이후 `git push`하면 자동 재배포됩니다.

---

## 3️⃣ 데이터 업데이트 후 재배포

```bash
# 전처리 실행
run_preprocess.bat

# 커밋 & 푸시
git add data/aggregated-expense.json
git commit -m "데이터 업데이트: YYYY-MM-DD"
git push origin main
```

**✅ Vercel이 자동으로 재배포합니다!**

---

## 📖 상세 가이드는 `DEPLOYMENT.md` 참고

