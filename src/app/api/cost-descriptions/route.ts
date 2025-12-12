import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

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

    // KV에서 데이터 조회
    const key = `cost-descriptions:${brand}:${ym}:${mode}`;
    const descriptions = await kv.get<Record<string, string>>(key);

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

// POST: 설명 저장 (비밀번호 필요)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, ym, mode, accountPath, description, password } = body;

    // 필수 파라미터 검증
    if (!brand || !ym || !mode || !accountPath) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 비밀번호 검증
    const editPassword = process.env.EDIT_PASSWORD;
    if (!editPassword) {
      console.error("EDIT_PASSWORD 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    if (password !== editPassword) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 기존 값 조회 (로그용)
    const key = `cost-descriptions:${brand}:${ym}:${mode}`;
    const existingDescriptions = (await kv.get<Record<string, string>>(key)) || {};
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

    await kv.set(key, newDescriptions);

    // 저장 로그 기록
    const logKey = `cost-descriptions-logs:${brand}:${ym}:${mode}`;
    const logs = (await kv.get<SaveLog[]>(logKey)) || [];
    
    const newLog: SaveLog = {
      timestamp: new Date().toISOString(),
      accountPath,
      oldValue,
      newValue: description || "",
      userIdentifier: request.headers.get("x-user-identifier") || "anonymous",
    };

    logs.unshift(newLog); // 최신 로그를 앞에 추가
    // 최근 100개 로그만 유지
    const recentLogs = logs.slice(0, 100);
    await kv.set(logKey, recentLogs);

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
