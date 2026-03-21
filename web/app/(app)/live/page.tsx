import { LiveProcessesPanel } from "@/components/live-processes-panel";

export default function LivePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        This page lists <strong>CLI</strong> agent processes visible to the
        poke-agents HTTP server. It does not list Composer sessions that exist
        only inside the Cursor window.
      </p>
      <LiveProcessesPanel />
    </div>
  );
}
