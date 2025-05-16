import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Saiki Builder",
  description: "Build your AI agents with Saiki",
};

/**
 * Provides the root layout for the application, applying global fonts, metadata, and styling.
 *
 * Renders the application's children within a full-viewport flex container, setting up dark mode, custom fonts, and global CSS classes for consistent appearance across all pages.
 *
 * @param children - The content to be rendered within the layout.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="flex h-screen w-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
