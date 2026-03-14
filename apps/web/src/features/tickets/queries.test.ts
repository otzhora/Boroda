import { describe, expect, it } from "vitest";
import { ticketItemsQueryKey, ticketListQueryKey } from "./queries";

describe("ticket query keys", () => {
  it("splits cache keys by response shape", () => {
    const filters = {
      q: "drawer",
      scope: "active" as const
    };

    expect(ticketItemsQueryKey(filters)).toEqual(["ticket-items", filters]);
    expect(ticketListQueryKey(filters)).toEqual(["ticket-list", filters]);
    expect(ticketItemsQueryKey(filters)).not.toEqual(ticketListQueryKey(filters));
  });
});
