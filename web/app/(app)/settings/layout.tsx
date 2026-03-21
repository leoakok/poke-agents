import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Enable connectors and control which editor sources appear in session lists.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex-col">{children}</div>
  );
}
