"""
Academic Query Processor & Intent Deconstructor
================================================
Transforms conversational user prompts into precise academic search queries
and filters out out-of-domain / irrelevant search results.

Features:
1. Conversational intent deconstruction & stop-phrase stripping:
   "Tell me about JEPA" -> "JEPA"
   "Can you explain the transformer architecture?" -> "transformer architecture"
2. Technical concept & acronym expansion:
   "JEPA" -> "Joint-Embedding Predictive Architecture"
3. Multi-index query formulation:
   Generates targeted queries tuned for specific repositories (OpenAlex, CORE, Semantic Scholar, ArXiv).
4. Semantic relevance scoring & domain guard:
   Ensures retrieved papers actually contain key topic terms, filtering out
   spurious keyword hits (e.g. "Tell Me on a Sunday" for "Tell me about JEPA").
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("academic_query_processor")

# Conversational prefix patterns to strip
CONVERSATIONAL_PREFIXES = [
    # "can you please tell/explain to me about..."
    r"^(?:please\s+)?(?:can|could|would)\s+you\s+(?:please\s+)?(?:tell|explain|give|provide|show|find|search|help)\s+(?:to\s+me|me)?\s*(?:about|more\s+about|information\s+on|details\s+on)?\s*",
    # "tell me about...", "explain to me about...", "describe..."
    r"^(?:please\s+)?(?:tell|explain|describe|clarify|elaborate\s+on)\s+(?:to\s+me|me)?\s*(?:about|more\s+about|everything\s+about|how)?\s*",
    # "what is", "what are", "what was", "what does ... mean"
    r"^(?:what\s+(?:is|are|was|were)|what\s+does\s+|what\s+exactly\s+(?:is|are))\s*",
    # "give me an overview of", "papers on", "studies on"
    r"^(?:give\s+me\s+)?(?:an\s+overview\s+of|a\s+summary\s+of|information\s+on|details\s+on|papers\s+on|research\s+on|studies\s+on)\s*",
    # "find research papers on", "search for articles on"
    r"^(?:find|search(?:\s+for)?|look\s+up|investigate|explore|discuss)\s+(?:(?:research\s+)?(?:papers|articles|studies|literature)\s+(?:about|on|regarding)\s+)?",
    # "i want to know about..."
    r"^(?:i\s+want\s+to\s+know\s+about|i\s+would\s+like\s+to\s+know\s+about|i'm\s+interested\s+in|help\s+me\s+with)\s*",
    # "how does ... work", "how ... works"
    r"^(?:how\s+(?:does|do|can|to|did|is|are))\s*",
    # "help me understand..."
    r"^(?:help\s+me\s+(?:to\s+)?understand|teach\s+me\s+about)\s*",
]

# Conversational suffix patterns to strip
CONVERSATIONAL_SUFFIXES = [
    r"\s+works?$",
    r"\s+(?:in\s+simple\s+terms|for\s+beginners|in\s+detail|please|thanks?)$",
    r"\s+(?:mean\??)$",
]

# High-frequency academic & scientific concept/acronym mappings
KNOWN_ACADEMIC_EXPANSIONS: Dict[str, str] = {
    "jepa": "Joint-Embedding Predictive Architecture",
    "i-jepa": "Image Joint-Embedding Predictive Architecture",
    "ijepa": "Image Joint-Embedding Predictive Architecture",
    "v-jepa": "Video Joint-Embedding Predictive Architecture",
    "vjepa": "Video Joint-Embedding Predictive Architecture",
    "rag": "Retrieval-Augmented Generation",
    "llm": "Large Language Models",
    "llms": "Large Language Models",
    "moe": "Mixture of Experts",
    "lora": "Low-Rank Adaptation",
    "qlora": "Quantized Low-Rank Adaptation",
    "gnn": "Graph Neural Networks",
    "gnns": "Graph Neural Networks",
    "ssm": "State Space Models",
    "ssms": "State Space Models",
    "mamba": "Mamba State Space Models",
    "dpo": "Direct Preference Optimization",
    "rlhf": "Reinforcement Learning from Human Feedback",
    "nerf": "Neural Radiance Fields",
    "crispr": "CRISPR Cas9 gene editing",
    "cas9": "CRISPR-Cas9",
    "bert": "Bidirectional Encoder Representations from Transformers",
    "clip": "Contrastive Language-Image Pre-training",
    "sora": "Diffusion Video Generation",
}


@dataclass
class AcademicDeconstruction:
    raw_query: str
    topic: str
    search_query: str
    expanded_terms: List[str] = field(default_factory=list)
    relevance_keywords: List[str] = field(default_factory=list)


def clean_academic_query(query: str) -> str:
    """
    Extract the core academic topic from conversational natural language prompts.
    Examples:
        'Tell me about JEPA' -> 'JEPA'
        'Can you explain the transformer architecture?' -> 'transformer architecture'
        'What is quantum entanglement in physics?' -> 'quantum entanglement in physics'
    """
    cleaned = (query or "").strip()
    # Strip wrapping quotes
    cleaned = re.sub(r"^[\"']|[\"']$", "", cleaned).strip()

    # Iteratively strip conversational prefixes
    changed = True
    iterations = 0
    while changed and iterations < 4:
        changed = False
        iterations += 1
        for pattern in CONVERSATIONAL_PREFIXES:
            new_cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip()
            if new_cleaned != cleaned and len(new_cleaned) >= 2:
                cleaned = new_cleaned
                changed = True

    # Remove leading articles if present (e.g. "the transformer" -> "transformer")
    cleaned = re.sub(r"^(?:the|a|an)\s+", "", cleaned, flags=re.IGNORECASE).strip()

    # Strip conversational suffixes
    for suf in CONVERSATIONAL_SUFFIXES:
        new_cleaned = re.sub(suf, "", cleaned, flags=re.IGNORECASE).strip()
        if len(new_cleaned) >= 2:
            cleaned = new_cleaned

    # Strip trailing punctuation
    cleaned = re.sub(r"[?!.,;]+$", "", cleaned).strip()

    return cleaned if len(cleaned) >= 2 else query.strip()


def deconstruct_academic_query(raw_query: str) -> AcademicDeconstruction:
    """
    Deconstructs a user query into a clean topic, academic expansions, and keyword targets.
    """
    topic = clean_academic_query(raw_query)

    # Check for known acronyms / technical concepts
    topic_lower = topic.lower().strip()
    expanded_terms = []
    
    # 1. Exact match
    if topic_lower in KNOWN_ACADEMIC_EXPANSIONS:
        expanded_terms.append(KNOWN_ACADEMIC_EXPANSIONS[topic_lower])
    else:
        # 2. Token match (e.g., "Tell me about V-JEPA models")
        tokens = re.findall(r'[A-Za-z0-9\-]+', topic_lower)
        for token in tokens:
            if token in KNOWN_ACADEMIC_EXPANSIONS:
                expansion = KNOWN_ACADEMIC_EXPANSIONS[token]
                if expansion not in expanded_terms:
                    expanded_terms.append(expansion)

    # Search query formulation:
    # If we have an expansion, formulate an effective query e.g. "JEPA Joint-Embedding Predictive Architecture"
    if expanded_terms:
        # For specialized acronyms, combining topic and primary expansion yields the highest precision
        search_query = f"{topic} {expanded_terms[0]}"
    else:
        search_query = topic

    # Build relevance keywords for post-filtering
    relevance_keywords = set()
    # Add tokens from topic (excluding tiny stop words)
    stop_words = {"in", "on", "at", "for", "with", "of", "and", "or", "to", "from", "by", "about"}
    topic_tokens = [t.lower() for t in re.findall(r'[A-Za-z0-9\-]+', topic) if len(t) > 1 and t.lower() not in stop_words]
    for t in topic_tokens:
        relevance_keywords.add(t)

    # Add tokens from expanded terms
    for exp in expanded_terms:
        exp_tokens = [t.lower() for t in re.findall(r'[A-Za-z0-9\-]+', exp) if len(t) > 2 and t.lower() not in stop_words]
        for t in exp_tokens:
            relevance_keywords.add(t)

    # If the topic is an exact acronym (e.g. JEPA), ensure the full acronym is top priority
    return AcademicDeconstruction(
        raw_query=raw_query,
        topic=topic,
        search_query=search_query,
        expanded_terms=expanded_terms,
        relevance_keywords=list(relevance_keywords),
    )


def calculate_relevance_score(
    title: str,
    abstract: str,
    deconstruction: AcademicDeconstruction,
) -> float:
    """
    Computes a relevance score [0.0 - 1.0] for a paper against the deconstructed topic.
    Returns 0.0 if the paper shares no semantic overlap with the target topic keywords.
    """
    title_text = (title or "").lower()
    abstract_text = (abstract or "").lower()

    topic_lower = deconstruction.topic.lower().strip()
    keywords = deconstruction.relevance_keywords

    # 1. Direct Topic Phrase Match in Title (Highest confidence)
    if topic_lower and re.search(r'\b' + re.escape(topic_lower) + r'\b', title_text):
        return 1.0

    # 2. Check for expanded term matches in Title
    for exp in deconstruction.expanded_terms:
        if exp.lower() in title_text:
            return 0.98

    # 3. Direct Topic Phrase Match in Abstract
    if topic_lower and re.search(r'\b' + re.escape(topic_lower) + r'\b', abstract_text):
        return 0.90

    # 4. Keyword token matching
    if not keywords:
        return 0.5  # Fallback if no keywords could be extracted

    title_matches = 0
    abstract_matches = 0
    for kw in keywords:
        pattern = r'\b' + re.escape(kw) + r'\b'
        if re.search(pattern, title_text):
            title_matches += 1
        elif re.search(pattern, abstract_text):
            abstract_matches += 1

    if title_matches > 0:
        return min(0.85, 0.4 + (title_matches / len(keywords)) * 0.45)
    elif abstract_matches > 0:
        return min(0.70, 0.25 + (abstract_matches / len(keywords)) * 0.45)

    # ZERO match to any topic keywords -> completely irrelevant
    return 0.0


def filter_and_rank_papers(
    papers: List[PaperBase],
    deconstruction: AcademicDeconstruction,
    min_relevance: float = 0.20,
) -> List[PaperBase]:
    """
    Filters out spurious / unrelated papers and sorts by topical relevance.
    """
    if not papers:
        return []

    scored_papers = []
    for paper in papers:
        score = calculate_relevance_score(
            title=getattr(paper, "title", ""),
            abstract=getattr(paper, "abstract", ""),
            deconstruction=deconstruction,
        )
        if score >= min_relevance:
            scored_papers.append((score, paper))
        else:
            logger.debug(
                f"Filtered out irrelevant paper [score={score:.2f}]: '{getattr(paper, 'title', '')[:60]}'"
            )

    # If the filter was too aggressive and pruned all papers (e.g. obscure topic),
    # gracefully retain the highest scoring candidates rather than returning nothing
    if not scored_papers and papers:
        logger.warning(
            f"All {len(papers)} papers fell below min_relevance={min_relevance} for topic '{deconstruction.topic}'. Relaxing threshold."
        )
        all_scored = [
            (calculate_relevance_score(getattr(p, "title", ""), getattr(p, "abstract", ""), deconstruction), p)
            for p in papers
        ]
        # Keep any paper with score > 0
        scored_papers = [sp for sp in all_scored if sp[0] > 0.0]
        if not scored_papers:
            # Absolute fallback: return original papers
            return papers

    # Sort descending by relevance score, then citations as tiebreaker
    scored_papers.sort(
        key=lambda x: (x[0], getattr(x[1], "citations", 0) or 0),
        reverse=True,
    )

    return [p for _, p in scored_papers]
