import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const EDITORS_INDEX = path.join(here, "../../vendor/session-editors/index.js");

export type VendorEditorModule = {
  name: string;
  labels?: Record<string, string>;
  sources?: string[];
  getChats: () => Record<string, unknown>[];
  getMessages: (chat: Record<string, unknown>) => unknown[];
};

export type VendorEditorsBundle = {
  getAllChats: () => Record<string, unknown>[];
  getMessages: (chat: Record<string, unknown>) => unknown[];
  editors: VendorEditorModule[];
  editorLabels: Record<string, string>;
};

let cached: VendorEditorsBundle | null = null;

export function loadVendorEditors(): VendorEditorsBundle {
  if (!cached) {
    cached = require(EDITORS_INDEX) as VendorEditorsBundle;
  }
  return cached;
}

/** Match vendored bundle `getMessages` dispatch (name, prefix, and `sources`). */
export function editorForChatSource(
  editors: VendorEditorModule[],
  chatSource: string
): VendorEditorModule | undefined {
  const exact = editors.find((e) => e.name === chatSource);
  if (exact) return exact;
  return editors.find(
    (e) =>
      Boolean(chatSource) &&
      (chatSource.startsWith(e.name) ||
        Boolean(e.sources?.includes(chatSource)))
  );
}

export function chatMatchesSourceFilter(
  chat: Record<string, unknown>,
  filter: string,
  editors: VendorEditorModule[]
): boolean {
  const src = String(chat.source ?? "");
  if (src === filter) return true;
  const ed = editorForChatSource(editors, src);
  return Boolean(ed && ed.name === filter);
}
