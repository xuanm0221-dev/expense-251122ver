import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ExpenseDataProvider } from "@/components/dashboard/ExpenseDataProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "F&F China Expense Dashboard",
  description: "F&F China Expense Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ToastProvider>
          <LanguageProvider>
            <ExpenseDataProvider>{children}</ExpenseDataProvider>
          </LanguageProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

