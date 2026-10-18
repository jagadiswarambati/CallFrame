import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Callframe",
  description: "A focused workspace for live calls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
