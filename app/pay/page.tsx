import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PaddlePaymentInitializer } from "@/components/paddle-payment-initializer";

export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};

export default async function PaddlePaymentLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ _ptxn?: string }>;
}) {
  const [{ _ptxn: transactionId }, clientToken] = await Promise.all([
    searchParams,
    Promise.resolve(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
  ]);
  const environment = process.env.PADDLE_ENVIRONMENT ?? "sandbox";
  const validEnvironment =
    environment === "sandbox" || environment === "production";
  const validTransactionId =
    typeof transactionId === "string" && /^txn_[a-z0-9]{26}$/.test(transactionId);

  return (
    <main className="store-page flex min-h-screen items-center justify-center px-5 py-12 text-white">
      <section className="store-panel w-full max-w-lg rounded-3xl p-7 text-center sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-300/[0.07]">
          <ShieldCheck className="h-5 w-5 text-blue-100/80" />
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-100/55">
          Nexus Suppliers secure checkout
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Preparing your payment
        </h1>
        {validTransactionId && clientToken && validEnvironment ? (
          <PaddlePaymentInitializer
            clientToken={clientToken}
            environment={environment}
            transactionId={transactionId}
          />
        ) : (
          <p role="alert" className="mt-4 text-sm leading-6 text-white/50">
            This payment link is incomplete or expired. Return to your customer
            account and contact support if you need help.
          </p>
        )}
        <Link
          href="/account"
          className="mt-8 inline-flex items-center gap-2 text-xs text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to your account
        </Link>
      </section>
    </main>
  );
}
