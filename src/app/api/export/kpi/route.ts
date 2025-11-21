import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/export/kpi
 * KPI 데이터를 CSV로 내보내기
 * exports/kpi_for_claude_detailed.csv 파일을 직접 읽어서 스트리밍 다운로드
 */
export async function GET() {
  try {
    // exports/kpi_for_claude_detailed.csv 파일 경로
    const filePath = join(process.cwd(), "exports", "kpi_for_claude_detailed.csv");
    
    // 파일 읽기 (UTF-8)
    const csvContent = await readFile(filePath, "utf-8");
    
    // CSV 파일을 그대로 반환
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kpi_for_claude_detailed.csv"',
      },
    });
  } catch (error: any) {
    console.error("CSV export error:", error);
    
    // 파일이 없는 경우
    if (error.code === "ENOENT") {
      return NextResponse.json(
        { error: "KPI 데이터 파일을 찾을 수 없습니다. (exports/kpi_for_claude_detailed.csv)" },
        { status: 404 }
      );
    }
    
    // 기타 에러
    return NextResponse.json(
      { error: error.message || "CSV 내보내기 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

