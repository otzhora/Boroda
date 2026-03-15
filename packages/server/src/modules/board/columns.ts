import { asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { boardColumns, tickets } from "../../db/schema";
import { AppError } from "../../shared/errors";

type AppDb = FastifyInstance["db"];
type TransactionCallback = Parameters<AppDb["transaction"]>[0];
type DbTransaction = TransactionCallback extends (tx: infer Tx, ...args: never[]) => unknown ? Tx : never;
type DbExecutor = AppDb | DbTransaction;
type BoardColumnRecord = typeof boardColumns.$inferSelect;
type BoardColumnOrderItem = Pick<BoardColumnRecord, "id" | "position">;

export const DEFAULT_BOARD_COLUMNS = [
  { status: "INBOX", label: "Inbox", position: 0 },
  { status: "READY", label: "Ready", position: 1 },
  { status: "IN_PROGRESS", label: "In Progress", position: 2 },
  { status: "BLOCKED", label: "Blocked", position: 3 },
  { status: "IN_REVIEW", label: "In Review", position: 4 },
  { status: "MANUAL_UI", label: "Manual UI", position: 5 },
  { status: "DONE", label: "Done", position: 6 }
] as const;

export async function listBoardColumns(app: FastifyInstance) {
  return ensureBoardColumnsPresent(app);
}

export function listBoardColumnsFromDb(db: DbExecutor): BoardColumnRecord[] {
  return db.select().from(boardColumns).orderBy(asc(boardColumns.position), asc(boardColumns.id)).all();
}

export function createStatusKey(label: string, existingStatuses: Iterable<string>) {
  const normalizedBase =
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "COLUMN";
  const taken = new Set(Array.from(existingStatuses, (status) => status.toUpperCase()));

  if (!taken.has(normalizedBase)) {
    return normalizedBase;
  }

  let suffix = 2;
  while (taken.has(`${normalizedBase}_${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedBase}_${suffix}`;
}

export async function ensureBoardStatusExists(app: FastifyInstance, status: string) {
  const columns = await ensureBoardColumnsPresent(app);
  const existing = columns.find((column) => column.status === status);

  if (!existing) {
    throw new AppError(400, "INVALID_STATUS", `Unknown board status: ${status}`, {
      status,
      allowedStatuses: columns.map((column) => ({
        status: column.status,
        label: column.label
      }))
    });
  }
}

export async function ensureBoardColumnsPresent(app: FastifyInstance) {
  const existing = listBoardColumnsFromDb(app.db);

  if (existing.length) {
    return existing;
  }

  app.db.insert(boardColumns).values([...DEFAULT_BOARD_COLUMNS]).run();
  return listBoardColumnsFromDb(app.db);
}

export function ensureColumnsForStatuses(
  db: DbExecutor,
  statuses: string[]
) {
  const existing = listBoardColumnsFromDb(db);
  const existingStatuses = new Set(existing.map((column) => column.status));

  if (!statuses.length || statuses.every((status) => existingStatuses.has(status))) {
    return existing;
  }

  const nextPositionStart = existing.length;
  const rows = statuses
    .filter((status, index, values) => values.indexOf(status) === index && !existingStatuses.has(status))
    .map((status, index) => ({
      status,
      label: formatStatusLabel(status),
      position: nextPositionStart + index
    }));

  if (rows.length) {
    db.insert(boardColumns).values(rows).run();
  }

  return listBoardColumnsFromDb(db);
}

export function formatStatusLabel(status: string) {
  return status
    .trim()
    .split(/_+/)
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getBoardColumnTempBase(columnCount: number) {
  return columnCount + 8;
}

function persistBoardColumnOrder(
  db: DbTransaction,
  orderedColumns: BoardColumnOrderItem[],
  now: string
) {
  const tempBase = getBoardColumnTempBase(orderedColumns.length);

  orderedColumns.forEach((column, index) => {
    db.update(boardColumns)
      .set({
        position: tempBase + index,
        updatedAt: now
      })
      .where(eq(boardColumns.id, column.id))
      .run();
  });

  orderedColumns.forEach((column, index) => {
    db.update(boardColumns)
      .set({
        position: index,
        updatedAt: now
      })
      .where(eq(boardColumns.id, column.id))
      .run();
  });
}

export async function deleteBoardColumn(app: FastifyInstance, status: string) {
  return app.db.transaction((tx) => {
    const columns = listBoardColumnsFromDb(tx);
    const target = columns.find((column) => column.status === status);

    if (!target) {
      throw new AppError(404, "BOARD_COLUMN_NOT_FOUND", "Board column not found", { status });
    }

    const activeTicket = tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(sql`${tickets.status} = ${status} and ${tickets.archivedAt} is null`)
      .get();

    if (activeTicket) {
      throw new AppError(409, "BOARD_COLUMN_NOT_EMPTY", "Only empty board columns can be deleted", { status });
    }

    if (columns.length <= 1) {
      throw new AppError(409, "BOARD_COLUMN_REQUIRED", "At least one board column must remain");
    }

    tx.delete(boardColumns).where(eq(boardColumns.id, target.id)).run();
    const now = new Date().toISOString();
    const remainingColumns = columns.filter((column) => column.id !== target.id);
    persistBoardColumnOrder(tx, remainingColumns, now);

    return listBoardColumnsFromDb(tx);
  });
}

export async function renameBoardColumn(
  app: FastifyInstance,
  input: { status: string; label: string }
) {
  return app.db.transaction((tx) => {
    const target = tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(eq(boardColumns.status, input.status))
      .get();

    if (!target) {
      throw new AppError(404, "BOARD_COLUMN_NOT_FOUND", "Board column not found", { status: input.status });
    }

    tx.update(boardColumns)
      .set({
        label: input.label.trim(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(boardColumns.id, target.id))
      .run();

    return listBoardColumnsFromDb(tx);
  });
}

export async function insertBoardColumn(
  app: FastifyInstance,
  input: { label: string; relativeToStatus: string; placement: "before" | "after" }
) {
  return app.db.transaction((tx) => {
    const columns = listBoardColumnsFromDb(tx);
    const targetIndex = columns.findIndex((column) => column.status === input.relativeToStatus);

    if (targetIndex === -1) {
      throw new AppError(404, "BOARD_COLUMN_NOT_FOUND", "Reference board column not found", {
        relativeToStatus: input.relativeToStatus
      });
    }

    const insertIndex = input.placement === "before" ? targetIndex : targetIndex + 1;
    const status = createStatusKey(
      input.label,
      columns.map((column) => column.status)
    );
    const now = new Date().toISOString();
    tx.insert(boardColumns)
      .values({
        status,
        label: input.label.trim(),
        position: getBoardColumnTempBase(columns.length + 1) * 2,
        createdAt: now,
        updatedAt: now
      })
      .run();

    const insertedColumnId = tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(eq(boardColumns.status, status))
      .get()?.id;

    if (!insertedColumnId) {
      throw new AppError(500, "BOARD_COLUMN_INSERT_FAILED", "Failed to create board column");
    }

    const reorderedColumns = [
      ...columns.slice(0, insertIndex),
      { id: insertedColumnId, position: insertIndex },
      ...columns.slice(insertIndex)
    ];

    persistBoardColumnOrder(tx, reorderedColumns, now);

    return listBoardColumnsFromDb(tx);
  });
}
