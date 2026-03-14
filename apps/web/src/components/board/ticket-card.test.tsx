import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createBoardTicket } from "../../test/fixtures/models";
import { TicketCard } from "./ticket-card";

describe("TicketCard", () => {
  it("uses project colors for board chips when a badge color is available", () => {
    render(
      <DndContext>
        <TicketCard
          ticket={createBoardTicket({
            key: "PAY-42",
            title: "Wire board filters",
            priority: "HIGH",
            contextsCount: 1,
            updatedAt: "2026-03-06T00:00:00.000Z",
            projectBadges: [
              {
                id: 4,
                name: "Payments Backend",
                color: "#355c7d",
                relationship: "PRIMARY"
              }
            ],
            jiraIssues: []
          })}
          isSelected={false}
          isDragging={false}
          onSelect={() => undefined}
        />
      </DndContext>
    );

    const chip = screen.getByText("Payments Backend");
    expect(chip).toHaveStyle({
      backgroundColor: "rgb(53 92 125 / 0.12)",
      borderColor: "rgb(53 92 125 / 0.3)",
      color: "rgb(202 213 221)"
    });
  });

  it("keeps the default chip style when the project color is empty", () => {
    render(
      <DndContext>
        <TicketCard
          ticket={createBoardTicket({
            id: 13,
            key: "PAY-43",
            title: "Review board layout",
            status: "READY",
            updatedAt: "2026-03-06T00:00:00.000Z",
            projectBadges: [
              {
                id: 5,
                name: "Uncolored Project",
                color: "",
                relationship: "RELATED"
              }
            ],
            jiraIssues: []
          })}
          isSelected={false}
          isDragging={false}
          onSelect={() => undefined}
        />
      </DndContext>
    );

    const chip = screen.getByText("Uncolored Project");
    expect(chip).not.toHaveStyle({
      backgroundColor: "rgb(53 92 125 / 0.12)"
    });
  });
});
