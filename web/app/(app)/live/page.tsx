import { LiveProcessesPanel } from "@/components/live-processes-panel";

export default function LivePage() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-hidden">
      <p className="text-muted-foreground shrink-0 text-sm leading-relaxed">
        This page lists <strong>CLI</strong> agent processes visible to the
        poke-agents HTTP server. It does not list Composer sessions that exist
        only inside the Cursor window.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <LiveProcessesPanel />
      </div>
    </div>
  );
}
