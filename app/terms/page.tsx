import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function TermsPage() {
  return (
    <main className="store-page text-white">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="store-eyebrow">Terms</p>
        <h1 className="mt-4 text-4xl font-black">Terms of service</h1>

        <div className="mt-8 space-y-6 text-sm leading-7 text-white/50">
          <p>
            These terms govern the use of the Nexus Suppliers storefront and the purchase of digital products and services.
          </p>
          <p>
            Users are responsible for submitting accurate information, using the platform in compliance with local laws,
            and maintaining the security of their accounts and order details.
          </p>
          <p>
            Products and services are provided as-is, and Nexus Suppliers may update listings, descriptions, availability, and pricing
            at any time without prior notice.
          </p>
          <p>
            Refund and support policies are determined per product and are communicated with the relevant listing or order details.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
