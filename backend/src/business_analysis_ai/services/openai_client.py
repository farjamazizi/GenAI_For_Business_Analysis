from openai import OpenAI

from business_analysis_ai.config import get_settings


def get_openai_client() -> OpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. Add it to your environment or .env file."
        )

    kwargs: dict[str, str] = {"api_key": settings.openai_api_key}
    if settings.openai_org_id:
        kwargs["organization"] = settings.openai_org_id
    return OpenAI(**kwargs)

