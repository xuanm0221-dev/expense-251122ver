import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 저장 로그 타입
interface SaveLog {
  timestamp: string;
  accountPath: string;
  oldValue: string;
  newValue: string;
  userIdentifier: string;
}

// 설명 데이터 타입
interface CostDescription {
  brand: string;
  ym: string; // YYYYMM 형식
  mode: "monthly" | "ytd";
  accountPath: string; // 계층 경로 (예: "l1-인건비|l2-기본급")
  description: string;
}

// 파일 경로 생성
function getDescriptionFilePath(brand: string, ym: string, mode: string): string {
  const dataDir = path.join(process.cwd(), "data", "cost-descriptions");
  return path.join(dataDir, `${brand}-${ym}-${mode}.json`);
}

function getLogFilePath(brand: string, ym: string, mode: string): string {
  const logDir = path.join(process.cwd(), "data", "cost-descriptions", "logs");
  return path.join(logDir, `${brand}-${ym}-${mode}.json`);
}

// 디렉토리 생성 (없으면)
function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 파일에서 설명 데이터 읽기
async function readDescriptions(
  brand: string,
  ym: string,
  mode: string
): Promise<Record<string, string>> {
  try {
    const filePath = getDescriptionFilePath(brand, ym, mode);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    console.error("설명 파일 읽기 오류:", error);
    return {};
  }
}

// 파일에 설명 데이터 쓰기
async function writeDescriptions(
  brand: string,
  ym: string,
  mode: string,
  descriptions: Record<string, string>
): Promise<void> {
  const filePath = getDescriptionFilePath(brand, ym, mode);
  ensureDirectoryExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(descriptions, null, 2), "utf-8");
}

// 파일에서 로그 읽기
async function readLogs(
  brand: string,
  ym: string,
  mode: string
): Promise<SaveLog[]> {
  try {
    const filePath = getLogFilePath(brand, ym, mode);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    console.error("로그 파일 읽기 오류:", error);
    return [];
  }
}

// 파일에 로그 쓰기
async function writeLogs(
  brand: string,
  ym: string,
  mode: string,
  log: SaveLog
): Promise<void> {
  const filePath = getLogFilePath(brand, ym, mode);
  ensureDirectoryExists(filePath);
  
  // 기존 로그 읽기
  const logs = await readLogs(brand, ym, mode);
  
  // 새 로그를 앞에 추가
  logs.unshift(log);
  
  // 최근 100개만 유지
  const recentLogs = logs.slice(0, 100);
  
  fs.writeFileSync(filePath, JSON.stringify(recentLogs, null, 2), "utf-8");
}

// GET: 설명 조회 (공개)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brand = searchParams.get("brand") || "ALL";
    const ym = searchParams.get("ym");
    const mode = searchParams.get("mode") || "monthly";

    if (!ym) {
      return NextResponse.json(
        { error: "ym 파라미터가 필요합니다 (YYYYMM 형식)" },
        { status: 400 }
      );
    }

    // 파일에서 데이터 조회
    const descriptions = await readDescriptions(brand, ym, mode);

    return NextResponse.json({
      success: true,
      data: descriptions || {},
    });
  } catch (error: any) {
    console.error("설명 조회 오류:", error);
    return NextResponse.json(
      { error: error.message || "설명 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 설명 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, ym, mode, accountPath, description } = body;

    // 필수 파라미터 검증
    if (!brand || !ym || !mode || !accountPath) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 기존 값 조회 (로그용)
    const existingDescriptions = await readDescriptions(brand, ym, mode);
    const oldValue = existingDescriptions[accountPath] || "";

    // 새 값 저장
    const newDescriptions: Record<string, string> = {
      ...existingDescriptions,
      [accountPath]: description || "",
    };

    // 빈 문자열인 경우 키 제거
    if (!description || description.trim() === "") {
      delete newDescriptions[accountPath];
    }

    await writeDescriptions(brand, ym, mode, newDescriptions);

    // 저장 로그 기록
    const newLog: SaveLog = {
      timestamp: new Date().toISOString(),
      accountPath,
      oldValue,
      newValue: description || "",
      userIdentifier: request.headers.get("x-user-identifier") || "anonymous",
    };

    await writeLogs(brand, ym, mode, newLog);

    return NextResponse.json({
      success: true,
      message: "설명이 저장되었습니다.",
    });
  } catch (error: any) {
    console.error("설명 저장 오류:", error);
    return NextResponse.json(
      { error: error.message || "설명 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
