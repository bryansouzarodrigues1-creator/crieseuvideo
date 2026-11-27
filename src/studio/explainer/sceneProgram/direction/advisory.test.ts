import { describe, expect, it } from "vitest";
import { advisory } from "./advisory";

describe("advisory", () => {
  it("asks once, then accepts and reports the leftovers as warnings", () => {
    const seen: string[][] = [];
    const check = advisory<number>(() => ["cofre de costas"], (p) => seen.push(p));
    expect(check(1)).toEqual(["cofre de costas"]);
    expect(check(2)).toEqual([]);
    expect(seen).toEqual([["cofre de costas"]]);
  });
  it("never complains when there is nothing to report", () => {
    expect(advisory<number>(() => [])(1)).toEqual([]);
    expect(advisory<number>(undefined)(1)).toEqual([]);
  });
});
