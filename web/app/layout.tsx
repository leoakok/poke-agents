import type { Metadata } from "next";
import "./globals.css";

import { DashboardShell } from "@/components/dashboard-shell";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Poke agents",
    template: "%s · Poke agents",
  },
  description:
    "Local dashboard for the poke-agents MCP server: Cursor and OpenCode sessions, live CLI agents, and templates.",
  applicationName: "Poke agents",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-svh flex flex-col font-sans">
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
