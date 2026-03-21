"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SessionMessage } from "@/lib/poke-agents-api";
import { segmentMessageContent } from "@/lib/session-chat-segments";
import { cn } from "@/lib/utils";

/** Match vendor quirks (Cursor/OpenCode): mixed case, tool, function, empty. */
function roleKey(role: string | undefined | null): string {
  return (role ?? "").trim().toLowerCase();
}

function roleLabel(role: string | undefined | null): string {
  const k = roleKey(role);
  switch (k) {
    case "user":
      return "You";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
    case "unknown":
    case "":
      return "Assistant";
    case "tool":
    case "function":
    case "function_call":
    case "tool_result":
      return "Tool";
    default: {
      const raw = (role ?? "").trim();
      if (!raw) return "Assistant";
      // Title-case stray roles — avoid raw "UNKNOWN" from CSS uppercase + vendor casing
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }
}

/** Bubble alignment: everything except user/system is assistant-lane (in-thread). */
function messageLane(
  role: string | undefined | null,
): "user" | "assistant" | "system" {
  const k = roleKey(role);
  if (k === "user") return "user";
  if (k === "system") return "system";
  return "assistant";
}

function MarkdownThinkingFence({
  raw,
  lang,
  nested,
}: {
  raw: string;
  lang: string;
  nested: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border bg-muted/25 my-2 rounded-lg border border-dashed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground hover:bg-muted/40 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium select-none"
      >
        <span className="w-3 shrink-0 opacity-70" aria-hidden>
          {open ? "▼" : "▸"}
        </span>
        <span>Thinking ({lang})</span>
      </button>
      {open ? (
        <div className="border-border max-h-64 overflow-y-auto border-t p-3 text-sm leading-relaxed">
          <MarkdownBody text={raw} compact nested={nested} />
        </div>
      ) : null}
    </div>
  );
}

function InlineMdCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className={cn(
        "rounded border border-border/50 bg-muted/70 px-1 py-px font-mono text-[0.85em] text-foreground",
        "dark:border-border/60 dark:bg-muted/50",
      )}
    >
      {children}
    </code>
  );
}

/** Fenced / block code only — toggle to show body. Inline code uses plain styled `<code>`. */
function CollapsibleCodeBlock({
  raw,
  lang,
  defaultOpen,
}: {
  raw: string;
  lang: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-border bg-muted/30 my-2 overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left font-mono text-xs font-medium select-none"
      >
        <span className="w-3 shrink-0 opacity-70" aria-hidden>
          {open ? "▼" : "▸"}
        </span>
        <span className="min-w-0 truncate">{lang}</span>
      </button>
      {open ? (
        <pre className="border-border max-h-[min(70vh,32rem)] overflow-auto border-t p-3 font-mono text-xs leading-relaxed">
          <code className="text-inherit">{raw}</code>
        </pre>
      ) : null}
    </div>
  );
}

