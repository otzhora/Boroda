import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { detailTabs, type DetailTabId } from "./ticket-drawer-layout";

export function useTicketDrawerViewState(ticketId: number | null) {
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabId>("contexts");
  const [isJiraSectionExpanded, setIsJiraSectionExpanded] = useState(true);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const detailTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const detailTabsId = useId();
  const jiraSectionId = useId();

  useEffect(() => {
    setActiveDetailTab("contexts");
    setIsJiraSectionExpanded(true);
    setIsWorkspaceDrawerOpen(false);
  }, [ticketId]);

  const handleDetailTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = detailTabs.length - 1;
    let nextIndex = index;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = detailTabs[nextIndex];
    setActiveDetailTab(nextTab.id);
    detailTabRefs.current[nextIndex]?.focus();
  };

  return {
    activeDetailTab,
    isJiraSectionExpanded,
    isWorkspaceDrawerOpen,
    detailTabRefs,
    detailTabsId,
    jiraSectionId,
    setActiveDetailTab,
    setIsJiraSectionExpanded,
    setIsWorkspaceDrawerOpen,
    handleDetailTabKeyDown
  };
}
