import { Suspense } from "react";

import { ChatWorkspace } from "@/components/chat-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Skeleton className="min-h-[min(40dvh,18rem)] w-full flex-1" />
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
