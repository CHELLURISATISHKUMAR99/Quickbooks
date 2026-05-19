import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function ok<T>(data: T): NextResponse {
  const body: ApiResponse<T> = { success: true, data };
  return NextResponse.json(body);
}

export function fail(error: string, status = 400): NextResponse {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status });
}
