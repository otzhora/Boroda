import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownDescription } from "./markdown-description";

describe("MarkdownDescription", () => {
  it("restores bullet markers for unordered lists alongside images", () => {
    const { container } = render(
      <MarkdownDescription
        value={"* The finish\n* the beginign\n* why dies it renders like that\n\n![image](/api/tickets/2/images/example.png)"}
      />
    );

    const list = container.querySelector("ul");

    expect(list).not.toBeNull();
    expect(list).toHaveClass("list-disc");
    expect(list).toHaveClass("pl-6");
    expect(screen.getByRole("img", { name: "image" })).toBeInTheDocument();
  });

  it("keeps GFM task lists marker-free", () => {
    const { container } = render(<MarkdownDescription value={"- [x] Done\n- [ ] Pending"} />);

    const list = container.querySelector("ul");
    const items = Array.from(container.querySelectorAll("li"));
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));

    expect(list).not.toBeNull();
    expect(list).toHaveClass("list-none");
    expect(items).not.toHaveLength(0);
    expect(items.every((item) => item.classList.contains("list-none"))).toBe(true);
    expect(items.every((item) => item.classList.contains("flex"))).toBe(true);
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((checkbox) => checkbox.classList.contains("w-4"))).toBe(true);
  });
});
