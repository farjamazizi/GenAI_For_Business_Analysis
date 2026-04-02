from pathlib import Path

from business_analysis_ai.services.openai_client import get_openai_client


def _serialize_job(job) -> dict[str, str | None]:
    return {
        "job_id": job.id,
        "status": job.status,
        "model": job.model,
        "fine_tuned_model": job.fine_tuned_model,
        "error_code": job.error.code if job.error else None,
        "error_message": job.error.message if job.error else None,
    }


def create_fine_tuning_job(
    training_file_path: Path,
    model: str,
    n_epochs: int | str,
    suffix: str | None = None,
) -> dict[str, str | None]:
    client = get_openai_client()
    with training_file_path.open("rb") as handle:
        uploaded_file = client.files.create(file=handle, purpose="fine-tune")

    hyperparameters = {"n_epochs": n_epochs}
    job = client.fine_tuning.jobs.create(
        training_file=uploaded_file.id,
        model=model,
        hyperparameters=hyperparameters,
        suffix=suffix,
    )
    return _serialize_job(job)


def get_fine_tuning_job(job_id: str) -> dict[str, str | None]:
    client = get_openai_client()
    job = client.fine_tuning.jobs.retrieve(job_id)
    return _serialize_job(job)


def get_latest_fine_tuning_job() -> dict[str, str | None]:
    client = get_openai_client()
    jobs = list(client.fine_tuning.jobs.list(limit=1))
    if not jobs:
        raise ValueError("No fine-tuning jobs were found in the OpenAI account.")

    latest_job = jobs[0]
    return _serialize_job(latest_job)


def cancel_fine_tuning_job(job_id: str) -> dict[str, str | None]:
    client = get_openai_client()
    job = client.fine_tuning.jobs.cancel(job_id)
    return _serialize_job(job)
