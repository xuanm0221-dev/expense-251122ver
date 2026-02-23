import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

/**
 * 미리 생성된 aggregated-expense.json을 읽어 반환합니다.
 * CSV → JSON 변환은 로컬에서 scripts/preprocess_expense.py를 실행 후 커밋하세요.
 */
export async function GET() {
  try {
    const outputPath = path.join(process.cwd(), "data", "aggregated-expense.json");
    const raw = fs.readFileSync(outputPath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error("expense-data API 오류:", error);
    const msg =
      error instanceof Error ? error.message : "비용 데이터 로드 실패";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
