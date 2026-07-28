import json
import re
from typing import List, Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.config import settings
from app.core.logger import get_logger
from app.models.schemas import CitationValidation, DeepResearchValidationResponse

logger = get_logger("validation_agent")

class ValidationAgent:
    def __init__(self, provider: str = None, model: str = None):
        self.provider = provider or settings.DEFAULT_LLM_PROVIDER
        self.model = model or settings.DEFAULT_LLM_MODEL

        # We can use the same ChatModel setup logic as the ResearchAgent
        if self.provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            self.llm = ChatGoogleGenerativeAI(
                model=self.model or "gemini-1.5-pro",
                temperature=0.1,
                max_output_tokens=settings.LLM_MAX_TOKENS,
                google_api_key=settings.GOOGLE_API_KEY,
            )
        else:
            from langchain_openai import ChatOpenAI
            if self.provider == "groq":
                base_url = "https://api.groq.com/openai/v1"
                api_key = settings.GROQ_API_KEY
            elif self.provider == "openai":
                base_url = None
                api_key = settings.OPENAI_API_KEY
            else:
                base_url = "http://localhost:11434/v1"
                api_key = "ollama"

            self.llm = ChatOpenAI(
                model_name=self.model,
                temperature=0.1,
                max_tokens=settings.LLM_MAX_TOKENS,
                openai_api_base=base_url,
                openai_api_key=api_key,
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

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Research Report:\n\n{research_text}")
        ]

        try:
            response = await self.llm.agenerate([messages])
            raw_text = response.generations[0][0].text.strip()

            # Clean markdown formatting if present
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

            data = json.loads(raw_text)
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
