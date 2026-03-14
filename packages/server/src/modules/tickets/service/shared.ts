import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { sequences } from "../../../db/schema";
import { AppError } from "../../../shared/errors";

export function nowIso() {
  return new Date().toISOString();
}

export type AppDb = FastifyInstance["db"];
type TransactionCallback = Parameters<AppDb["transaction"]>[0];
export type DbTransaction = TransactionCallback extends (tx: infer Tx, ...args: never[]) => unknown ? Tx : never;
export type DbExecutor = AppDb | DbTransaction;

function isSqliteUniqueConstraintError(
  error: unknown,
  constraintTarget: string
): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
    error.message.includes(constraintTarget)
  );
}

export function rethrowTicketConflict(error: unknown): never {
  if (isSqliteUniqueConstraintError(error, "ticket_project_links.ticket_id, ticket_project_links.project_id")) {
    throw new AppError(409, "TICKET_PROJECT_LINK_CONFLICT", "Project is already linked to this ticket");
  }

  if (
    isSqliteUniqueConstraintError(
      error,
      "ticket_jira_issue_links.ticket_id, ticket_jira_issue_links.issue_key"
    )
  ) {
    throw new AppError(409, "TICKET_JIRA_LINK_CONFLICT", "Jira issue is already linked to this ticket");
  }

  throw error;
}

export function nextTicketKey(db: DbExecutor) {
  const existing = db
    .select()
    .from(sequences)
    .where(eq(sequences.name, "ticket"))
    .get();

  if (!existing) {
    db.insert(sequences).values({ name: "ticket", value: 1 }).run();
    return "BRD-1";
  }

  const nextValue = existing.value + 1;
  db
    .update(sequences)
    .set({ value: nextValue })
    .where(eq(sequences.name, "ticket"))
    .run();
  return `BRD-${nextValue}`;
}
