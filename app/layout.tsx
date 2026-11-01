import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nexussuppliers.nl"),
  title: {
    default: "Nexus Suppliers | Digital, done beautifully.",
    template: "%s | Nexus Suppliers",
  },
  description:
    "Shop Nitro, boosts and digital extras at Nexus Suppliers. Browse products, check out securely and follow your orders in one place.",
  applicationName: "Nexus Suppliers",
  openGraph: {
    title: "Nexus Suppliers | Digital, done beautifully.",
    description:
      "Shop Nitro, boosts and digital extras at Nexus Suppliers. Browse products, check out securely and follow your orders in one place.",
    url: "https://nexussuppliers.nl",
    siteName: "Nexus Suppliers",
    type: "website",
  },
  icons: {
    icon: "/ns.jpg",
    shortcut: "/ns.jpg",
    apple: "/ns.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full bg-[#070707] text-white">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
