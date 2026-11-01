import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (request.nextUrl.pathname.startsWith("/admin")) {
    await supabase.auth.getUser();
  }

  const isPublicMaintenancePage =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname === "/dashboard/commissies" ||
    request.nextUrl.pathname.startsWith("/auth") ||
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/maintenance" ||
    request.nextUrl.pathname.startsWith("/account") ||
    request.nextUrl.pathname === "/pay" ||
    request.nextUrl.pathname.startsWith("/support") ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api");

  if (!isPublicMaintenancePage) {
    const { data: settings, error } = await supabase
      .from("store_settings")
      .select("maintenance_mode")
      .eq("id", "default")
      .maybeSingle();

    if (error && error.code !== "PGRST205") {
      console.error("Could not load maintenance settings:", error.message);
    }

    if (settings?.maintenance_mode) {
      const maintenanceUrl = request.nextUrl.clone();
      maintenanceUrl.pathname = "/maintenance";
      maintenanceUrl.search = "";
      const maintenanceResponse = NextResponse.redirect(maintenanceUrl);
      response.cookies.getAll().forEach((cookie) => {
        maintenanceResponse.cookies.set(cookie);
      });
      return maintenanceResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
