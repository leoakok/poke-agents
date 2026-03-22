import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium">Page not found</p>
      <p className="text-muted-foreground max-w-xs text-sm">
        This path is not part of the dashboard.
      </p>
      <Button render={<Link href="/" />}>Overview</Button>
    </div>
  );
}
