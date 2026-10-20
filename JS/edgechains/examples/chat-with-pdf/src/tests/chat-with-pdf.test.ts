import { test, expect } from "vitest";

test("should be return expected answer", async () => {
    const res = await fetch("http://localhost:3000/chatWithpdf?question=who is Nirmala Sitharaman");

    const data = await res.json();
    expect(data.res).toString();
}, 40000);
