"""Build src/drills/python/qa/*.json from scripts/content/*.py, and verify every check.

    python3 scripts/build_content.py

For each drill: the model code passes all its tests, a broken starter fails at least
one, and each model text answer scores 100% on its concept grid. The CTO-level
explanations are taken from the solution part of the old markdown files.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "content"))
import part_debug, part_formats, part_refactor_read  # noqa: E402

OUT = ROOT / "src" / "drills" / "python" / "qa"
OLD = ROOT / "scripts" / "content" / "explanations"


def norm(s: str) -> str:
    s = s.replace("’", "'").lower()
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def run(user_code: str, tests: str) -> list[tuple[str, bool, str]]:
    ns: dict = {}
    exec(compile(user_code, "<answer>", "exec"), ns)
    tns = dict(ns)
    tns["__user_code__"] = user_code
    exec(compile(tests, "<tests>", "exec"), tns)
    out = []
    # Only the checker's own tests count: a test_ function from the answer is not one.
    for name, fn in list(tns.items()):
        if name.startswith("test_") and callable(fn) and fn is not ns.get(name):
            try:
                fn()
                out.append((name, True, ""))
            except Exception as e:  # noqa: BLE001
                out.append((name, False, f"{type(e).__name__}: {e}"))
    return out


def explanation(lang: str, drill_id: str) -> str:
    path = OLD / lang / f"{drill_id}.md"
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8")
    return text.split("<!-- solution -->", 1)[1].strip() if "<!-- solution -->" in text else ""


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    errors = 0
    drills = part_debug.DRILLS + part_refactor_read.DRILLS + part_formats.DRILLS
    for d in drills:
        for q in d["questions"]:
            where = f"{d['id']}/{q['id']}"
            if q["type"] == "code":
                results = run(q["model"], q["tests"])
                bad = [r for r in results if not r[1]]
                if bad or not results:
                    errors += 1
                    print(f"FAIL {where}: model fails {bad}")
                missing = {r[0] for r in results} - set(q["labels"])
                if missing:
                    errors += 1
                    print(f"FAIL {where}: tests without a label {missing}")
                try:
                    starter = run(q["starter"], q["tests"])
                    if all(r[1] for r in starter):
                        errors += 1
                        print(f"FAIL {where}: starter already passes every test")
                except Exception as e:  # noqa: BLE001
                    pass  # a starter that does not even run is fine
            elif q["type"] == "text":
                for lang in ("fr", "en"):
                    answer = norm(q["model"][lang])
                    for c in q["concepts"]:
                        if not any(re.search(p, answer) for p in c["any"]):
                            errors += 1
                            print(f"FAIL {where} [{lang}]: model misses concept {c['label'][lang]!r}")
            elif q["type"] == "choice":
                assert 0 <= q["answer"] < len(q["options"]["fr"]) == len(q["options"]["en"]), where
        d["explanation"] = {lang: explanation(lang, d["id"]) for lang in ("fr", "en")}
        (OUT / f"{d['id']}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(drills)} drills, {sum(len(d['questions']) for d in drills)} questions, {errors} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
