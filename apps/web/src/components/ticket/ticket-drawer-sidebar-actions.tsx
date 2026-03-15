import { TicketDrawerArchiveAction, TicketDrawerOpenSection } from "./ticket-drawer-open-section";
import type { useTicketDrawerOpenIn } from "./use-ticket-drawer-open-in";

interface TicketDrawerSidebarActionsProps {
  archivedAt: string | null;
  isArchiving: boolean;
  isRestoring: boolean;
  openIn: ReturnType<typeof useTicketDrawerOpenIn>;
  onArchive: () => void;
  onRestore: () => void;
}

export function TicketDrawerSidebarActions(props: TicketDrawerSidebarActionsProps) {
  const { openIn } = props;

  return (
    <>
      <TicketDrawerOpenSection
        availableTerminalFolders={openIn.availableTerminalFolders}
        selectedOpenMode={openIn.selectedOpenMode}
        selectedOpenTarget={openIn.selectedOpenTarget}
        selectedOpenTargetLabel={openIn.selectedOpenTargetLabel}
        hasAnyWorktree={openIn.hasAnyWorktree}
        isOpenInPending={openIn.isOpenInPending}
        isOpenInMenuOpen={openIn.isOpenInMenuOpen}
        openInMenuId={openIn.openInMenuId}
        openInMenuSide={openIn.openInMenuSide}
        openInMenuMaxHeight={openIn.openInMenuMaxHeight}
        openInFeedback={openIn.openInFeedback}
        openInStatusMessage={openIn.openInStatusMessage}
        openInStatusTone={openIn.openInStatusTone}
        openInActionButtonRef={openIn.openInActionButtonRef}
        openInToggleButtonRef={openIn.openInToggleButtonRef}
        openInMenuRef={openIn.openInMenuRef}
        openInAppButtonRefs={openIn.openInAppButtonRefs}
        onSelectMode={(mode) => {
          openIn.setSelectedOpenMode(mode);
          openIn.setOpenInFeedback({ phase: "idle" });
        }}
        onAction={() => {
          if (openIn.hasMultipleOpenFolders) {
            openIn.setIsFolderPickerOpen(true);
            return;
          }

          openIn.handleOpenInSelection(openIn.preferredProjectFolder?.id);
        }}
        onToggleMenu={() => {
          openIn.setIsOpenInMenuOpen((current) => !current);
        }}
        onSelectTarget={openIn.handleOpenInTarget}
        onMenuBlur={openIn.handleOpenInMenuBlur}
        onMenuKeyDown={openIn.handleOpenInMenuKeyDown}
      />
      <TicketDrawerArchiveAction
        archivedAt={props.archivedAt}
        isArchiving={props.isArchiving}
        isRestoring={props.isRestoring}
        onArchive={props.onArchive}
        onRestore={props.onRestore}
      />
    </>
  );
}
