from pathlib import Path
OUT = Path(__file__).resolve().parent.parent / "src" / "drills" / "python" / "en"
OUT.mkdir(parents=True, exist_ok=True)
GECKO = "https://github.com/Mialy333/my-gecko-buyer"
GRA = "https://github.com/Mialy333/grounded-research-agent"
NOVA = "https://github.com/Mialy333/novamart-multi-agent-support"
D = []
def add(id, cat, order, minutes, title, source, statement, solution):
    D.append((id, cat, order, minutes, title, source, statement.strip(), solution.strip()))

add("d1", "debug", 1, 15, "The prefix that blinds the scanner", f"[my-gecko-buyer]({GECKO}) · scripts/scan_secrets.py", r"""
The secret scanner's `ASSIGNED` rule catches `PRIVATE_KEY=...` but used to let `SOLANA_PRIVATE_KEY=...`, `OPENAI_API_KEY=...` and `AWS_SECRET_ACCESS_KEY=...` through.

```python
ASSIGNED = re.compile(
    r"(?i)\b(private_key|secret_key|seed_phrase|mnemonic)\b\s*[:=]\s*[\"']?[^\s\"']{16,}"
)
```

- Find why the `SOLANA_` prefix is enough to break it. Hint: what `\b` counts as a word boundary.
- Write 3 failing tests first, then fix it.
- Interview question: "Does your scanner have false negatives? How do you know?"

This bug was real: it was fixed on 22 October 2026 in [PR #2]({GECKO}/pull/2). Redo it from memory on a copy before reading the PR.
""".replace("{GECKO}", GECKO), r"""
**Cause.** A word character is a letter, a digit or `_`. `\b` marks the switch between a word character and a non-word character. Between `_` and `P`, both sides are word characters: no boundary, so the regex can never start on `PRIVATE_KEY`.

**Fix** (the one in the PR):

```
(?<![a-z0-9_])        the previous character is not a letter, digit or _
(?:[a-z0-9]+_)*       zero or more prefixes such as SOLANA_ or AWS_
(private_key|secret_key|secret_access_key|api_key|seed_phrase|mnemonic)
\b                    the name ends here
\s*[:=]\s*["']?[^\s"']{16,}   a value of at least 16 characters
```

`(?<!...)` is a negative lookbehind: it checks what comes before without consuming it.

**What a CTO expects to hear:**

- **The trade-off.** A false negative costs a leaked key; a false positive costs a hook the team switches off. The negative tests matter as much: `OPENAI_API_KEY=your-key-here` (under 16 characters) and `API_KEY_ID=...` (the final `\b` fails after `KEY`) are not flagged.
- **A test corpus**: one list that must be caught, one that must not.
- **Defence in depth**: GitHub push protection, gitleaks or trufflehog do better than a home-made script, which stays because it has no dependency and knows Solana key shapes.
- **The known limit**: `password` and `token` are not covered.
""")

add("d2", "debug", 2, 15, "Every secret gets the same label", "Dev3Pack, session 9 · redact function", r"""
Symptom: an `sk-...` key comes out labelled `email`.

```python
PATTERNS = {"api_key": r"sk-[A-Za-z0-9]{20,}", "email": r"[\w.+-]+@[\w-]+\.[\w.]+"}

def redact(text):
    replacers = []
    for label, pattern in PATTERNS.items():
        replacers.append((re.compile(pattern),
            lambda m: f"[redacted:{label}:{sha8(m.group(0))}]"))
    for regex, repl in replacers:
        text = regex.sub(repl, text)
    return text
```

Explain out loud, without running it, why. Then give 2 different fixes.
""", r"""
**Cause.** A lambda captures the **variable** `label`, not its value. It reads it when called, and by then the loop is over: `label` is `"email"` for all of them.

**Three fixes**:

```python
# 1. Default argument: evaluated when the lambda is created
lambda m, label=label: f"[redacted:{label}:{sha8(m.group(0))}]"

# 2. functools.partial: binds the argument explicitly
partial(_replace, label)

# 3. Apply the substitution inside the loop, never storing the lambda
for label, pattern in PATTERNS.items():
    text = re.sub(pattern, lambda m: ..., text)
```

**What a CTO expects:** the exact term, *late binding* of closures, and where else it hides: `var` in a JavaScript loop, callbacks registered in a loop. Fix 3 is often best: the bug comes from storing a function for later.
""")

