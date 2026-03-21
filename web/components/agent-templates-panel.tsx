"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchAgentTemplates,
  mutateAgentTemplates,
  type AgentTemplateRow,
} from "@/lib/poke-agents-api";
import { cn } from "@/lib/utils";

const textareaClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full min-w-0 rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3 disabled:opacity-50 dark:bg-input/30";

type FormState = {
  id: string;
  title: string;
  summary: string;
  promptPreamble: string;
  pokeHint: string;
};

const emptyForm: FormState = {
  id: "",
  title: "",
  summary: "",
  promptPreamble: "",
  pokeHint: "",
};

export function AgentTemplatesPanel() {
  const [templates, setTemplates] = useState<AgentTemplateRow[]>([]);
  const [storagePath, setStoragePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetchAgentTemplates();
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      setTemplates([]);
      return;
    }
    setTemplates(r.templates);
    setStoragePath(r.storage_path);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setIsNew(true);
    setForm(emptyForm);
    setSheetError(null);
    setSheetOpen(true);
  };

  const openEdit = (t: AgentTemplateRow) => {
    if (t.built_in) return;
    setIsNew(false);
    setForm({
      id: t.id,
      title: t.title,
      summary: t.summary,
      promptPreamble: t.promptPreamble,
      pokeHint: t.pokeHint,
    });
    setSheetError(null);
    setSheetOpen(true);
  };

  const applyList = (r: Awaited<ReturnType<typeof mutateAgentTemplates>>) => {
    if (!r.ok) {
      setSheetError(r.error);
      return false;
    }
    setTemplates(r.templates);
    setStoragePath(r.storage_path);
    setSheetError(null);
    return true;
  };

  const save = async () => {
    const id = form.id.trim();
    if (!id) {
      setSheetError("Id is required (e.g. my-reviewer).");
      return;
    }
    setSaving(true);
    setSheetError(null);
    const r = await mutateAgentTemplates({
      upsert: {
        id,
        title: form.title,
        summary: form.summary,
        promptPreamble: form.promptPreamble,
        pokeHint: form.pokeHint,
      },
    });
    setSaving(false);
    if (applyList(r)) {
      setSheetOpen(false);
    }
  };

  const remove = async (t: AgentTemplateRow) => {
    if (t.built_in) return;
    if (
      !window.confirm(
        `Remove custom template "${t.id}"? Built-ins cannot be deleted.`,
      )
    ) {
      return;
    }
    const r = await mutateAgentTemplates({ delete_id: t.id });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTemplates(r.templates);
    setStoragePath(r.storage_path);
  };

  return (
    <section id="agent-templates" className="scroll-mt-24">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Agent templates</CardTitle>
            <CardDescription>
              Custom rows persist on disk (see path below). Poke can also call
              the MCP tool{" "}
              <code className="font-mono text-xs">agent_templates</code>{" "}
              (<code className="font-mono text-xs">list</code> /{" "}
              <code className="font-mono text-xs">upsert</code> /{" "}
              <code className="font-mono text-xs">delete</code>).
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="shrink-0 gap-1"
            onClick={openNew}
          >
            <PlusIcon className="size-4" />
            New template
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {storagePath ? (
            <p className="text-muted-foreground font-mono text-[0.65rem] break-all">
              {storagePath}
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No templates returned. Is{" "}
              <code className="font-mono text-xs">npm run start:http</code>{" "}
              running?
            </p>
          ) : (
            <div className="grid gap-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="bg-muted/30 space-y-2 rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.title}</span>
                        {t.built_in ? (
                          <Badge variant="secondary" className="text-[0.65rem]">
                            Built-in
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[0.65rem]">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <code className="text-muted-foreground font-mono text-xs">
                        template:{t.id}
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            `${t.promptPreamble}\n\n`,
                          );
                        }}
                      >
                        Copy preamble
                      </Button>
                      {!t.built_in ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => openEdit(t)}
                          >
                            <PencilIcon className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-8 gap-1 text-xs"
                            onClick={() => void remove(t)}
                          >
                            <TrashIcon className="size-3.5" />
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {t.summary}
                  </p>
                  <p className="text-muted-foreground text-[0.65rem] leading-snug">
                    {t.pokeHint}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {isNew ? "New template" : "Edit template"}
            </SheetTitle>
            <SheetDescription>
              {isNew
                ? "Choose a stable id (letters, numbers, hyphens). It becomes template:id in prompts."
                : "Updating keeps the same id."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              Id
              <Input
                value={form.id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id: e.target.value }))
                }
                disabled={!isNew}
                className={cn(!isNew && "opacity-80")}
                placeholder="e.g. security-audit"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              Title
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Short label"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              Summary
              <textarea
                className={cn(textareaClass, "min-h-[4.5rem]")}
                value={form.summary}
                onChange={(e) =>
                  setForm((f) => ({ ...f, summary: e.target.value }))
                }
                placeholder="One or two lines for the dashboard card"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              Prompt preamble
              <textarea
                className={cn(textareaClass, "min-h-[8rem] font-mono text-xs")}
                value={form.promptPreamble}
                onChange={(e) =>
                  setForm((f) => ({ ...f, promptPreamble: e.target.value }))
                }
                placeholder="Prefix for control_agent / Composer prompts"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              Poke hint
              <textarea
                className={cn(textareaClass, "min-h-[5rem]")}
                value={form.pokeHint}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pokeHint: e.target.value }))
                }
                placeholder="How automation should invoke this template"
              />
            </label>
            {sheetError ? (
              <p className="text-destructive text-sm">{sheetError}</p>
            ) : null}
          </div>
          <SheetFooter className="flex flex-row flex-wrap gap-2 border-t pt-4">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
