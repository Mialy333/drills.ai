"""Creates a practical learning roadmap from analyzed role requirements."""
from openai import OpenAI

from src.ai_generator.agents.base import structured_completion
from src.ai_generator.config import OPENAI_MODEL
from src.ai_generator.pipeline_schemas import LearningRoadmap, RoleAnalysis


class CoachAgent:
    def __init__(self, client: OpenAI | None = None, model: str = OPENAI_MODEL):
        self.client = client or OpenAI()
        self.model = model

    def create_roadmap(
        self,
        analysis: RoleAnalysis,
        output_language: str = "same as the job posting",
        learner_snapshot: str | None = None,
    ) -> LearningRoadmap:
        snapshot = learner_snapshot.strip() if learner_snapshot else "No learner diagnostic supplied."
        prompt = (
            "Create 3-6 ordered, practical preparation steps using only the analyzed skills. "
            "Every step needs a title, a skill matching one of the analyzed skills, a concrete "
            "objective, and an estimate of 5-240 minutes. The final step must prepare for a "
            "hands-on Python exercise. If a learner snapshot is present, use it only as a "
            "rough practice-ordering signal; do not claim measured competence or hiring fit. "
            f"Write all user-facing text in {output_language}.\n\n"
            f"ANALYSIS:\n{analysis.model_dump_json(indent=2)}\n\n"
            f"LEARNER SNAPSHOT:\n{snapshot}"
        )
        return structured_completion(
            self.client,
            self.model,
            LearningRoadmap,
            "You are a pragmatic learning designer. Avoid generic advice; every step must be actionable.",
            prompt,
        )
