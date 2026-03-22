import type { Metadata } from "next";
import { Suspense } from "react";

import { AppPage } from "@/components/app-page";
import { DashboardBody } from "@/components/dashboard-body";
import { SessionsWorkspace } from "@/components/sessions-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sessions",
  description: "Browse saved Cursor and OpenCode chats from disk.",
};

export default function SessionsPage() {
  return (
    <AppPage>
      <Suspense fallback={<SessionsFallback />}>
        <SessionsWorkspace />
      </Suspense>
    </AppPage>
  );
}

function SessionsFallback() {
  return (
    <DashboardBody variant="fixed" className="gap-3">
      <Skeleton className="h-9 w-full max-w-xl shrink-0" />
      <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
    </DashboardBody>
  );
}
