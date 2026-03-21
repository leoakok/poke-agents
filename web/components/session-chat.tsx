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

function roleLabel(role: string): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
    default:
      return role;
  }
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

function buildMarkdownComponents(
  opts: { compact?: boolean; nested?: boolean } = {},
): Components {
  const compact = opts.compact ?? false;
  const nested = opts.nested ?? false;

  const code: Components["code"] = (props) => {
    const { children, className } = props;
    const inline =
      "inline" in props &&
      (props as { inline?: boolean }).inline === true;

    if (inline) {
      return (
        <code
          className={cn(
            "rounded px-1 py-0.5 font-mono text-[0.85em]",
            "bg-background/25 text-inherit",
          )}
        >
          {children}
        </code>
      );
    }

    const raw = String(children).replace(/\n$/, "");
    const lang =
      /language-(\w+)/.exec(className ?? "")?.[1]?.toLowerCase() ?? "code";

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
      <details
        className="border-border bg-muted/30 my-2 overflow-hidden rounded-lg border"
        open={!long}
      >
        <summary className="text-muted-foreground cursor-pointer px-3 py-2 font-mono text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
          <span className="mr-1.5 opacity-60">▸</span>
          {lang}
        </summary>
        <pre className="border-border max-h-[min(70vh,32rem)] overflow-auto border-t p-3 font-mono text-xs leading-relaxed">
          <code>{raw}</code>
        </pre>
      </details>
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
        isUser && "text-primary-foreground [&_a]:text-primary-foreground [&_a]:underline",
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
      <p className="text-muted-foreground px-1 py-6 text-center text-sm">
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
          ? "max-h-[calc(100dvh-10rem)] min-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-9rem)]"
          : "max-h-[min(70vh,52rem)] overflow-y-auto overscroll-contain",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-3">
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isAssistant = m.role === "assistant";
          const isSystem = m.role === "system";
          return (
            <div
              key={`${i}-${m.role}-${m.content.length}`}
              className={cn(
                "flex w-full min-w-0 flex-col gap-1",
                isUser && "items-end",
                isAssistant && "items-start",
                (isSystem || (!isUser && !isAssistant)) && "items-center",
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
                  !isUser &&
                    !isAssistant &&
                    !isSystem &&
                    "bg-muted text-muted-foreground rounded-lg text-xs",
                )}
              >
                <div
                  className={cn(
                    "text-[0.65rem] font-medium tracking-wide uppercase",
                    isUser && "text-primary-foreground/85",
                    isAssistant && "text-muted-foreground",
                    isSystem && "text-muted-foreground",
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
