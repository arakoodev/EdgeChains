import { Cors } from "../../../../../dist/middleware/src/lib/cores/cors.js";
import cors from "cors";

describe("Cors", () => {
  it("should return the cors middleware", () => {
    // Call the Cors function
    const corsMiddleware = Cors();

    // Check if the returned value is the cors middleware
    expect(corsMiddleware).toEqual(cors);
  });
});
