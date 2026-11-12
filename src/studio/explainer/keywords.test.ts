import { describe, it, expect } from "vitest";
import { detectCues } from "./keywords";
describe("keyword bank", () => {
  it("link da bio maps to profile, not chat", () => {
    const tags = detectCues("Clique no link da bio").map((c) => c.tag);
    expect(tags).toContain("CTA_BIO");
    expect(tags).not.toContain("CHAT");
  });
  it("criar site maps to website", () => {
    expect(detectCues("1 criar um site").map((c) => c.tag)).toContain("WEBSITE");
  });
});
