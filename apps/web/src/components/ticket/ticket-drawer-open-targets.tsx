import type { OpenInTarget } from "../../lib/types";
import { AppWindowIcon, FolderIcon } from "./ticket-drawer-primitives";

export const openInTargets: Array<{
  id: OpenInTarget;
  label: string;
  description: string;
}> = [
  {
    id: "vscode",
    label: "VS Code",
    description: "Open the linked folder in Visual Studio Code."
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Open the linked folder in Cursor."
  },
  {
    id: "explorer",
    label: "File Explorer",
    description: "Open the linked folder in Explorer."
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Open the linked folder in Terminal."
  }
];

export function getOpenInTargetIcon(target: OpenInTarget) {
  if (target === "explorer") {
    return <FolderIcon className="h-4 w-4 shrink-0 text-amber-200" />;
  }

  return <AppWindowIcon className="h-4 w-4 shrink-0 text-sky-200" />;
}
