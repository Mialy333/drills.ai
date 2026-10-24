from pydantic import BaseModel, Field
from typing import List, Literal

class MultipleChoiceQuestion(BaseModel):
    question: str = Field(..., description="The interview question checking the core concept.")
    options: List[str] = Field(..., description="Exactly 4 options, only one must be correct.")
    correct_answer_index: int = Field(..., description="The 0-based index of the correct option.")
    reasoning: str = Field(..., description="Technical explanation of why this option is correct.")

class DrillGeneratorSchema(BaseModel):
    """Rigid schema forced upon OpenAI API to map a Job Description into a clean interactive technical drill."""
    drill_id: str = Field(..., description="Unique alphanumeric identifier (e.g., D28, R7).")
    family: Literal["Debugging", "Refactoring", "Code reading"] = Field(..., description="The category of the drill.")
    title: str = Field(..., description="Short, punchy title reflecting an enterprise production bug.")
    context: str = Field(..., description="The scenario. Must mention a real-world system failure or agent failure linked to the job requirements.")
    mission: str = Field(..., description="Clear instructions on what the developer needs to find, test, or fix.")
    
    # The Code Sandbox Fields
    broken_code: str = Field(..., description="Syntactically valid Python code containing exactly one hidden logic bug, edge-case failure, or prompt injection flaw.")
    fixed_solution: str = Field(..., description="The corrected Python code that passes all verification checks.")
    hidden_test_harness: str = Field(..., description="Pure Python assert statements or pytest structure used by Pyodide to validate the player's submission.")
    
    # Evaluative criteria
    multiple_choice: MultipleChoiceQuestion = Field(..., description="The multiple choice question to enforce theoretical knowledge.")
    model_answer_ideas: List[str] = Field(..., description="List of 3 to 5 core technical concepts/keywords that must be present in the written answer.")
