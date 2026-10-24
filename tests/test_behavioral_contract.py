"""Behavioral contract tests using only trusted, fixed Python fixtures.

These tests demonstrate the required quality gate: a meaningful harness must fail
against the known broken implementation and pass against its known fixed version.
They do not execute model-generated code and are not a production sandbox.
"""
import subprocess
import sys
import tempfile


BROKEN_IMPLEMENTATION = """def validate(payload):
    return payload['name']
"""

FIXED_IMPLEMENTATION = """def validate(payload):
    if not isinstance(payload, dict) or 'name' not in payload:
        raise ValueError('missing name')
    return payload['name']
"""

DISCRIMINATING_HARNESS = """assert validate({'name': 'Ada'}) == 'Ada'
try:
    validate({})
except ValueError:
    pass
else:
    raise AssertionError('expected validation failure')
"""


def run_trusted_fixture(implementation: str, harness: str) -> subprocess.CompletedProcess[str]:
    """Run a test fixture in a disposable working directory with a hard timeout.

    The input to this helper must remain trusted test constants. A subprocess and
    timeout alone are not a security sandbox for arbitrary or model-generated code.
    """
    with tempfile.TemporaryDirectory(prefix="drills-behavior-test-") as workdir:
        return subprocess.run(
            [sys.executable, "-I", "-c", f"{implementation}\n{harness}"],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )


def test_harness_fails_on_known_broken_fixture_and_passes_on_fixed_fixture():
    broken_result = run_trusted_fixture(BROKEN_IMPLEMENTATION, DISCRIMINATING_HARNESS)
    fixed_result = run_trusted_fixture(FIXED_IMPLEMENTATION, DISCRIMINATING_HARNESS)

    assert broken_result.returncode != 0, broken_result.stdout + broken_result.stderr
    assert fixed_result.returncode == 0, fixed_result.stdout + fixed_result.stderr


def test_smoke_only_harness_is_not_behaviorally_discriminating():
    """A happy-path-only assertion passes for both versions and proves too little."""
    smoke_only_harness = "assert validate({'name': 'Ada'}) == 'Ada'"

    broken_result = run_trusted_fixture(BROKEN_IMPLEMENTATION, smoke_only_harness)
    fixed_result = run_trusted_fixture(FIXED_IMPLEMENTATION, smoke_only_harness)

    # Both pass, so this harness cannot distinguish the broken implementation.
    assert broken_result.returncode == fixed_result.returncode == 0
