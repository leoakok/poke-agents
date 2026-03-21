import { AgentTemplatesPanel } from "@/components/agent-templates-panel";

export default function TemplatesPage() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <AgentTemplatesPanel />
      </div>
    </div>
  );
}
