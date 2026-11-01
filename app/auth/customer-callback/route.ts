import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/account/login?error=oauth", request.url),
    );
  }

  try {
    const supabase = await createSupabaseServerClient(true);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Customer OAuth code exchange failed:", error.message);
      return NextResponse.redirect(
        new URL("/account/login?error=oauth", request.url),
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError) {
        console.error("Could not verify customer OAuth user:", userError.message);
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/account/login?error=oauth", request.url),
      );
    }

    const requestedDestination = request.nextUrl.searchParams.get("next");
    let destination = new URL("/account", request.url);

    if (requestedDestination?.startsWith("/") && !requestedDestination.startsWith("//")) {
      const candidate = new URL(requestedDestination, request.url);
      if (candidate.origin === request.nextUrl.origin) {
        destination = candidate;
      }
    }

    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Customer OAuth callback failed:", error);
    return NextResponse.redirect(
      new URL("/account/login?error=oauth", request.url),
    );
  }
}
