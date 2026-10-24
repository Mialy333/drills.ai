"""Extracts evidence-grounded skills from a job posting."""
from openai import OpenAI

from src.ai_generator.agents.base import structured_completion
from src.ai_generator.config import OPENAI_MODEL
from src.ai_generator.pipeline_schemas import RoleAnalysis


class AnalystAgent:
    def __init__(self, client: OpenAI | None = None, model: str = OPENAI_MODEL):
        self.client = client or OpenAI()
        self.model = model

    def analyze(self, job_description: str, output_language: str = "same as the job posting") -> RoleAnalysis:
        if not job_description.strip():
            raise ValueError("Job description must not be empty.")
        prompt = (
            "Analyze the supplied job posting. Extract 3-8 concrete technical skills "
            "supported by its wording, with a short evidence phrase for each. Do not "
            "invent tools, requirements, seniority, or company facts. Write all user-facing "
            f"text in this language: {output_language}. Return only the requested schema.\n\n"
            f"JOB POSTING:\n{job_description}"
        )
        return structured_completion(
            self.client,
            self.model,
            RoleAnalysis,
            "You are a careful technical recruiter and skills analyst. Evidence-grounded, concise, no speculation.",
            prompt,
        )
