import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { PropsWithChildren } from "react";
import { BrowserDiagnostics } from "./browser-diagnostics";
import { QueryDiagnostics } from "./query-diagnostics";
import { logClientError, logClientEvent } from "../lib/logger";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logClientError("query.failed", error, {
        queryKey: query.queryKey,
        queryHash: query.queryHash
      });
    },
    onSuccess: (_data, query) => {
      logClientEvent("debug", "query.completed", {
        queryKey: query.queryKey,
        queryHash: query.queryHash
      });
    }
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, _context, mutation) => {
      logClientError("mutation.failed", error, {
        mutationKey: mutation.options.mutationKey,
        variables
      });
    },
    onSuccess: (_data, variables, _context, mutation) => {
      logClientEvent("info", "mutation.completed", {
        mutationKey: mutation.options.mutationKey,
        variables
      });
    }
  }),
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000
    }
  }
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <BrowserDiagnostics />
      {import.meta.env.DEV ? <QueryDiagnostics queryClient={queryClient} /> : null}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
