"use client";

import type { ReactNode } from "react";
import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DOCS_BASE =
  "https://github.com/leoakok/poke-agents/blob/main/docs";

function InlineCode({ children }: { children: string }) {
  return (
    <code
      className={cn(
        "text-foreground rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]",
      )}
    >
      {children}
    </code>
  );
}

function GuideBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function DocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground hover:text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

export function OverviewGuides() {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <BookOpenIcon
              className="text-muted-foreground mt-0.5 size-5 shrink-0"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <CardTitle>Guides</CardTitle>
              <CardDescription>
                Templates, headless agents, and other features that are easier
                with a map than trial-and-error.
              </CardDescription>
            </div>
          </div>
          <Link
            href="/templates"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open templates
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <GuideBlock title="Agent templates">
          <ul className="list-disc space-y-2 pl-4">
            <li>
              <strong className="text-foreground">Built-in</strong> personas
              ship with the server; <strong className="text-foreground">
                custom
              </strong>{" "}
              ones are stored in{" "}
              <InlineCode>~/.poke-agents/agent-templates.json</InlineCode>{" "}
              (they survive{" "}
              <InlineCode>npx</InlineCode> / upgrades). Set{" "}
              <InlineCode>POKE_AGENTS_TEMPLATES_PATH</InlineCode> to use another
              file.
            </li>
            <li>
              On the <Link href="/templates" className="text-foreground font-medium underline-offset-4 hover:underline">Templates</Link>{" "}
              page: <strong className="text-foreground">New template</strong>{" "}
              creates a new <InlineCode>id</InlineCode>.{" "}
              <strong className="text-foreground">Customize</strong> on a
              built-in saves an <em>override</em> with the same id;{" "}
              <strong className="text-foreground">Reset</strong> removes your
              override and restores the default.
            </li>
            <li>
              From MCP / automation: tool{" "}
              <InlineCode>agent_templates</InlineCode> (
              <InlineCode>list</InlineCode>, <InlineCode>upsert</InlineCode>,{" "}
              <InlineCode>delete</InlineCode>). On{" "}
              <InlineCode>control_agent</InlineCode>, set{" "}
              <InlineCode>agent_template</InlineCode> to a template{" "}
              <InlineCode>id</InlineCode> — the server prepends that template’s{" "}
              <InlineCode>promptPreamble</InlineCode> to your prompt.
            </li>
            <li>
              Templates only change the <em>text</em> of the prompt. If a
              persona should actually run shell commands, you may need{" "}
              <InlineCode>force: true</InlineCode> on{" "}
              <InlineCode>control_agent</InlineCode> (see MCP docs —{" "}
              <InlineCode>trust</InlineCode> is workspace trust, not “run
              everything”).
            </li>
          </ul>
        </GuideBlock>

        <Separator />

        <GuideBlock title="Headless control_agent (Cursor / OpenCode / Codex)">
          <ul className="list-disc space-y-2 pl-4">
            <li>
              Env <InlineCode>POKE_AGENTS_CONTROL</InlineCode> chooses the CLI:{" "}
              <InlineCode>cursor</InlineCode> (default),{" "}
              <InlineCode>opencode</InlineCode>, or <InlineCode>codex</InlineCode>
              .
            </li>
            <li>
              <InlineCode>control_agent</InlineCode>{" "}
              <strong className="text-foreground">returns immediately</strong>{" "}
              with a <InlineCode>run_id</InlineCode> while the CLI keeps running.
              Poll <InlineCode>control_run_status</InlineCode> and{" "}
              <InlineCode>control_run_output_slice</InlineCode>, or configure a
              Poke callback URL/token for completion.
            </li>
          </ul>
        </GuideBlock>

        <Separator />

        <GuideBlock title="Sessions & connectors">
          <p>
            The <Link href="/settings" className="text-foreground font-medium underline-offset-4 hover:underline">Settings</Link>{" "}
            page toggles which editor data sources are scanned. When you start
            the stack from a shell, the profile env{" "}
            <InlineCode>POKE_AGENTS_EDITORS</InlineCode> (comma-separated editor
            ids) does the same thing.
          </p>
        </GuideBlock>

        <Separator />

        <GuideBlock title="Live vs MCP log">
          <ul className="list-disc space-y-2 pl-4">
            <li>
              <Link href="/live" className="text-foreground font-medium underline-offset-4 hover:underline">Live</Link>{" "}
              — local CLI processes (e.g. Cursor <InlineCode>agent</InlineCode>)
              the dashboard can see on this machine.
            </li>
            <li>
              <Link href="/mcp-traffic" className="text-foreground font-medium underline-offset-4 hover:underline">MCP log</Link>{" "}
              — JSON-RPC requests/responses through this MCP server (useful when
              wiring Poke or other clients).
            </li>
          </ul>
        </GuideBlock>

        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-sm">
          <DocLink href={`${DOCS_BASE}/AGENT_TEMPLATES.md`}>
            Agent templates (full doc)
          </DocLink>
          <DocLink href={`${DOCS_BASE}/MCP_TOOLS.md`}>MCP tools reference</DocLink>
          <DocLink href={`${DOCS_BASE}/SETUP_POKE_CURSOR_OPENCODE.md`}>
            Cursor / OpenCode setup
          </DocLink>
        </div>
      </CardContent>
    </Card>
  );
}
