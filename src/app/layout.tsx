import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio Manager",
  description: "Local-first portfolio tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b">
          <div className="max-w-6xl mx-auto px-3 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              Portfolio Manager
            </Link>
            <div className="ml-auto">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings" aria-label="Open settings" className="inline-flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              </Button>
            </div>
          </div>
        </header>
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
