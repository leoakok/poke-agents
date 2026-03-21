import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Chat",
  description: "Transcript for one saved editor session.",
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
