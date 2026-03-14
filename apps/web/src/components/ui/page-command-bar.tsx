import type { ReactNode } from "react";
import { AppHeaderActions, AppHeaderRightActions, useAppHeader } from "../../app/router";

interface PageCommandBarProps {
  actions: ReactNode;
  rightActions?: ReactNode;
  fallback?: ReactNode;
}

export function PageCommandBar({ actions, rightActions, fallback }: PageCommandBarProps) {
  const { hasHost } = useAppHeader();

  return (
    <>
      <AppHeaderActions>{actions}</AppHeaderActions>
      {rightActions ? <AppHeaderRightActions>{rightActions}</AppHeaderRightActions> : null}
      {!hasHost ? fallback : null}
    </>
  );
}
