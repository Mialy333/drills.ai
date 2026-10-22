// Links from each drill to the chapters of Mialy's library (my-building-library) that
// teach the idea behind it: do the drill, reread the idea, come back to the drill.
// Slugs come from src/data/books.ts in that repo: concept() chapters are "chapter-NN",
// sessions "session-NN", steps use their own slug.

import type { Lang } from "./drills";

export const LIBRARY = "https://my-building-library.vercel.app";

type Ref = { book: string; slug: string; fr: string; en: string };

const books: Record<string, { fr: string; en: string }> = {
  "python-for-ai-101": { fr: "Python for AI 101", en: "Python for AI 101" },
  "baa-101": { fr: "BAA 101", en: "BAA 101" },
  dev3pack: { fr: "Dev3Pack", en: "Dev3Pack" },
  "aws-scholars": { fr: "AWS Scholars", en: "AWS Scholars" },
};

const py = (n: number, fr: string, en: string): Ref => ({ book: "python-for-ai-101", slug: `chapter-${String(n).padStart(2, "0")}`, fr, en });
const baa = (n: number, fr: string, en: string): Ref => ({ book: "baa-101", slug: `chapter-${String(n).padStart(2, "0")}`, fr, en });
const d3p = (slug: string, fr: string, en: string): Ref => ({ book: "dev3pack", slug, fr, en });
const aws = (n: number, fr: string, en: string): Ref => ({ book: "aws-scholars", slug: `chapter-${String(n).padStart(2, "0")}`, fr, en });

const C = {
  pyData: py(3, "Les données", "Data"),
  pyAws: py(4, "Les données AWS", "AWS data"),
  pyText: py(5, "Le texte", "Text"),
  pyControl: py(6, "Le contrôle", "Control flow"),
  pyErrors: py(7, "Les erreurs et les garde-fous", "Errors and guardrails"),
  pyProject: py(2, "Organiser le projet", "Organizing the project"),
  pyNet: py(10, "Le réseau, le temps et la concurrence", "Network, time and concurrency"),
  pyTests: py(12, "Tester et évaluer", "Testing and evaluating"),
  baaEffect: baa(1, "Vérifier l'effet, pas la parole", "Verify the effect, not the claim"),
  baaOutput: baa(5, "La sortie du modèle est une donnée non fiable", "The model's output is untrusted data"),
  baaRefusal: baa(6, "Le refus est un état", "Refusal is a state"),
  baaPage: baa(7, "La bonne page doit arriver", "The right page must arrive"),
  baaToolCall: baa(8, "Lire l'appel d'outil, pas la réponse", "Read the tool call, not the answer"),
  baaEval: baa(9, "Évaluer sans se mentir", "Evaluate without lying to yourself"),
  baaMemory: baa(10, "La mémoire a un propriétaire", "Memory has an owner"),
  baaCode: baa(11, "Ce qui doit toujours arriver s'impose dans le code", "What must always happen is enforced in code"),
  d3Structured: d3p("session-03", "Sorties structurées", "Structured outputs"),
  d3Trace: d3p("session-09", "Tracer et évaluer", "Tracing and evaluation"),
  d3Final: d3p("final", "Final assignment", "Final assignment"),
  d3Gecko: d3p("gecko", "Gecko capstone", "Gecko capstone"),
  awsNova: aws(3, "NovaMart Multi-Agent Support", "NovaMart Multi-Agent Support"),
};

const byDrill: Record<string, Ref[]> = {
  d1: [C.pyText, C.d3Gecko],
  d2: [C.d3Trace, C.pyText],
  d3: [C.d3Final, C.baaPage],
  d4: [C.pyAws, C.awsNova],
  d5: [C.pyData, C.pyControl],
  d6: [C.pyNet, C.awsNova],
  d7: [C.pyErrors, C.baaToolCall],
  r1: [C.pyNet],
  r2: [C.pyControl],
  r3: [C.pyAws, C.awsNova],
  r4: [C.d3Gecko, C.baaCode],
  r5: [C.d3Final, C.baaPage],
  r6: [C.baaOutput, C.pyTests],
  l1: [C.pyAws, C.awsNova],
  l2: [C.d3Gecko, C.baaEffect],
  l3: [C.baaMemory, C.awsNova],
  l4: [C.pyProject],
  l5: [C.pyData, C.pyControl],
  f1: [C.pyTests],
  f2: [C.baaOutput, C.pyTests],
  f3: [C.pyControl, C.awsNova],
  f4: [C.pyNet, C.baaRefusal],
  f5: [C.pyText, C.d3Structured, C.baaOutput],
  f6: [C.baaEval, C.pyTests],
  f7: [C.pyData, C.baaEval],
  f8: [C.pyData, C.pyControl],
  f9: [C.baaEval, C.d3Final],
};

export function reviewLinks(id: string, lang: Lang) {
  return (byDrill[id] ?? []).map((r) => ({
    href: `${LIBRARY}/${lang}/books/${r.book}/${r.slug}/`,
    book: books[r.book][lang],
    title: r[lang],
  }));
}
