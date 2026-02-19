from typing import List, Dict, Any
from app.agents.research_agent import get_research_agent
from app.core.logger import logger

class RecommendationService:
    def __init__(self):
        self.agent = get_research_agent()

    async def generate_topics(self, interests: List[str], career_field: str) -> List[Dict[str, str]]:
        """
        Generate research topic recommendations based on interests and career field.
        """
        interests_str = ", ".join(interests)
        prompt = f"""As an AI research consultant, suggest 6 highly specific and trending research topics for a professional in the field of {career_field} with interests in {interests_str}.
        
        For each topic, provide:
        1. A compelling title.
        2. A brief 1-sentence description of the research gap or potential.
        
        Return the response as a JSON list of objects with 'title' and 'description' keys.
        Do not include any other text or reasoning.
        """
        
        try:
            # We reuse the agent's LLM but with a direct call for JSON output if possible, 
            # or just parse the text. For simplicity and robustness with different models, 
            # we'll use a clear prompt.
            messages = [
                {"role": "system", "content": "You are a helpful research assistant that outputs JSON."},
                {"role": "user", "content": prompt}
            ]
            
            # Using the underlying LLM from ResearchAgent for consistency
            response = await self.agent.llm.agenerate([messages])
            content = response.generations[0][0].text
            
            # Basic JSON parsing (handling potential markdown blocks)
            import json
            import re
            
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                content = json_match.group(0)
            
            topics = json.loads(content)
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
