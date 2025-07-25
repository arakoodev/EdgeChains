import Jsonnet from "@arakoodev/jsonnet";
import { describe, it, expect } from "vitest";

describe("jsonnet", () => {
  it("evaluates with callbacks", () => {
    const jsonnet = new Jsonnet();
    jsonnet.javascriptCallback(
      "add",
      (a: any, b: any) => Number(a) + Number(b),
    );
    const out = jsonnet.evaluateSnippet("arakoo.native('add')(1,2)");
    expect(JSON.parse(out)).toBe("3");
  });
});
