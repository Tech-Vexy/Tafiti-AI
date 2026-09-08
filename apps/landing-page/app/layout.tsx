import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CommandMenu from "@/components/CommandMenu";
import LegacyHashRedirect from "@/components/LegacyHashRedirect";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tafiti AI - Research at the Speed of Thought",
  description: "Tafiti AI transforms how you discover, analyze, and synthesize information. Deep research, simplified.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} antialiased transition-colors duration-300`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LegacyHashRedirect />
          <Navbar />
          {children}
          <Footer />
          <CommandMenu />
        </ThemeProvider>
      </body>
    </html>
  );
}
