import json
import re
from typing import List, Dict, Optional

from app.core.logger import get_logger
from app.core.model_router import model_router, TaskType

logger = get_logger("recommendation_service")


class RecommendationService:
    async def generate_topics(
        self,
        interests: List[str],
        career_field: str,
        recent_queries: Optional[List[str]] = None
    ) -> List[Dict[str, str]]:
        """
        Generate research topic recommendations based on interests, career field,
        and optionally the user's recent search history for better personalization.
        """
        interests_str = ", ".join(interests) if interests else "Emerging Technologies"

        history_context = ""
        if recent_queries:
            history_str = ", ".join(recent_queries[:5])
            history_context = f"\nThe user has recently searched for: {history_str}. Use this to inform more targeted and relevant suggestions that build on their active research interests."

        prompt = f"""As an AI research consultant, suggest 8 highly specific and trending research topics for a professional in the field of {career_field} with interests in {interests_str}.{history_context}

        For each topic, provide:
        1. A compelling title.
        2. A brief 1-sentence description of the research gap or potential.

        Return the response as a JSON list of objects with 'title' and 'description' keys.
        Do not include any other text or markdown formatting outside the JSON array.
        """

        try:
            res = await model_router.complete(
                messages=[
                    {"role": "system", "content": "You are a helpful research assistant that outputs JSON."},
                    {"role": "user", "content": prompt}
                ],
                task_type=TaskType.EXTRACTION,
                temperature=0.3,
            )
            content = res.get("content", "")

            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                content = json_match.group(0)

            topics = json.loads(content)
            if isinstance(topics, list) and len(topics) > 0:
                logger.info(f"Generated {len(topics)} recommendations for field: {career_field}")
                return topics
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")

        # Fallback topics
        return [
            {"title": f"The Evolution of {interests[0] if interests else 'Technology'} in {career_field}", "description": "Analyzing historical trends and future directions."},
            {"title": f"Ethical Implications of {interests[-1] if interests else 'AI'} for {career_field}", "description": "A deep dive into regulatory and moral frameworks."}
        ]


recommendation_service = RecommendationService()

