import { NextResponse, type NextRequest } from "next/server";
import { clearResellerSession } from "@/lib/reseller-session";

export async function POST(request: NextRequest) {
  await clearResellerSession();
  return NextResponse.redirect(new URL("/reseller/login", request.url), { status: 303 });
}
