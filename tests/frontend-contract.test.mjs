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

test("lesson companion context is bounded and excludes answer keys and tests", () => {
  const result = CompanionRequestSchema.safeParse({
    output_language: "fr",
    message: "Donne-moi un indice.",
    lesson: {
      title: "Construire un serveur MCP",
      objective: "Compléter une fonction Python.",
      sequence: "Pratique",
      instructions: "Valide les entrées et retourne le total.",
      code: "def calculate_total(price, quantity): pass",
      feedback: "Une vérification échoue.",
    },
  });
  assert.equal(result.success, true);
  const invalid = CompanionRequestSchema.safeParse({
    output_language: "en", message: "Help", lesson: {
      title: "MCP", objective: "Learn", sequence: "Practice", instructions: "Try it",
      hidden_test_harness: "secret", fixed_solution: "secret",
    },
  });
  assert.equal(invalid.success, false);
});
