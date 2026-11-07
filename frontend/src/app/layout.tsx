import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AuthGate } from "@/components/auth/AuthGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyTNB-PD | Personal Dashboard",
  description:
    "An unofficial personal dashboard for reviewing electricity usage and bills from your myTNB account.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-slate-50 text-slate-900`}>
        <Providers>
          <AuthGate>
            <div className="flex h-full flex-col xl:flex-row">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
            </div>
          </AuthGate>
        </Providers>
      </body>
    </html>
  );
}
