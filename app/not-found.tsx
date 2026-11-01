import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <main className="store-page flex min-h-screen flex-col text-white">
      <SiteHeader />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-[100px]" />
        <div className="relative max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04]">
            <Compass className="h-7 w-7 text-white/65" />
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.3em] text-white/35">
            404 / Off the map
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Nothing here, yet.
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/45">
            This page may have moved, or the address may not be quite right.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Return home
          </Link>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