add("d3", "debug", 3, 15, "Paragraph zero", f"[grounded-research-agent]({GRA}) · agent.py", r"""
The line `chosen = [numbered[n - 1] for n in numbers]` turns the model's chosen number into a paragraph. If the model returns `0`, Python does not crash: it takes **the last paragraph**, often from another document, and cites it.

- Find the line in the code that prevents this bug. It exists: where is it, and why is it the right place?
- List the 3 trap answers of a small model: `0`, a number too large, the same number twice.
- Interview question: "Why is a negative index more dangerous than an IndexError?"
""", r"""
**Verdict.** Not a bug in this code: `_selection` rejects any number outside `1..count` (line 178) and drops duplicates. No test protected it; [PR #2]({GRA}/pull/2) adds 10, and removing line 178 makes 3 of them fail.

**Why a negative index is worse than an IndexError:** a loud error shows up in the first test; a silent one produces a plausible answer with a wrong citation. In an agent that cites its sources, that is the exact failure to prevent.

**What a CTO expects:** *parse, don't validate*. Turn the model's output into a safe type at the boundary, and the rest of the code never has to distrust it. Every LLM output is untrusted input. Bonus: testing a private function like `_selection` is usually avoided, but it is justified here because it is the security boundary.
""".replace("{GRA}", GRA))

add("d4", "debug", 4, 15, "The Decimal that became text", f"[NovaMart]({NOVA}) · _to_json_safe", r"""
`_to_json_safe` runs `json.loads(json.dumps(item, default=str))`. `total_orders` becomes `'7'`, and `total_orders > 5` raises a `TypeError`.

- Find a place in NovaMart where a number from DynamoDB is compared or added after this step.
- Write a `default` that keeps integers as `int` and decimals as `float`, and say what you lose with `float`.
""", r"""
**Cause.** `default=str` turns every `Decimal` into a string. The JSON is valid, but the type changed.

```python
def dynamo_default(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"{type(o).__name__} is not JSON serializable")
```

**What `float` costs:** exactness, `0.1 + 0.2 != 0.3`. Fine for a counter; never for money. Keep `Decimal` in the code and integers in the smallest unit in the JSON, like `price_raw` in the Gecko buyer.

**What a CTO expects:** raise a `TypeError` for an unknown type instead of turning everything into `str`. Never convert silently.
""")

add("d5", "debug", 5, 10, "The shared basket", "Black Monday 1987 · turn history", r"""
```python
def record_turn(phrase, history=[]):
    history.append(phrase)
    return history

game_1 = record_turn("sell")
game_2 = record_turn("buy")
```

Symptom: the second game holds the first game's phrases. Predict `game_1`, `game_2` and `game_1 is game_2`, then fix it. It is the most asked Python question in junior interviews.
""", r"""
**Prediction:** `['sell', 'buy']`, `['sell', 'buy']`, `True`.

**Cause.** Default values are evaluated **once**, when Python runs the `def` line. Every game shares the same list.

```python
def record_turn(phrase, history=None):
    if history is None:
        history = []
    history.append(phrase)
    return history
```

**What a CTO expects:** the link with D2 (same evaluation mechanism), the tool that catches it (`ruff`, rule B006), and the remark that a function that mutates its argument and returns it has two jobs.
""")

add("d6", "debug", 6, 15, "The order delivered in the future", f"[NovaMart]({NOVA}) · _days_since", r"""
`_days_since("2026-10-25")`, called on 22 October, returns `-3`. If return eligibility is `days <= 30`, an order dated in the future is refundable.

- Decide what the function should return for a future date, and who should decide.
- Add the rule to `RULES.md` with its test.
""", r"""
**The real topic is not the code, it is who decides.** A future order date is invalid data. Two defensible answers:

- `_days_since` raises a `ValueError`, and the caller refuses the return with a clear message;
- or it returns `None`, and eligibility treats `None` as "not eligible, needs a human".

Unacceptable: letting `-3` pass `days <= 30`.

**What a CTO expects:** that you ask the business instead of choosing alone, and that you think about time zones: an order placed in Paris at 1 a.m. can look like "tomorrow" in UTC.
""")

