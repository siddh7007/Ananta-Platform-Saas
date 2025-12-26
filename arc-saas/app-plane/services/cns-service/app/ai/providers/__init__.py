"""
AI Provider Implementations

Available providers:
- NoOpAIProvider - Disabled AI (returns None for all suggestions)
- OllamaProvider - Local Ollama AI (free, self-hosted)
- LangflowProvider - Langflow workflow-based AI
- OpenAIProvider - OpenAI GPT models (paid API)
- ClaudeProvider - Anthropic Claude models (paid API)
"""

from app.ai.providers.noop import NoOpAIProvider
from app.ai.providers.ollama import OllamaProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.providers.claude import ClaudeProvider
from app.ai.providers.langflow import LangflowProvider

__all__ = [
    "NoOpAIProvider",
    "OllamaProvider",
    "OpenAIProvider",
    "ClaudeProvider",
    "LangflowProvider",
]
