import { describe, it, expect } from "vitest";
import { legacyDatalayerColumns } from "@/lib/datalayer";

describe("legacyDatalayerColumns", () => {
  it("coerces primitives to strings", () => {
    const cols = legacyDatalayerColumns({
      plan: "pro",
      role: 42 as unknown as string,
      region: true as unknown as string,
    });
    expect(cols.plan).toBe("pro");
    expect(cols.role).toBe("42");
    expect(cols.region).toBe("true");
  });

  it("maps missing/null/undefined to null", () => {
    const cols = legacyDatalayerColumns(null);
    expect(cols.plan).toBeNull();
    expect(cols.role).toBeNull();
  });

  it("rejects non-primitives instead of storing junk like [object Object]", () => {
    const cols = legacyDatalayerColumns({
      plan: { name: "Pro" } as unknown as string,
      role: ["a", "b"] as unknown as string,
    });
    expect(cols.plan).toBeNull();
    expect(cols.role).toBeNull();
  });
});
