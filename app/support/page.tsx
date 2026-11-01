import { ArrowRight, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fetchStoreSettings, isValidDiscordInvite } from "@/lib/storefront";

const faqs = [
  {
    question: "Where can I find delivery details?",
    answer: "Delivery information depends on the product. Check the individual listing before purchase for the latest availability and fulfillment details.",
  },
  {
    question: "Can I ask a question before choosing?",
    answer: "Yes. If a support email is published below, contact us with the product name and your question before making a decision.",
  },
  {
    question: "How do refunds work?",
    answer: "Refund terms depend on the product and applicable consumer law. Review the terms provided for your purchase and contact support if anything is unclear.",
  },
];

export default async function SupportPage() {
  const { settings } = await fetchStoreSettings();
  const supportEmail =
    settings.support_email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

  return (
    <main className="store-page text-white">
      <SiteHeader active="/support" />

      <section className="relative isolate mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="pointer-events-none absolute -left-24 top-0 -z-10 h-96 w-96 rounded-full bg-blue-500/[0.08] blur-[120px]" />
        <div className="max-w-2xl">
          <p className="store-eyebrow">Support</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.055em] sm:text-6xl">Here when you need us.</h1>
          <p className="mt-4 leading-7 text-white/50">
            Product questions, delivery details, and account help — find the right way to get in touch below.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="store-panel rounded-3xl p-6">
            <MessageSquare className="h-8 w-8 text-blue-200/80" />
            <h2 className="mt-4 text-xl font-bold">Product guidance</h2>
            <p className="mt-2 text-sm text-white/45">Review each listing for details and availability before making your choice.</p>
          </div>
          <div className="store-panel rounded-3xl p-6">
            <ShieldCheck className="h-8 w-8 text-blue-200/80" />
            <h2 className="mt-4 text-xl font-bold">Order questions</h2>
            <p className="mt-2 text-sm text-white/45">Keep your order reference nearby when asking about a purchase.</p>
          </div>
          <div className="store-panel rounded-3xl p-6">
            <Mail className="h-8 w-8 text-blue-200/80" />
            <h2 className="mt-4 text-xl font-bold">Email support</h2>
            <p className="mt-2 text-sm text-white/45">
              {supportEmail
                ? `For orders and product inquiries, contact ${supportEmail}.`
                : "Our contact details will be published here shortly."}
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {faqs.map((item) => (
              <div key={item.question} className="store-panel rounded-3xl p-6">
                <h3 className="text-lg font-bold">{item.question}</h3>
                <p className="mt-2 text-sm leading-6 text-white/45">{item.answer}</p>
              </div>
            ))}
          </div>

          <div className="store-panel rounded-3xl p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-200/65">Contact</p>
            <h3 className="mt-4 text-2xl font-black">Need a faster answer?</h3>
            <p className="mt-3 text-sm leading-6 text-white/45">
              {supportEmail ||
              (settings.discord_support_url &&
                isValidDiscordInvite(settings.discord_support_url))
                ? "Send a message with your order or product details and our team can help."
                : "Support contact options are being prepared. Please check back soon."}
            </p>
            {supportEmail ? (
              <a
                href={`mailto:${supportEmail}`}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
              >
                Email support <ArrowRight className="h-4 w-4" />
              </a>
            ) : null}
            {settings.discord_support_url &&
            isValidDiscordInvite(settings.discord_support_url) ? (
              <a
                href={settings.discord_support_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
              >
                <MessageSquare className="h-4 w-4" />
                Join Discord support
              </a>
            ) : null}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