add("d7", "debug", 7, 10, "A traceback in 2 minutes", "Runbook journal · real failures", r"""
Someone shows you only the traceback. You have 2 minutes to name the line that matters and the cause:

1. `ensurepip` crashes while creating a venv
2. `Could not import module "main"`
3. `OPTIONS /turn 405` in the API logs
4. `MissingDependencyException` with `botocore[crt]`
""", r"""
**Method:** read **bottom up**. The last line gives the type and message; climb to the first line of **your** code. If the trace says "During handling of the above exception", the real cause is the first exception.

| Traceback | Line that matters | Cause |
| --- | --- | --- |
| `ensurepip` | `Symbol not found: _XML_SetAllocTrackerActivationThreshold` | Homebrew Python built against a newer libexpat than macOS ships; ensurepip is only the victim |
| `Could not import module "main"` | The message | uvicorn started outside the `api/` folder |
| `OPTIONS /turn 405` | The `OPTIONS` verb | Unhandled CORS preflight; `CORSMiddleware` limited to the game's origin |
| `MissingDependencyException` | `botocore[crt]` | Optional dependency of `aws login` missing from the venv |

**What a CTO expects:** separate symptom from cause, and say what you check before touching code: `pwd`, `which python`, `uname -m`, package versions.
""")

add("r1", "refactor", 1, 45, "Run the two Decider calls in parallel", "Black Monday 1987 · api/main.py", r"""
Each turn calls Decider twice, one after the other: 708 ms per turn.

Run them in parallel (`asyncio.gather` or a thread pool), then measure. Proof: median latency before and after, tests green.
""", r"""
The two calls are independent. Sync client: a pool of 2 threads is enough, since the GIL is released while waiting on the network. Async client: `asyncio.gather`. Expected: the longer of the two, about 350 ms.

**The trap a CTO wants you to see:** the local Decider server runs one model. If it handles requests one at a time, client-side parallelism gains **nothing**. Hence the mandatory measurement: median over 20 turns with `time.perf_counter`. No gain: keep the simple code and write down why.
""")

add("r2", "refactor", 2, 30, "Thresholds in a table", "Black Monday 1987 · confidence thresholds", r"""
Per-action thresholds (0.75 and 0.5 for sell and buy; 0.2 for safe actions) are written as `if` statements.

Move them into a table and a single function that reads it. Proof: the 2 regression tests pass unchanged.
""", r"""
```python
THRESHOLDS = {"sell": (0.75, 0.5), "buy": (0.75, 0.5)}  # (execute, hesitate)
DEFAULT = (0.2, 0.2)  # safe actions

def band_for(action: str, confidence: float) -> str:
    execute, hesitate = THRESHOLDS.get(action, DEFAULT)
    if confidence >= execute:
        return "execute"
    return "hesitate" if confidence >= hesitate else "say_again"
```

Align the band names with your `api/main.py`. What a CTO likes: the business rule becomes data a non-developer can read, and a threshold changes without touching logic.
""")

add("r3", "refactor", 3, 45, "Extract the DynamoDB expression", f"[NovaMart]({NOVA}) · _update_workflow_state", r"""
`_update_workflow_state` mixes building the expression, calling DynamoDB and retrying, in one loop.

Extract a pure function that builds the expression, and test it without a database. What do you discover while extracting it?
""", r"""
```python
def build_update(updates: dict, expected_version: int) -> tuple[str, dict, dict]:
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    sets = [f"#{k} = :{k}" for k in updates] + ["version = :new_version"]
    values |= {":new_version": expected_version + 1, ":expected_version": expected_version}
    return "SET " + ", ".join(sets), names, values
```

**The real bug found while extracting:** the current code writes column names straight into the expression. DynamoDB has hundreds of reserved words (`status`, `name`, `data`…): a `status` column would make the write fail. `ExpressionAttributeNames` (the `#k`) fixes it. That kind of finding is what justifies a refactor in an interview.
""")

