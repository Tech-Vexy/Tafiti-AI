import json
import re
from typing import List, Dict, Any
from agno.agent import Agent
from app.core.config import settings
from app.core.logger import get_logger
from app.models.schemas import CitationValidation, DeepResearchValidationResponse

logger = get_logger("validation_agent")

class ValidationAgent:
    def __init__(self, provider: str = None, model: str = None):
        self.provider = provider or "openrouter"
        self.model = model or settings.OPENROUTER_DEFAULT_MODEL

        # Build Agno 2.x model object
        self.model_obj = self._build_model()

    def _build_model(self):
        """Build the appropriate Agno 2.x model instance."""
        from agno.models.openai import OpenAIChat

        if self.provider == "openrouter":
            mid = self.model or settings.OPENROUTER_DEFAULT_MODEL
            if ":" in mid:
                mid = mid.split(":", 1)[1]
            return OpenAIChat(
                id=mid,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        elif self.provider == "gemini":
            from agno.models.google import Gemini
            return Gemini(id=self.model or settings.GEMINI_DEFAULT_MODEL)
        elif self.provider == "nvidia":
            return OpenAIChat(
                id=self.model or settings.NVIDIA_DEFAULT_MODEL,
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.nvidia_api_key,
            )
        else:
            return OpenAIChat(
                id=self.model or settings.OPENROUTER_DEFAULT_MODEL,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )

    async def validate_research_output(self, interaction_id: str, research_text: str) -> DeepResearchValidationResponse:
        """
        Subagent pipeline for validating citations and sources in deep research output.
        """
        logger.info(f"Starting validation for interaction {interaction_id}")

        system_prompt = """You are a rigorous academic fact-checker and citation validator.
Your task is to analyze a comprehensive research report and evaluate its claims and citations.

For the provided research text, identify the key claims made and their corresponding citations.
Then, evaluate whether the citation logically supports the claim, assigning a confidence score.

You MUST return your answer as a JSON object with this exact structure:
{
  "validations": [
    {
      "claim": "The specific claim made in the text.",
      "citation": "The source or citation referenced for this claim.",
      "is_valid": true,
      "confidence_score": 0.95,
      "explanation": "Brief explanation of why the citation supports or fails to support the claim."
    }
  ]
}
Return only the valid JSON object. No markdown formatting, no additional text."""

        agent = Agent(
            model=self.model_obj,
            instructions=[system_prompt]
        )

        try:
            response = await agent.arun(f"Research Report:\n\n{research_text}")
            raw_text = response.content.strip()

            # Clean markdown formatting if present
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

            # Try to parse JSON, with fallback for truncated output
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                # Attempt to fix truncated JSON by finding the last complete object
                logger.warning("JSON parse failed, attempting to extract partial results")
                # Find all complete { ... } objects in the text
                import re as _re
                objects = _re.findall(r'\{[^{}]*\}', raw_text)
                if objects:
                    # Reconstruct a valid JSON array from found objects
                    validations_data = []
                    for obj_str in objects:
                        try:
                            obj = json.loads(obj_str)
                            validations_data.append(obj)
                        except json.JSONDecodeError:
                            continue
                    data = {"validations": validations_data}
                else:
                    raise ValueError(f"Could not parse validation response")

            validations_data = data.get("validations", [])

            validations = []
            total_confidence = 0.0
            for v in validations_data:
                validation = CitationValidation(
                    claim=v.get("claim", ""),
                    citation=v.get("citation", ""),
                    is_valid=v.get("is_valid", False),
                    confidence_score=v.get("confidence_score", 0.0),
                    explanation=v.get("explanation")
                )
                validations.append(validation)
                total_confidence += validation.confidence_score

            overall_confidence = total_confidence / len(validations) if validations else 0.0

            return DeepResearchValidationResponse(
                interaction_id=interaction_id,
                overall_confidence=overall_confidence,
                validations=validations
            )

        except Exception as e:
            logger.error(f"Validation pipeline failed: {e}")
            return DeepResearchValidationResponse(
                interaction_id=interaction_id,
                overall_confidence=0.0,
                validations=[]
            )

def get_validation_agent(provider: str = None, model: str = None) -> ValidationAgent:
    return ValidationAgent(provider=provider, model=model)
