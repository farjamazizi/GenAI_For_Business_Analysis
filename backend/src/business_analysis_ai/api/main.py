from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from business_analysis_ai.config import get_settings
from business_analysis_ai.schemas import (
    DatasetConvertRequest,
    DatasetPreviewResponse,
    FineTuneCreateRequest,
    FineTuneEventListResponse,
    FineTuneJobResponse,
    FineTuneMetricsResponse,
    HealthResponse,
    InferenceRequest,
    InferenceResponse,
)
from business_analysis_ai.services.datasets import convert_csv_to_jsonl
from business_analysis_ai.services.fine_tuning import (
    cancel_fine_tuning_job,
    create_fine_tuning_job,
    get_fine_tuning_job,
    get_latest_fine_tuning_job,
)
from business_analysis_ai.services.inference import run_extraction
from business_analysis_ai.services.monitoring import (
    get_training_metrics,
    list_fine_tuning_events,
)


settings = get_settings()
app = FastAPI(title="GenAI Business Analysis API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse()


@app.post("/api/datasets/convert", response_model=DatasetPreviewResponse)
def convert_dataset(request: DatasetConvertRequest) -> DatasetPreviewResponse:
    input_csv = request.input_csv or settings.default_dataset_path
    output_jsonl = request.output_jsonl or settings.artifacts_dir / "training_data.jsonl"
    try:
        payload = convert_csv_to_jsonl(
            input_csv=input_csv,
            output_jsonl=output_jsonl,
            system_prompt=request.system_prompt,
            user_column=request.user_column,
            assistant_column=request.assistant_column,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Missing CSV column: {exc}") from exc

    return DatasetPreviewResponse(**payload)


@app.post("/api/fine-tuning/jobs", response_model=FineTuneJobResponse)
def create_job(request: FineTuneCreateRequest) -> FineTuneJobResponse:
    try:
        payload = create_fine_tuning_job(
            training_file_path=request.training_file_path,
            model=request.model,
            n_epochs=request.n_epochs,
            suffix=request.suffix,
        )
    except (RuntimeError, ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FineTuneJobResponse(**payload)


@app.get("/api/fine-tuning/jobs/latest", response_model=FineTuneJobResponse)
def latest_job() -> FineTuneJobResponse:
    try:
        payload = get_latest_fine_tuning_job()
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FineTuneJobResponse(**payload)


@app.get("/api/fine-tuning/jobs/{job_id}", response_model=FineTuneJobResponse)
def get_job(job_id: str) -> FineTuneJobResponse:
    try:
        payload = get_fine_tuning_job(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FineTuneJobResponse(**payload)


@app.post("/api/fine-tuning/jobs/{job_id}/cancel", response_model=FineTuneJobResponse)
def cancel_job(job_id: str) -> FineTuneJobResponse:
    try:
        payload = cancel_fine_tuning_job(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FineTuneJobResponse(**payload)


@app.get("/api/fine-tuning/jobs/{job_id}/metrics", response_model=FineTuneMetricsResponse)
def get_job_metrics(job_id: str) -> FineTuneMetricsResponse:
    try:
        payload = get_training_metrics(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FineTuneMetricsResponse(**payload)


@app.get("/api/fine-tuning/jobs/{job_id}/events", response_model=FineTuneEventListResponse)
def get_job_events(job_id: str) -> FineTuneEventListResponse:
    try:
        payload = list_fine_tuning_events(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FineTuneEventListResponse(**payload)


@app.post("/api/inference/extract", response_model=InferenceResponse)
def extract_details(request: InferenceRequest) -> InferenceResponse:
    try:
        payload = run_extraction(
            complaint_text=request.complaint_text,
            model_name=request.model_name,
            system_prompt=request.system_prompt,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return InferenceResponse(**payload)
