import type { Metadata } from "next";
import { Suspense } from "react";

import { AppPage } from "@/components/app-page";
import { DashboardBody } from "@/components/dashboard-body";
import { ChatWorkspace } from "@/components/chat-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Chat",
  description: "Transcript for one saved editor session.",
};

export default function ChatPage() {
  return (
    <AppPage>
      <Suspense
        fallback={
          <DashboardBody variant="fixed">
            <Skeleton className="min-h-[min(40dvh,18rem)] w-full flex-1 rounded-xl" />
          </DashboardBody>
        }
      >
        <ChatWorkspace />
      </Suspense>
    </AppPage>
  );
}
