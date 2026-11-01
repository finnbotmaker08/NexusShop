import { NextResponse, type NextRequest } from "next/server";
import { isVerifiedAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient(true);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Could not identify account during sign-out:", userError.message);
  }

  const redirectPath = isVerifiedAdmin(user) ? "/login" : "/account/login";
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase sign-out failed:", error);
  }

  return NextResponse.redirect(new URL(redirectPath, request.url), {
    status: 303,
  });
}
