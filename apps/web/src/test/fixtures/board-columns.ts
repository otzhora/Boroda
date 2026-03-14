import type { BoardColumnDefinition } from "../../lib/types";

export const boardColumnsFixture: BoardColumnDefinition[] = [
  { id: 1, status: "INBOX", label: "Inbox", position: 0, createdAt: "", updatedAt: "" },
  { id: 2, status: "READY", label: "Ready", position: 1, createdAt: "", updatedAt: "" },
  { id: 3, status: "IN_PROGRESS", label: "In progress", position: 2, createdAt: "", updatedAt: "" },
  { id: 4, status: "DONE", label: "Done", position: 3, createdAt: "", updatedAt: "" }
];

export const defaultEditableBoardColumn = boardColumnsFixture[1];
export const doneBoardColumn = boardColumnsFixture.find((column) => column.status === "DONE")!;