add("r4", "refactor", 4, 20, "Knowing when not to refactor", f"[my-gecko-buyer]({GECKO}) · buyer/check.py", r"""
The 5 `check_*` functions share one skeleton: compare, then refuse or agree.

Would a table of rules be better, or is the repetition deliberate? Defend your choice in 5 lines, like an architecture note.
""", r"""
**The right answer: keep the 5 functions.**

- They look alike in shape, not in meaning: `check_price` refuses a missing price, `check_mint` compares addresses, `check_store` recomputes a derived address.
- A table would hide those special cases in options, and security code must read at a glance.
- Each function has its own tests and error message.

The line to know: "duplication is far cheaper than the wrong abstraction" (Sandi Metz). Factor out at the 3rd repetition **of the same meaning**, not the same shape. Knowing when not to refactor is a seniority signal.
""")

add("r5", "refactor", 5, 45, "Extract paragraph selection", f"[grounded-research-agent]({GRA}) · agent.py", r"""
The method that turns the model's selection into an answer mixes selection, single source, citations and trace.

Extract "pick the paragraphs" as a pure function, and say where each guarantee lives.
""", r"""
```python
def pick_paragraphs(numbered: list[tuple[str, str]], numbers: list[int]) -> list[tuple[str, str]]:
    chosen = [numbered[n - 1] for n in numbers]
    source = chosen[0][0]
    return [p for p in chosen if p[0] == source]  # one source per answer
```

Validation stays in `_selection`, at the boundary: `pick_paragraphs` can assume valid numbers. A CTO wants you to say **where** each guarantee lives, instead of checking again everywhere.
""")

add("r6", "refactor", 6, 45, "Review a file the AI wrote", "Any of your repos", r"""
Pick a file the AI wrote that you never read line by line. Rename, delete dead code, add type hints.

Proof: `ruff` and `mypy` clean, diff read out loud.
""", r"""
The order that works:

1. `ruff check` and `mypy --strict` first: let the tool find what it can.
2. Delete dead code, checking each function with `git grep`.
3. Rename what lies, such as a `get_x` function that writes to the database.
4. Add missing type hints.
5. Read the diff out loud, one line at a time.

What impresses: a written list of the AI's choices you **kept**, with the reason.
""")

add("l1", "read", 1, 10, "Optimistic locking under pressure", f"[NovaMart]({NOVA}) · _update_workflow_state", r"""
Two agents write the same session at the same time.

1. Who wins, and what does the loser do?
2. After a conflict, the code rereads the version but sends the **same** `updates`. When is that correct, and when is data lost?
3. What does the user see after the 3rd failure?
""", r"""
1. **The first** `update_item` to arrive. The second fails with `ConditionalCheckFailedException`, rereads the new version, waits 0.1 s then 0.2 s, and retries.
2. **Correct** when each agent writes its own columns without computing them from the state it read, which is NovaMart's case. **Data lost** if two agents write the same column, or if the value depends on the read (a counter): the retry overwrites with a stale computation. Reflex: recompute `updates` from the reread state, inside the loop.
3. **A `RuntimeError`.** What the user sees depends on who catches it: check the code. In an interview, "I don't know, I would check here" is a good answer.

**Expected vocabulary:** compare-and-swap, lost update, and why optimistic locking fits when conflicts are rare.
""")

add("l2", "read", 2, 10, "The pin and the check", f"[my-gecko-buyer]({GECKO}) · check_price, check_store", r"""
1. Why is `price_raw is None` a refusal and not an agreement?
2. Why is the store address recomputed instead of read from Gecko's answer?
3. What happens if `budget_raw` is a `float`? Does a test cover it?
""", r"""
1. **Fail closed**: an unknown price is not a price under budget. A system that moves money says no when in doubt.
2. **The thing being checked must never supply the expected answer.** Read from Gecko's answer, a forged address would validate itself.
3. **The `int` annotation is not checked at runtime**, and no test rejects a float `budget_raw` (`test_a_float_price_is_refused` covers instruction building, not the budget). The danger is upstream: `2.01 * 10**6` is `2009999.9999999998`, so `int()` gives a budget one unit short, while `Decimal("2.01")` gives `2010000`. Expected answer: validate the type at the boundary (`__post_init__` or Pydantic) and add the test.
""")

