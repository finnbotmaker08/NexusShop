import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!tokenHash || (type !== "invite" && type !== "magiclink")) {
    return NextResponse.redirect(new URL("/reseller/login?error=activation", request.url));
  }
  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    console.error("Reseller invitation verification failed:", error.message);
    return NextResponse.redirect(new URL("/reseller/login?error=activation", request.url));
  }
  return NextResponse.redirect(new URL("/reseller/activate", request.url));
}
