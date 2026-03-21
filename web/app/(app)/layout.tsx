import type { ReactNode } from "react";

/**
 * Route groups set their own max-width; this wrapper only supplies flex growth.
 */
export default function AppSectionLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