add("l3", "read", 3, 10, "Customer isolation", f"[NovaMart]({NOVA}) · _check_customer_scope", r"""
The comment says: with no customer bound, access is allowed.

1. In what real situation is no customer bound?
2. Is it a production risk? Propose your rule.
""", r"""
1. In tests and scripts that call the tools directly, without the orchestrator.
2. **Yes, it fails open.** A future route that forgets to bind the customer would expose every customer, with no error. The rule: refuse when no customer is bound, and make tests bind one explicitly. Safe defaults must not depend on every caller's discipline.
""")

add("l4", "read", 4, 20, "Follow a request through an unknown repo", "[full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)", r"""
No AI, 20 minutes: follow the user-creation `POST` down to the database row. Name every file it crosses and draw the path.
""", r"""
No answer to copy: your diagram is the proof. Checkpoints: the router (`backend/app/api/routes/`), the dependency that injects the session and current user, the SQLModel model, the CRUD function that writes, the Alembic migration that created the table. If your diagram has neither input validation nor authentication, two steps are missing.
""")

add("l5", "read", 5, 10, "Predict the output, fast", "Python basics", r"""
Ten snippets of 3 to 6 lines, 1 minute each. Ask Claude for new ones each time, on: list copies, `is` vs `==`, variable scope, `dict.get`, comprehensions with a condition, `sorted` with `key`, a generator consumed twice, `try / except / else / finally`, `*args` and `**kwargs`, f-strings with a format spec.
""", r"""
Each answer must name the mechanism, not only the output:

- `a = b` creates a second name for the same object; `b[:]` a shallow copy;
- `is` compares identity, `==` equality;
- a generator is empty on the second pass;
- `finally` runs even after a `return`.
""")

add("f1", "formats", 1, 20, "Write the tests for a function", f"[NovaMart]({NOVA}) · _days_since", r"""
Write 6 tests for `_days_since` with `pytest.mark.parametrize`: valid date, future date, `None`, empty string, 30 February, wrong format.
""", r"""
The point that makes the difference: **make the clock injectable**, otherwise the test depends on the day it runs.

```python
NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)

@pytest.mark.parametrize("date_str, expected", [
    ("2026-10-22", 0),
    ("2026-09-22", 30),     # the return limit, exactly
    ("2026-09-21", 31),
    ("2026-10-25", -3),     # future date: documents today's behaviour
    ("2026-02-30", None),
    ("", None),
    (None, None),
    ("22/10/2026", None),
])
def test_days_since(date_str, expected):
    assert _days_since(date_str, now=NOW) == expected
```

What a CTO looks at: the boundaries (29, 30, 31) and a test that documents doubtful behaviour instead of hiding it.
""")

add("f2", "formats", 2, 25, "Review a pull request the AI wrote", "A 60-line PR on one of your repos", r"""
Ask Claude for a 60-line PR on one of your repos, hiding 3 flaws: a bug, a security hole, a debatable choice. Hand back a review as comments, polite and precise.
""", r"""
A good review, in order:

1. **Blocking**: what breaks or opens a hole, with the line and a concrete scenario.
2. **To discuss**: a defensible but debatable choice, asked as a question.
3. **Details**: naming and style, grouped in one comment.

Each comment says what, why, and suggests a direction. Critique the code, never the person.
""")

add("f3", "formats", 3, 45, "Extend existing code", f"[NovaMart]({NOVA}) and [my-gecko-buyer]({GECKO})", r"""
Your pick: add a "Gold" customer tier (90-day returns) to NovaMart without breaking the tests, or a 6th check on maximum quantity in the Gecko buyer.
""", r"""
The expected approach:

1. Read before writing: find where the current rule (30 and 60 days) is decided and tested.
2. Write the new rule's test, which fails.
3. Follow the repo's style: same message shape, same way of refusing.
4. Make every test pass, old ones included.

What a CTO looks at: that you did not duplicate the rule in a second place.
""")

