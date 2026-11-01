import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Administrator sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="store-page relative isolate min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-[34rem] w-[34rem] rounded-full bg-blue-500/[0.1] blur-[130px]" />
        <div className="absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-cyan-300/[0.06] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_72%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="relative block h-10 w-10 overflow-hidden rounded-xl border border-blue-300/20 bg-[#050812]">
            <Image src="/ns.jpg" alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span>
            <span className="block text-sm font-black tracking-[0.19em]">NEXUS SUPPLIERS</span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/50">
              Digital suppliers
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100svh-160px)] max-w-7xl items-center gap-16 px-5 py-10 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:py-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/15 bg-blue-400/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.19em] text-blue-100/70">
            <LockKeyhole className="h-3.5 w-3.5" />
            Private admin access
          </div>
          <h1 className="mt-7 text-5xl font-black leading-[1.04] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Good to have
            <span className="block bg-gradient-to-r from-white to-blue-300/60 bg-clip-text text-transparent">you back.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/50 sm:text-lg">
            Sign in with your authorized Google account to access the Nexus Suppliers
            administrator workspace.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-xs text-white/55">
              <ShieldCheck className="h-4 w-4 text-blue-300/80" />
              Google-secured sign in
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-xs text-white/55">
              <LockKeyhole className="h-4 w-4 text-white/65" />
              Restricted to approved admins
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="store-panel rounded-[2rem] p-6 backdrop-blur-2xl sm:p-8">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/55">
                  NEXUS SUPPLIERS / CONTROL
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  Administrator sign in
                </h2>
              </div>
              <span className="relative block h-10 w-10 overflow-hidden rounded-xl border border-blue-300/20">
                <Image
                  src="/ns.jpg"
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
            </div>

            <GoogleSignInButton error={error} />
            <p className="mt-5 text-center text-xs leading-5 text-white/35">
              Only approved administrator accounts can enter the workspace.
            </p>

            <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/25">
              <span className="h-px flex-1 bg-white/[0.08]" />
              Security first
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <p className="text-center text-xs leading-5 text-white/35">
              Sign-in is handled by Supabase and Google. Nexus Suppliers never receives
              your Google password.
            </p>
            <Link
              href="/support"
              className="mt-6 inline-flex w-full items-center justify-center gap-1 text-xs text-white/45 transition hover:text-white"
            >
              Need help? Contact support <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <SiteFooter />
      </div>
    </main>
  );
}
