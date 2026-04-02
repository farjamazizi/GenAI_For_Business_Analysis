from collections.abc import Mapping

from business_analysis_ai.services.openai_client import get_openai_client


def _normalize_event_data(data: object) -> dict[str, object]:
    if isinstance(data, Mapping):
        return dict(data)
    if hasattr(data, "model_dump"):
        return dict(data.model_dump())
    if hasattr(data, "__dict__"):
        return {
            key: value
            for key, value in vars(data).items()
            if not key.startswith("_")
        }
    return {}


def _coerce_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def list_fine_tuning_events(job_id: str, limit: int = 100) -> dict[str, object]:
    client = get_openai_client()
    events_page = client.fine_tuning.jobs.list_events(fine_tuning_job_id=job_id, limit=limit)
    events = []

    for event in events_page:
        events.append(
            {
                "id": event.id,
                "created_at": event.created_at,
                "level": event.level,
                "message": event.message,
                "type": event.type,
                "data": _normalize_event_data(event.data),
            }
        )

    return {"job_id": job_id, "events": events}


def get_training_metrics(job_id: str, limit: int = 100) -> dict[str, object]:
    client = get_openai_client()
    events_page = client.fine_tuning.jobs.list_events(fine_tuning_job_id=job_id, limit=limit)

    steps: list[int] = []
    training_loss: list[float] = []
    train_mean_token_accuracy: list[float] = []
    event_count = 0
    metric_event_count = 0

    for event in events_page:
        event_count += 1
        if event.type != "metrics" or not event.data:
            continue
        metric_event_count += 1
        data = _normalize_event_data(event.data)
        step = _coerce_int(data.get("step"))
        loss = _coerce_float(data.get("train_loss") or data.get("training_loss"))
        accuracy = _coerce_float(
            data.get("train_mean_token_accuracy")
            or data.get("training_mean_token_accuracy")
        )
        if step is None or loss is None or accuracy is None:
            continue
        steps.append(step)
        training_loss.append(loss)
        train_mean_token_accuracy.append(accuracy)

    loss_points = [
        {"step": step, "value": value}
        for step, value in zip(steps, training_loss, strict=False)
    ]
    accuracy_points = [
        {"step": step, "value": value}
        for step, value in zip(steps, train_mean_token_accuracy, strict=False)
    ]

    loss_summary = None
    if training_loss:
        loss_summary = {
            "min": min(training_loss),
            "max": max(training_loss),
            "latest": training_loss[-1],
        }

    accuracy_summary = None
    if train_mean_token_accuracy:
        accuracy_summary = {
            "min": min(train_mean_token_accuracy),
            "max": max(train_mean_token_accuracy),
            "latest": train_mean_token_accuracy[-1],
        }

    if event_count == 0:
        status_hint = "No events were returned for this job yet."
    elif metric_event_count == 0:
        status_hint = "The job has events, but none of them include training metrics yet."
    elif not steps:
        status_hint = "Metric events were found, but their fields did not match the expected parser keys."
    else:
        status_hint = "Training metrics loaded successfully."

    return {
        "job_id": job_id,
        "steps": steps,
        "training_loss": training_loss,
        "train_mean_token_accuracy": train_mean_token_accuracy,
        "loss_points": loss_points,
        "accuracy_points": accuracy_points,
        "loss_summary": loss_summary,
        "accuracy_summary": accuracy_summary,
        "event_count": event_count,
        "metric_event_count": metric_event_count,
        "status_hint": status_hint,
    }
