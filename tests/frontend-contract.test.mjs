import assert from "node:assert/strict";
import test from "node:test";
import { CompanionRequestSchema } from "../src/lib/contracts.ts";

test("companion request accepts the bounded browser conversation history", () => {
  const result = CompanionRequestSchema.safeParse({
    output_language: "fr",
    message: "Peux-tu m'aider à comprendre cette fonction ?",
    history: [
      { role: "user", content: "Explique le concept." },
      { role: "assistant", content: "Commençons par les paramètres." },
    ],
  });

  assert.equal(result.success, true);
});

test("companion request still rejects reference solutions", () => {
  const result = CompanionRequestSchema.safeParse({
    output_language: "en",
    message: "Help me reason through this exercise.",
    exercise: {
      title: "Validate input",
      context: "An API receives a payload.",
      mission: "Validate the request.",
      fixed_solution: "private reference solution",
    },
  });

  assert.equal(result.success, false);
});
