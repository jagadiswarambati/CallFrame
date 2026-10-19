import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AccessCodeGate from "@/components/AccessCodeGate";

export const metadata: Metadata = {
  title: {
    default: "Callframe — Every call. A clearer next step.",
    template: "%s | Callframe",
  },
  description: "A focused workspace for guiding phone calls. Capture prospect needs, handle objections, and leave every call with a concrete next step.",
  metadataBase: new URL("https://callframe.example"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Callframe",
    title: "Callframe — Every call. A clearer next step.",
    description: "A focused workspace for guiding phone calls. Capture prospect needs, handle objections, and leave every call with a concrete next step.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Callframe — Every call. A clearer next step.",
    description: "A focused workspace for guiding phone calls.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#2d2824",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Navigation />
        <main id="main-content" className="flex-1 pt-16 md:pt-20">
          {children}
        </main>
        <Footer />
        <AccessCodeGate />
      </body>
    </html>
  );
}