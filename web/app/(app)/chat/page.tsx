import { Suspense } from "react";

import { ChatWorkspace } from "@/components/chat-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[min(50dvh,24rem)] w-full" />}>
      <ChatWorkspace />
    </Suspense>
  );
}
