import { describe, it, expect } from "vitest";
import { providerOrder } from "./ai";
describe("providerOrder", () => {
  it("direção prefere a IA do Lovable", () => expect(providerOrder("direction", true)).toEqual(["lovable", "gemini"]));
  it("tarefas leves vão primeiro ao Gemini", () => expect(providerOrder("light", true)).toEqual(["gemini", "lovable"]));
  it("sem chave do Gemini usa só Lovable", () => expect(providerOrder("light", false)).toEqual(["lovable"]));
});
