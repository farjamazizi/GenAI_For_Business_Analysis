from business_analysis_ai.schemas import DEFAULT_SYSTEM_PROMPT
from business_analysis_ai.services.fine_tuning import get_latest_fine_tuning_job
from business_analysis_ai.services.openai_client import get_openai_client

DEFAULT_INFERENCE_MODEL = "gpt-4o-mini"


def run_extraction(
    complaint_text: str,
    model_name: str | None = None,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
) -> dict[str, str]:
    selected_model = model_name
    if not selected_model:
        try:
            latest_job = get_latest_fine_tuning_job()
            selected_model = latest_job.get("fine_tuned_model")
        except ValueError:
            selected_model = None
        if not selected_model:
            selected_model = DEFAULT_INFERENCE_MODEL

    client = get_openai_client()
    response = client.chat.completions.create(
        model=selected_model,
        messages=[
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": complaint_text.strip()},
        ],
    )
    output_text = response.choices[0].message.content or ""
    return {
        "model_name": selected_model,
        "complaint_text": complaint_text,
        "output_text": output_text,
    }
