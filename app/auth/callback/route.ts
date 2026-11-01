import { NextResponse, type NextRequest } from "next/server";
import { isVerifiedAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  try {
    const supabase = await createSupabaseServerClient(true);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase OAuth code exchange failed:", error.message);
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !isVerifiedAdmin(user)) {
      if (userError) {
        console.error("Could not verify OAuth user:", userError.message);
      } else {
        console.warn("Rejected Google sign-in for a non-admin account.");
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=not-admin", request.url),
      );
    }

    return NextResponse.redirect(new URL("/admin", request.url));
  } catch (error) {
    console.error("Supabase OAuth callback failed:", error);
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }
}