add("f4", "formats", 4, 30, "LLM failures: bounded retries", "Black Monday 1987 · the broker's voice", r"""
Write from memory `call_with_retry(fn, tries=3)` with exponential backoff, plus its tests with a fake client.
""", r"""
```python
class TransientError(Exception): ...

def call_with_retry(fn, *, tries=3, base_delay=0.5, sleep=time.sleep):
    if tries < 1:
        raise ValueError("tries must be >= 1")
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except TransientError:
            if attempt == tries:
                raise
            sleep(base_delay * 2 ** (attempt - 1) * (1 + random.random() * 0.1))
```

Five points to say out loud:

1. Retry only **transient** errors (throttling, timeouts, 503).
2. The wait doubles, with a little randomness (*jitter*).
3. `sleep` is injected: the test runs in 0 seconds.
4. Retry a write only if it is **idempotent**.
5. The last failure propagates, and the fallback logs the reason.
""")

add("f5", "formats", 5, 25, "Structured output with Pydantic", f"[grounded-research-agent]({GRA}) · _selection", r"""
Validate a model reply with Pydantic and test 5 trap replies: empty list, `0`, confidence 1.7, a string instead of a list, a missing field.
""", r"""
```python
class Selection(BaseModel):
    paragraphs: list[int] = Field(min_length=1, max_length=3)
    confidence: float = Field(ge=0, le=1)

    @field_validator("paragraphs")
    @classmethod
    def positive(cls, v):
        if any(n < 1 for n in v):
            raise ValueError("paragraph numbers start at 1")
        return v
```

Say: you never silently repair a wrong output, you refuse it and trace it. Your `_selection` does it by hand; knowing when a library is better is the real question.
""")

add("f6", "formats", 6, 30, "A small evaluation set", "Black Monday 1987 · the 20-phrase test", r"""
Redo from memory the 20-phrase Decider test: accuracy, repeatability, median latency.
""", r"""
Three measures, always together: accuracy (right answers over total), repeatability (same input twice, same output?) and **median** latency, because a cold start skews the mean. And the rule you already applied: a threshold tuned on one set is validated on another, unseen one.
""")

add("f7", "formats", 7, 20, "Data without pandas", "Black Monday 1987 · results_v2.csv", r"""
Read `results_v2.csv`, group by expected action and print accuracy per action, with the number of examples.
""", r"""
```python
from collections import Counter
import csv

total, good = Counter(), Counter()
with open("results_v2.csv", newline="") as f:
    for row in csv.DictReader(f):
        total[row["expected"]] += 1
        good[row["expected"]] += row["action"] == row["expected"]
for action in sorted(total):
    print(f"{action:12} {good[action] / total[action]:.0%}  ({total[action]})")
```

Adapt the column names. Say: group by the **expected** action to see which intents the model misses, and show the count, because 100% on 2 phrases means nothing.
""")

add("f8", "formats", 8, 20, "Algorithm basics", "Junior online test", r"""
One set per week, stating the complexity before coding: frequency map, two pointers, sliding window, stack, binary search.
""", r"""
| Pattern | Typical exercise | Complexity |
| --- | --- | --- |
| Frequency map | Two numbers that sum to X | O(n) instead of O(n²) |
| Two pointers | Pair in a sorted array; palindrome | O(n) |
| Sliding window | Longest substring without repeats | O(n) |
| Stack | Balanced parentheses | O(n) |
| Binary search | First element ≥ X in a sorted array | O(log n) |
""")

add("f9", "formats", 9, 2, "Tell an AI bug story in 2 minutes", "Dev3Pack · final chapter", r"""
Tell, out loud and in 2 minutes, a bug the AI introduced in one of your projects: how you spotted it, what you check since.
""", r"""
Structure: **context**, **symptom** (the number), **how you spotted it**, **cause**, **what you check since**.

> On my research agent, a score dropped to 4/10 after a change meant to improve it. The grader read `agent.py`, while the new version had been copied as `agent-2.py`: I was measuring the old code. Since then, before reading a score, I check which file runs, with a `grep` on a sentence unique to the new version.

What a CTO hears: you do not trust a number before you know what it measures.
""")

for id, cat, order, minutes, title, source, st, sol in D:
    body = f"---\nid: {id}\ncat: {cat}\norder: {order}\nminutes: {minutes}\ntitle: {title}\nsource: {source}\n---\n{st}\n\n<!-- solution -->\n\n{sol}\n"
    (OUT / f"{id}.md").write_text(body, encoding="utf-8")
print(len(D), "EN files")
