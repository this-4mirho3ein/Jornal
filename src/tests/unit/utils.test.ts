import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("flex", "p-2")).toBe("flex p-2");
  });

  it("filters falsy values", () => {
    expect(cn("flex", false && "hidden", undefined, "text-sm")).toBe("flex text-sm");
  });

  it("lets later classes win on conflicts (tailwind-merge)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
