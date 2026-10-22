# Python Drills

Debugging, refactoring and code-reading drills for AI engineering, built from my own repositories. French and English, dark and light, installable as a desktop app that works offline.

**Live:** https://mialy333.github.io/python-drills/

![Retro-futuristic illustration of a developer coding on two CRT computers](public/og.jpg)

## Why

Most of my agent projects were written with an AI assistant. These drills train the part an interview checks: reading code I did not type, finding the bug, proving it with a test, and explaining it out loud. Every exercise comes from real code:

| Drill | Repository |
|---|---|
| D1 secret scanner, R4, L2 | [my-gecko-buyer](https://github.com/Mialy333/my-gecko-buyer) ([fix PR #2](https://github.com/Mialy333/my-gecko-buyer/pull/2)) |
| D3, R5, F5 | [grounded-research-agent](https://github.com/Mialy333/grounded-research-agent) ([tests PR #2](https://github.com/Mialy333/grounded-research-agent/pull/2)) |
| D4, D6, R3, L1, L3, F1 | [novamart-multi-agent-support](https://github.com/Mialy333/novamart-multi-agent-support) |
| D5, R1, R2, F4, F6, F7 | Black Monday 1987 (private hackathon build) |

## How it works

- 27 drills in four families: debugging, refactoring, code reading, interview formats.
- A timer per drill, compared to its target time.
- An 8-point grid (result, time, thinking out loud, test). Opening the solution caps the score at 4.
- A journal kept in the browser's local storage, with JSON export and import. Nothing is sent anywhere.
- Installable from Chrome or Safari (Install app / Add to Dock); a service worker caches every page for offline use.

## Run it

```bash
npm ci
npm run dev       # http://localhost:4321/python-drills/
npm run build     # static site in dist/, plus dist/sw.js
```

Content lives in `src/drills/{fr,en}/*.md`: front matter, the exercise, then `<!-- solution -->` and the solution. `scripts/write_fr.py` and `scripts/write_en.py` regenerate those files.

## What was written by whom

Drills, solutions and app code were drafted with Claude, from my repositories and my learning runbook; I review them and train on them. Every bug used as a drill was reproduced by running the code before it was written down.

## Stack

Astro 7, TypeScript, plain CSS. Fonts: Chakra Petch and VT323 (SIL Open Font License), self-hosted. Deployed with GitHub Actions to GitHub Pages.
