<div align="center">

# ▶ DRILLS

**Interview reps for AI engineers. Real bugs from real agents, real Python in your browser, a score that does not lie.**

[![Play now](https://img.shields.io/badge/%E2%96%B6%20PLAY-mialy333.github.io%2Fdrills.ai-ff7ab8?style=for-the-badge&labelColor=1c1638)](https://mialy333.github.io/drills.ai/)
[![Drills](https://img.shields.io/badge/drills-27-5cf0a2?style=for-the-badge&labelColor=1c1638)](https://mialy333.github.io/drills.ai/fr/python/)
[![Badges](https://img.shields.io/badge/badges-22-f2c14e?style=for-the-badge&labelColor=1c1638)](https://mialy333.github.io/drills.ai/fr/progress/)
[![FR · EN](https://img.shields.io/badge/FR%20%C2%B7%20EN-offline%20PWA-8ef5bf?style=for-the-badge&labelColor=1c1638)](#install-it)

![Retro-futuristic illustration: a developer codes on two CRT computers in front of a purple city at sunset](public/og.jpg)

</div>

```text
> PLAYER 1 READY
> TRACK: PYTHON ........ 27 DRILLS
> TRACK: TYPESCRIPT .... COMING SOON
> RULES: NO AI · OUT LOUD · TIMER ON
> PRESS START
```

## The game loop

```text
 ┌─ pick a drill ─┐   ┌─ answer ──────────────┐   ┌─ score /8 ─┐   ┌─ level up ─┐
 │ brief written  │ → │ code runs in Pyodide, │ → │ 2 auto      │ → │ XP, badges │
 │ like an        │   │ written answers are   │   │ 2 self-rated│   │ streak,    │
 │ assessment     │   │ checked idea by idea  │   │             │   │ dashboard  │
 └────────────────┘   └───────────────────────┘   └─────────────┘   └─────┬──────┘
          ▲                                                               │
          └──────── reread the idea in my library, then beat your score ◄─┘
```

Every drill links to the chapters of my portfolio library,
[my-building-library](https://my-building-library.vercel.app/), that teach the idea behind it.
Missed a drill? Reread the chapter, come back, retry. Unlimited attempts; the dashboard shows the
curve going up.

## What's in the cartridge

| Family | Drills | What you train |
|---|---|---|
| 🐞 Debugging | D1 to D7 | find the bug, prove it with a failing test, fix it |
| 🧱 Refactoring | R1 to R6 | improve code without changing what it does, and know when not to |
| 👁 Code reading | L1 to L5 | predict what code does before running it |
| 🎤 Interview formats | F1 to F9 | write the tests, review an AI pull request, extend code, tell a bug story in 2 minutes |

Each drill has a context, a mission and success criteria, then deliverables:

- **Code**: runs for real in your browser (Python 3 via [Pyodide](https://pyodide.org/), in a worker with a 10-second guard against infinite loops). Hidden tests say which cases pass.
- **Written**: checked by ideas, not exact sentences, with a completeness percentage.
- **Multiple choice**: one right answer, with the reason.

Hints are counted. The solution is one click away and never locked; opening it just means that attempt
can't count as *acquired*.

## Score, XP and levels

| The 8-point grid | 0 | 1 | 2 |
|---|---|---|---|
| Result *(auto)* | not found | with a hint, or ≥ 50 % | ≥ 90 % with no hint |
| Time *(auto)* | over twice the target | up to twice | within target |
| Thinking out loud *(you)* | silence | hypotheses stated | hypothesis, check, conclusion |
| Test *(you)* | none | after the fix | failing first |

**Acquired** = 7 or 8 out of 8, without the solution.

| XP source | XP |
|---|---|
| each score point on a saved attempt | +10 |
| first time a drill is acquired | +100 |
| each badge | +50 |

```text
LVL 1 INTERN ─ 2 JUNIOR ─ 3 MID-LEVEL ─ 4 SENIOR ─ 5 LEAD ─ 6 STAFF ─ 7 CTO
      0 XP     150        500           1100       2000     3200      5000
```

## 22 badges to unlock

| | Badge | How |
|---|---|---|
| ▶ | First step | save a first attempt |
| ★ | First acquired | acquire a drill |
| 8 | Eight of eight | 8/8 without the solution |
| ◎ | No safety net | 100 % with zero hints |
| ϟ | Lightning | acquire a drill in under half the target time |
| ↻ | Comeback | acquire a drill you first scored under 5 |
| ⟳ | Stubborn | three attempts on the same drill |
| ⌛ | All the way | reach 100 % after the timer passed twice the target |
| ✓ | Honest | save an attempt made with the solution |
| ⛓ | With proof | attach a commit, PR or screenshot link |
| ▲ / ▲▲ | Three days / Full week | a streak of 3 or 7 days |
| 10 / 50 | Ten / Fifty attempts | keep showing up |
| ☀ / ☾ | Early bird / Night owl | an attempt before 8 am or after 10 pm |
| ⚑ ▦ ◉ ◆ | Bug hunter, Architect, Code reader, Interview ready | acquire a whole family |
| ½ / ♛ | Halfway / Full track | half, then all, of a language |

Unlocks pop with a CRT card and phosphor confetti (switched off when your system asks for reduced motion).

## Built from real code

No toy exercises: every drill comes from code I shipped or reviewed.

| Drills | Repository |
|---|---|
| D1, R4, L2 | [my-gecko-buyer](https://github.com/Mialy333/my-gecko-buyer): the D1 bug is real, fixed in [PR #2](https://github.com/Mialy333/my-gecko-buyer/pull/2) |
| D3, R5 | [grounded-research-agent](https://github.com/Mialy333/grounded-research-agent), tests in [PR #2](https://github.com/Mialy333/grounded-research-agent/pull/2) |
| D4, D6, R3, L1, L3, F3 | [novamart-multi-agent-support](https://github.com/Mialy333/novamart-multi-agent-support) |
| D5, R1, R2, F4, F6, F7 | Black Monday 1987 (hackathon build, private) |
| D2 | Dev3Pack bootcamp, session 9 |
| L4 | inspired by [full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) |

## Your data stays yours

The journal, XP and badges live in your browser's local storage. Nothing is sent anywhere, there is
no account. The journal page copies, downloads and imports it, so you can move it between Safari,
Chrome and the installed app. XP and badges are recomputed from the journal, so they always match it.

## Install it

Open the site, then **Chrome: Install app** or **Safari: File › Add to Dock**. It works offline; the
Python runtime (about 13 MB) is cached the first time you run code.

## Run it locally

```bash
npm ci
npm run content   # rebuild drill JSON and check every model answer (27 drills, 70 questions, 0 problem)
npm run dev       # http://localhost:4321/drills.ai/
npm run build     # static site in dist/, plus dist/sw.js
```

| Where | What |
|---|---|
| `scripts/content/` | the drills, FR and EN, and the recruiter-level explanations |
| `scripts/build_content.py` | writes `src/drills/python/qa/*.json` and fails if a model answer does not pass its own tests |
| `src/lib/game.ts` | XP, levels, streaks and badges, computed from the journal |
| `src/lib/review.ts` | links from each drill to my library's chapters |
| `src/scripts/py-worker.ts` | the in-browser Python test harness |

Astro static site, deployed to GitHub Pages by GitHub Actions.

## Roadmap

- [x] Stage 1: welcome screen, Python track, unlimited attempts, Safari-safe journal, mobile first
- [x] Stage 2: assessment-centre briefs, graded deliverables, real Python in the browser
- [x] Stage 3: XP, levels, badges, streaks, progress dashboard, links to my library
- [ ] TypeScript track
- [ ] A help bot that coaches without giving the answer (needs a small server)
- [ ] Practice problems pulled from public coding platforms

## Who wrote what

Drills, solutions and app code were drafted with Claude from my repositories and my learning runbook.
I review them and train on them. Every bug used as a drill was reproduced by running the code before
it was written down, and the build refuses a drill whose model answer fails its own tests.

<div align="center">

```text
GAME OVER? NO: INSERT COIN, TRY AGAIN.
```

</div>
