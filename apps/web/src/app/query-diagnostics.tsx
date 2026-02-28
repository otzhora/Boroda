import { useEffect } from "react";
import type { Query, QueryClient } from "@tanstack/react-query";

interface QueryDiagnosticsSnapshot {
  totalQueries: number;
  activeQueries: number;
  inactiveQueries: number;
  boardQueries: number;
  ticketQueries: number;
  projectQueries: number;
  updatedAt: string;
}

declare global {
  interface Window {
    __borodaQueryDiagnostics?: {
      getSnapshot: () => QueryDiagnosticsSnapshot;
      logSnapshot: () => QueryDiagnosticsSnapshot;
    };
  }
}

function matchesRootKey(query: Query, rootKey: string) {
  return Array.isArray(query.queryKey) && query.queryKey[0] === rootKey;
}

function buildSnapshot(queryClient: QueryClient): QueryDiagnosticsSnapshot {
  const queries = queryClient.getQueryCache().getAll();
  const activeQueries = queries.filter((query) => query.getObserversCount() > 0).length;

  return {
    totalQueries: queries.length,
    activeQueries,
    inactiveQueries: queries.length - activeQueries,
    boardQueries: queries.filter((query) => matchesRootKey(query, "board")).length,
    ticketQueries: queries.filter((query) => matchesRootKey(query, "ticket")).length,
    projectQueries: queries.filter((query) => matchesRootKey(query, "projects")).length,
    updatedAt: new Date().toISOString()
  };
}

export function QueryDiagnostics({ queryClient }: { queryClient: QueryClient }) {
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const setDiagnostics = () => {
      const getSnapshot = () => buildSnapshot(queryClient);

      window.__borodaQueryDiagnostics = {
        getSnapshot,
        logSnapshot: () => {
          const snapshot = getSnapshot();
          console.table(snapshot);
          return snapshot;
        }
      };
    };

    setDiagnostics();
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      setDiagnostics();
    });

    return () => {
      unsubscribe();

      if (window.__borodaQueryDiagnostics) {
        delete window.__borodaQueryDiagnostics;
      }
    };
  }, [queryClient]);

  return null;
}
