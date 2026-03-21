import { AsyncLocalStorage } from "node:async_hooks";

export type McpRequestContext = {
  pokeCallbackUrl?: string;
  pokeCallbackToken?: string;
};

const storage = new AsyncLocalStorage<McpRequestContext>();

export function runWithMcpRequestContext<T>(
  ctx: McpRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

export function getMcpRequestContext(): McpRequestContext | undefined {
  return storage.getStore();
}
