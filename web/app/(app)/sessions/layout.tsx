import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sessions",
  description:
    "Browse Cursor and OpenCode chats from disk, open transcripts, and archive threads.",
};

export default function SessionsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 flex-col">{children}</div>
  );
}
