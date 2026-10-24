from openai import OpenAI
from src.ai_generator.config import OPENAI_API_KEY, OPENAI_MODEL
from src.ai_generator.schemas import DrillGeneratorSchema

SYSTEM_PROMPT = """
You are an Elite AI Engineering Technical Interviewer and Software Architect. 
Your role is to ingest an unstructured Job Description and synthesize a rigorous, production-grade coding puzzle (Drill) for the player.

You must follow these instructions with absolute zero-tolerance for fluff:
1. NO AI SLOP: The 'broken_code' must look like it was written by an engineer in a hurry or an unvalidated agent system, NOT a generic textbook example. Use realistic enterprise patterns (e.g., fastAPI middleware, database pool handling, multi-agent state race conditions).
2. LOGICAL COHERENCE: The 'hidden_test_harness' must execute flawlessly in Python 3. It must FAIL when evaluated against the 'broken_code' and PASS when evaluated against the 'fixed_solution'.
3. INDUSTRIAL FOCUS: Focus heavily on modern failures—prompt injection vulnerabilities, asynchronous processing locks, vector memory leakage, and deterministic data schema bypasses.

Output MUST strictly conform to the provided JSON Schema. No introductory text, no markdown wrappers, no explanations outside the schema fields.
"""

class DrillGeneratorAgent:
    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)

    def generate_drill_from_job(self, job_description: str) -> DrillGeneratorSchema:
        """Leverages OpenAI Structured Outputs to safely turn a Job Description into a local Drill JSON file."""
        try:
            completion = self.client.beta.chat.completions.parse(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Generate a high-yield technical drill for this job description:\n\n{job_description}"},
                ],
                response_format=DrillGeneratorSchema,
            )
            return completion.choices.message.parsed
        except Exception as e:
            raise RuntimeError(f"Critical error mapping layout via OpenAI API: {str(e)}")
