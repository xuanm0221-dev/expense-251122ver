import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * CSV 기반 비용 데이터를 실시간으로 생성하여 반환합니다.
 * Python 전처리 스크립트를 실행하고 결과 JSON을 읽어 반환합니다.
 */
export async function GET() {
  try {
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, "scripts", "preprocess_expense.py");
    const outputPath = path.join(projectRoot, "data", "aggregated-expense.json");

    // Python 스크립트 실행 (계산 로직은 스크립트에 그대로 유지)
    execSync(`python "${scriptPath}"`, {
      cwd: projectRoot,
      stdio: "pipe",
      encoding: "utf-8",
    });

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
