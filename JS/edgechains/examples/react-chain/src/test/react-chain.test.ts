import { test, expect } from "vitest";

test("should be return expected answer", async () => {
    const res = await fetch(
        "http://localhost:5000?question=Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
    );

    const data = await res.json();
    expect(data).toContain("Bill Clinton");
}, 40000);
