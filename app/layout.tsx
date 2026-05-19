import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quad 4 Consulting Services",
  description: "AutoBooks Client Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
