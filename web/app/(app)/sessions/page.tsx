import { Suspense } from "react";

import { SessionsWorkspace } from "@/components/sessions-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsPage() {
  return (
    <Suspense fallback={<SessionsFallback />}>
      <SessionsWorkspace />
    </Suspense>
  );
}

function SessionsFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