function buildMarkdownComponents(
  opts: { compact?: boolean; nested?: boolean } = {},
): Components {
  const compact = opts.compact ?? false;
  const nested = opts.nested ?? false;

  const code: Components["code"] = (props) => {
    const { children, className } = props;
    const raw = String(children).replace(/\n$/, "");
    const classStr = String(className ?? "");
    /** Fenced blocks from remark/rehype get `language-xyz` (syntax highlighting). */
    const hasFenceLanguage = /\blanguage-[A-Za-z0-9_-]+\b/.test(classStr);
    const singleLine = !/\r|\n/.test(raw);
    const inlineFlag = (props as { inline?: boolean }).inline === true;

    // Inline backticks, OR models often wrap paths/filenames in ``` ``` with no language — no toggle.
    const treatAsInline =
      inlineFlag ||
      (singleLine &&
        raw.length <= 240 &&
        !hasFenceLanguage);

    if (treatAsInline) {
      return <InlineMdCode>{children}</InlineMdCode>;
    }

    const lang =
      /language-(\w+)/.exec(classStr)?.[1]?.toLowerCase() ?? "code";

    if (
      !nested &&
      (lang === "thinking" ||
        lang === "reasoning" ||
        lang === "chain-of-thought")
    ) {
      return (
        <MarkdownThinkingFence raw={raw} lang={lang} nested={nested} />
      );
    }

    const long = raw.length > 560;
    return (
      <CollapsibleCodeBlock
        raw={raw}
        lang={lang}
        defaultOpen={!long}
      />
    );
  };

  return {
    pre: ({ children }) => <>{children}</>,
    code,
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary font-medium underline underline-offset-2"
        target="_blank"
        rel="noreferrer noopener"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul
        className={cn(
          "my-2 list-disc space-y-1",
          compact ? "pl-4" : "pl-5",
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          "my-2 list-decimal space-y-1",
          compact ? "pl-4" : "pl-5",
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={cn("leading-relaxed", compact && "text-sm")}>
        {children}
      </li>
    ),
    p: ({ children }) => (
      <p
        className={cn(
          "my-2 leading-relaxed first:mt-0 last:mb-0",
          compact && "my-1.5 text-sm",
        )}
      >
        {children}
      </p>
    ),
    h1: ({ children }) => (
      <h1
        className={cn(
          "mt-3 mb-2 font-semibold",
          compact ? "text-sm" : "text-base",
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-3 mb-2 text-sm font-semibold">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-muted-foreground/40 text-muted-foreground my-2 border-l-2 pl-3 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-border my-4" />,
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="border-border text-sm border">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-border bg-muted/50 border px-2 py-1 text-left font-medium">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-border border px-2 py-1 align-top">{children}</td>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
  };
}

function MarkdownBody({
  text,
  compact,
  nested,
}: {
  text: string;
  compact?: boolean;
  nested?: boolean;
}) {
  const components = useMemo(
    () => buildMarkdownComponents({ compact, nested }),
    [compact, nested],
  );

  if (!text.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "min-w-0 break-words [overflow-wrap:anywhere]",
        compact ? "text-sm" : "text-sm",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingSegment({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border bg-muted/20 my-2 rounded-lg border border-dashed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground hover:bg-muted/40 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium select-none"
      >
        <span className="w-3 shrink-0 opacity-70" aria-hidden>
          {open ? "▼" : "▸"}
        </span>
        <span>Thinking</span>
      </button>
      {open ? (
        <div className="border-border max-h-72 overflow-y-auto border-t p-3">
          <MarkdownBody text={text} compact nested />
        </div>
      ) : null}
    </div>
  );
}

function MessageBody({ content, isUser }: { content: string; isUser: boolean }) {
  const segments = useMemo(() => segmentMessageContent(content), [content]);

  if (segments.length === 0) {
    return null;
  }

  const nodes: ReactNode[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "thinking") {
      nodes.push(<ThinkingSegment key={`t-${i}`} text={seg.text} />);
    } else {
      nodes.push(<MarkdownBody key={`m-${i}`} text={seg.text} />);
    }
  }

  return (
    <div
      className={cn(
        "min-w-0",
        isUser &&
          cn(
            "text-primary-foreground [&_a]:text-primary-foreground [&_a]:underline",
            "[&_code]:border-primary-foreground/30 [&_code]:bg-primary-foreground/12 [&_code]:text-primary-foreground",
          ),
      )}
    >
      {nodes}
    </div>
  );
}

export function SessionChat({
  messages,
  className,
  variant = "embedded",
}: {
  messages: SessionMessage[];
  className?: string;
  /** `page` = tall scroll area for the dedicated chat route. */
  variant?: "embedded" | "page";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = gap < 120;
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground min-h-0 flex-1 px-1 py-6 text-center text-sm">
        No messages in this thread.
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={cn(
        variant === "page"
          ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
          : "max-h-[min(70vh,52rem)] overflow-y-auto overscroll-contain",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-3">
        {messages.map((m, i) => {
          const lane = messageLane(m.role);
          const isUser = lane === "user";
          const isAssistant = lane === "assistant";
          const isSystem = lane === "system";
          return (
            <div
              key={`${i}-${m.role}-${m.content.length}`}
              className={cn(
                "flex w-full min-w-0 flex-col gap-1",
                isUser && "items-end",
                isAssistant && "items-start",
                isSystem && "items-center",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 max-w-[min(100%,42rem)] flex-col gap-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                  isUser &&
                    "bg-primary text-primary-foreground rounded-br-md",
                  isAssistant &&
                    "bg-card text-card-foreground border-border rounded-bl-md border",
                  isSystem &&
                    "bg-muted/80 text-muted-foreground max-w-lg rounded-lg border border-dashed text-xs",
                )}
              >
                <div
                  className={cn(
                    "text-muted-foreground text-[0.65rem] font-medium tracking-tight",
                    isUser && "text-primary-foreground/85",
                  )}
                >
                  {roleLabel(m.role)}
                  {m.model ? (
                    <span
                      className={cn(
                        "ml-1.5 font-normal normal-case",
                        isUser
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      · {m.model}
                    </span>
                  ) : null}
                </div>
                <MessageBody content={m.content} isUser={isUser} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
