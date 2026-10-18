"use client";

import Link from "next/link";

const footerLinks = {
  product: [
    { href: "/workspace", label: "Workspace" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/features", label: "Features" },
    { href: "/help", label: "Help" },
  ],
  legal: [
    { href: "/terms", label: "Terms & Conditions" },
    { href: "/privacy", label: "Privacy Policy" },
  ],
  contact: [
    { href: "mailto:legal@callframe.example", label: "Legal Contact" },
    { href: "mailto:support@callframe.example", label: "Support" },
  ],
} as const;

export default function Footer() {
  const year = 2026;

  return (
    <footer className="bg-espresso-50 text-cream-50" role="contentinfo">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="logo flex items-center gap-3 mb-6" aria-label="Callframe Home">
              <span className="logo-mark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <span>Callframe</span>
            </Link>
            <p className="text-espresso-700 max-w-xs body">
              A focused workspace for guiding and recording calls. Built for clarity, honesty, and better outcomes.
            </p>
            <p className="text-espresso-700 mt-4 caption">
              Callframe is a demonstration project. Placeholder company details require legal review.
            </p>
          </div>

          <nav aria-label="Product links">
            <h3 className="heading-4 mb-4 text-cream-50">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link text-espresso-700 hover:text-ochre-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal links">
            <h3 className="heading-4 mb-4 text-cream-50">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link text-espresso-700 hover:text-ochre-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-8 border-t border-espresso-300 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="caption text-espresso-700">
            © {year} Callframe. All rights reserved.
          </p>
          <nav aria-label="Contact" className="flex items-center gap-6">
            {footerLinks.contact.map((link) => (
              <Link key={link.href} href={link.href} className="link text-espresso-700 hover:text-ochre-500 caption">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}