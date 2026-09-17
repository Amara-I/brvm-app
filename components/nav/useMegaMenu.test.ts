import { describe, expect, it } from "vitest";
import { isMegaMenuDismissKey, isOutsideNode } from "./useMegaMenu";

describe("mega-menu disclosure helpers", () => {
  it("dismisses on Escape only", () => {
    expect(isMegaMenuDismissKey("Escape")).toBe(true);
    expect(isMegaMenuDismissKey("Enter")).toBe(false);
    expect(isMegaMenuDismissKey(" ")).toBe(false);
  });

  it("treats a click outside the wrapper as dismiss", () => {
    const inside = { id: 1 } as unknown as Node;
    const outside = { id: 2 } as unknown as Node;
    const root = { contains: (node: Node) => node === inside };
    expect(isOutsideNode(root, inside)).toBe(false);
    expect(isOutsideNode(root, outside)).toBe(true);
    expect(isOutsideNode(null, inside)).toBe(true);
  });
});
