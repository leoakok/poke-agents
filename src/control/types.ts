export type ControlProviderId = "cursor" | "opencode";

export interface SpawnResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ControlProviderMeta {
  id: ControlProviderId;
  label: string;
  /** Features this MCP implements for the provider today */
  features: {
    create_empty_chat: boolean;
    run_headless_prompt: boolean;
    resume_chat_by_id: boolean;
    continue_previous_cli: boolean;
    cli_identity_status: boolean;
    disk_session_snapshot: boolean;
    stop_session_via_cli: boolean;
    list_chats_via_cli: boolean;
  };
  notes?: string[];
}
