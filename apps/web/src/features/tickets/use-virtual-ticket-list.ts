import { useEffect, useRef, useState } from "react";

const DEFAULT_VIEWPORT_HEIGHT = 640;

export interface VirtualTicketListItem {
  index: number;
  start: number;
  size: number;
}

export function useVirtualTicketList(options: {
  itemCount: number;
  estimateSize: number;
  overscan?: number;
}) {
  const { itemCount, estimateSize, overscan = 4 } = options;
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const measurementsRef = useRef(new Map<number, number>());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [measurementVersion, setMeasurementVersion] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(container.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
    };

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    updateViewportHeight();
    handleScroll();

    container.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateViewportHeight();
            setMeasurementVersion((current) => current + 1);
          });

    resizeObserver?.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
    };
  }, []);

  const getItemSize = (index: number) => measurementsRef.current.get(index) ?? estimateSize;

  let totalSize = 0;
  let startIndex = 0;
  let startOffset = 0;

  while (startIndex < itemCount) {
    const nextSize = getItemSize(startIndex);

    if (startOffset + nextSize >= scrollTop) {
      break;
    }

    startOffset += nextSize;
    startIndex += 1;
  }

  let endIndex = startIndex;
  let endOffset = startOffset;

  while (endIndex < itemCount && endOffset <= scrollTop + viewportHeight) {
    endOffset += getItemSize(endIndex);
    endIndex += 1;
  }

  const visibleStart = Math.max(0, startIndex - overscan);
  const visibleEnd = Math.min(itemCount, endIndex + overscan);

  const items: VirtualTicketListItem[] = [];
  let cursor = 0;

  for (let index = 0; index < itemCount; index += 1) {
    const size = getItemSize(index);

    if (index >= visibleStart && index < visibleEnd) {
      items.push({
        index,
        start: cursor,
        size
      });
    }

    cursor += size;
  }

  totalSize = cursor;

  const measureElement = (index: number, element: HTMLElement | null) => {
    if (!element) {
      return;
    }

    const nextSize = Math.ceil(element.getBoundingClientRect().height);

    if (!nextSize || measurementsRef.current.get(index) === nextSize) {
      return;
    }

    measurementsRef.current.set(index, nextSize);
    setMeasurementVersion((current) => current + 1);
  };

  return {
    measurementVersion,
    scrollContainerRef,
    totalSize,
    virtualItems: items,
    measureElement
  };
}
