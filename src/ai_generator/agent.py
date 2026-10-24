"""Legacy single-call generator retained for compatibility with earlier experiments."""
from openai import OpenAI

from src.ai_generator.config import OPENAI_API_KEY, OPENAI_MODEL
from src.ai_generator.schemas import DrillGeneratorSchema

SYSTEM_PROMPT = """
You are an Elite AI Engineering Technical Interviewer and Software Architect.
Your role is to ingest an unstructured Job Description and synthesize a rigorous,
production-grade coding puzzle (Drill) for the player.

You must follow these instructions with absolute zero-tolerance for fluff:
1. NO AI SLOP: the 'broken_code' must look realistic, not like a generic textbook example.
2. LOGICAL COHERENCE: the hidden test harness must be designed to fail against
   'broken_code' and pass against 'fixed_solution'. Do not claim tests were run.
3. INDUSTRIAL FOCUS: focus on realistic software failures related to requirements
   in the job posting.
Output MUST strictly conform to the provided JSON Schema. Do not add markdown wrappers.
"""


class DrillGeneratorAgent:
    """Compatibility generator; use the specialist pipeline for new integrations."""

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)

    def generate_drill_from_job(self, job_description: str) -> DrillGeneratorSchema:
        """Generate a structured drill from a non-empty job description."""
        if not job_description or not job_description.strip():
            raise ValueError("Job description must not be empty.")

        try:
            completion = self.client.beta.chat.completions.parse(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            "Generate a high-yield technical drill for this job description:\n\n"
                            f"{job_description.strip()}"
                        ),
                    },
                ],
                response_format=DrillGeneratorSchema,
            )
            if not completion.choices:
                raise RuntimeError("The model returned no choices.")
            message = completion.choices[0].message
            if message.parsed is None:
                refusal = getattr(message, "refusal", None)
                raise RuntimeError(refusal or "The model did not return a parsed response.")
            return message.parsed
        except Exception as exc:
            raise RuntimeError(f"Critical error mapping layout via OpenAI API: {exc}") from exc
