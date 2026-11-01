import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, PackageCheck, ShieldCheck } from "lucide-react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata: Metadata = {
  title: "Customer account",
};

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const { error, returnTo } = await searchParams;
  const safeReturnTo =
    returnTo?.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/account";
  const callbackPath = `/auth/customer-callback?next=${encodeURIComponent(safeReturnTo)}`;

  return (
    <main className="store-page relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 text-white">
      <div className="pointer-events-none absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full bg-blue-500/[0.08] blur-[130px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[30rem] w-[30rem] rounded-full bg-blue-400/[0.08] blur-[130px]" />
      <section className="store-panel relative w-full max-w-md rounded-[2rem] p-7 backdrop-blur-2xl sm:p-9">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <span className="relative block h-12 w-12 overflow-hidden rounded-xl border border-blue-300/20 bg-[#050812]">
            <Image
              src="/ns.jpg"
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              priority
            />
          </span>
          <span>
            <span className="block text-sm font-black tracking-[0.19em]">NEXUS SUPPLIERS</span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/50">
              Digital suppliers
            </span>
          </span>
        </div>
        <div className="mb-7 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/70">
          <PackageCheck className="h-4 w-4" />
          Your Nexus Suppliers account
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back.
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/50">
          Sign in to view your purchases and order updates. Your account is
          separate from the Nexus Suppliers admin workspace.
        </p>
        <div className="mt-8">
          <GoogleSignInButton
            error={error}
            callbackPath={callbackPath}
            buttonLabel="Continue with Google"
          />
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs leading-5 text-white/35">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Secure sign-in. Your Google password is never shared with Nexus Suppliers.
        </p>
      </section>
    </main>
  );
}
