"""Creates a synthetic Python exercise tied to one analyzed requirement."""
from openai import OpenAI

from src.ai_generator.agents.base import structured_completion
from src.ai_generator.config import OPENAI_MODEL
from src.ai_generator.pipeline_schemas import DrillContent, RoleAnalysis, RoadmapStep


class DrillCreatorAgent:
    def __init__(self, client: OpenAI | None = None, model: str = OPENAI_MODEL):
        self.client = client or OpenAI()
        self.model = model

    def create_drill(
        self,
        analysis: RoleAnalysis,
        final_roadmap_step: RoadmapStep,
        output_language: str = "same as the job posting",
    ) -> DrillContent:
        prompt = (
            "Create one original Python 3 exercise for the skill named in the final roadmap step. "
            "Return a realistic intentionally flawed implementation, a corrected implementation, "
            "and a pure-Python assertion/test harness. Tests must be designed to fail against "
            "broken_code and pass against fixed_solution. Do not claim that tests have been run. "
            "Do not reproduce proprietary code or real interview questions. The multiple-choice "
            "question must contain exactly four options and one correct answer. Provide 3-5 "
            f"answer concepts. Write user-facing prose in {output_language}.\n\n"
            f"ROLE ANALYSIS:\n{analysis.model_dump_json(indent=2)}\n\n"
            f"TARGET STEP:\n{final_roadmap_step.model_dump_json(indent=2)}"
        )
        return structured_completion(
            self.client,
            self.model,
            DrillContent,
            "You are a rigorous Python exercise author. Prefer one clear, realistic defect over contrived complexity.",
            prompt,
        )
