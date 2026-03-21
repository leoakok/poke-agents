import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Live processes",
  description:
    "Local Cursor agent CLI processes (ps scan), stop PIDs, link to matched disk sessions.",
};

export default function LiveLayout({ children }: { children: ReactNode }) {
  return children;
}
