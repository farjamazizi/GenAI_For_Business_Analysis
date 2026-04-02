from pathlib import Path

from pydantic import BaseModel, Field


DEFAULT_SYSTEM_PROMPT = (
    "Given a customer complaint text, extract and return the following information "
    "in JSON format: Topic, Problem, Customer_Dissatisfaction_Index."
)
DEFAULT_FINE_TUNING_MODEL = "gpt-4.1-mini-2025-04-14"


class HealthResponse(BaseModel):
    status: str = "ok"


class DatasetConvertRequest(BaseModel):
    input_csv: Path | None = None
    output_jsonl: Path | None = None
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    user_column: str = "Complaints"
    assistant_column: str = "Details"


class DatasetPreviewResponse(BaseModel):
    rows: int
    sample_messages: list[dict[str, str]]
    output_jsonl: Path


class FineTuneCreateRequest(BaseModel):
    training_file_path: Path
    model: str = DEFAULT_FINE_TUNING_MODEL
    n_epochs: int | str = Field(default="auto")
    suffix: str | None = None


class FineTuneJobResponse(BaseModel):
    job_id: str
    status: str
    model: str | None = None
    fine_tuned_model: str | None = None
    error_code: str | None = None
    error_message: str | None = None


class FineTuneMetricsResponse(BaseModel):
    job_id: str
    steps: list[int]
    training_loss: list[float]
    train_mean_token_accuracy: list[float]
    loss_points: list[dict[str, float | int]]
    accuracy_points: list[dict[str, float | int]]
    loss_summary: dict[str, float] | None = None
    accuracy_summary: dict[str, float] | None = None
    event_count: int
    metric_event_count: int
    status_hint: str


class FineTuneEventResponse(BaseModel):
    id: str
    created_at: int
    level: str
    message: str
    type: str | None = None
    data: dict[str, object] | None = None


class FineTuneEventListResponse(BaseModel):
    job_id: str
    events: list[FineTuneEventResponse]


class InferenceRequest(BaseModel):
    complaint_text: str
    model_name: str | None = None
    system_prompt: str = DEFAULT_SYSTEM_PROMPT


class InferenceResponse(BaseModel):
    model_name: str
    complaint_text: str
    output_text: str
