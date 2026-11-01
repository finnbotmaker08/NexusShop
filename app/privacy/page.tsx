import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fetchStoreSettings } from "@/lib/storefront";

export default async function PrivacyPage() {
  const { settings } = await fetchStoreSettings();
  const supportEmail =
    settings.support_email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

  return (
    <main className="store-page text-white">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="store-eyebrow">Privacy</p>
        <h1 className="mt-4 text-4xl font-black">Privacy policy</h1>

        <div className="mt-8 space-y-6 text-sm leading-7 text-white/50">
          <p>
            This storefront displays product information stored in Supabase.
            The catalog may change as products are updated by the store
            operator.
          </p>
          <p>
            Administrator sign-in uses Google OAuth through Supabase. When an
            administrator signs in, these providers process the account
            information and authentication data needed to establish a session.
          </p>
          <p>
            Customer accounts also use Google OAuth through Supabase. When
            checkout is connected, order history will be linked to the signed-in
            customer and include order items, totals, payment status, and the
            payment provider&apos;s transaction reference. Nexus Suppliers does not store
            card details in this storefront.
          </p>
          <p>
            Paddle-hosted checkout is available only when the store operator
            has configured and explicitly enabled it. If enabled, Paddle
            processes payment details; Nexus Suppliers stores the resulting order record
            and does not store card details in this storefront.
          </p>
          <p>
            {supportEmail
              ? `Contact ${supportEmail} if you have questions about the data we manage or how it is used.`
              : "A privacy contact address will be published here shortly."}
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
