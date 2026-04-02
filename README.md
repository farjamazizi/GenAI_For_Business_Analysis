# GenAI For Business Analysis

This repository turns the original notebooks into a production-oriented full-stack project:

- A Python backend package for dataset preparation, fine-tuning, monitoring, and inference
- A FastAPI layer that exposes those workflows as HTTP endpoints
- A React frontend that walks through the same steps as the notebooks
- A Makefile for common local tasks
- A GitHub Actions workflow for backend/frontend CI

## Quick Start

### Option 1: Use the Makefile

```bash
make install
make run-backend
```

In another terminal:

```bash
make run-frontend
```

### Option 2: Run commands manually

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd frontend && npm install
```

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Add your `OPENAI_API_KEY` and, if needed, `OPENAI_ORG_ID`.

## Workflow

### Step 1: Prepare training data

Convert the CSV dataset into OpenAI fine-tuning JSONL format:

```bash
make run-backend
```

Then use the web UI or call:

- `POST /api/datasets/convert`

### Step 2: Create a fine-tuning job

Start a fine-tuning job from the generated JSONL file:

- `POST /api/fine-tuning/jobs`
- `GET /api/fine-tuning/jobs/latest`
- `GET /api/fine-tuning/jobs/{job_id}`
- `POST /api/fine-tuning/jobs/{job_id}/cancel`

### Step 3: Monitor training

Inspect events and chart training metrics:

- `GET /api/fine-tuning/jobs/{job_id}/metrics`
- `GET /api/fine-tuning/jobs/{job_id}/events`

### Step 4: Test the model

Run complaint extraction against either a general model or a fine-tuned model:

- `POST /api/inference/extract`

## Local Development

### Start the backend

```bash
make run-backend
```

### Start the frontend

```bash
make run-frontend
```

### Run tests

```bash
make test
```

### Build the frontend

```bash
make build
```

## CI

GitHub Actions is configured in `.github/workflows/ci.yml` to:

- install backend dependencies and run `pytest`
- install frontend dependencies and run `npm run build`

## Notes

- `.codex` is ignored and should not be committed.
- Prefer `.env` for secrets. `apikey.env.txt` is only kept as a legacy fallback for the notebook-style setup.
- The project is intended to run from the local `.venv`.

## Project Structure

```text
.
├── backend/
│   ├── src/business_analysis_ai/
│   │   ├── api/main.py
│   │   ├── config.py
│   │   ├── schemas.py
│   │   └── services/
│   └── tests/
├── frontend/
│   ├── src/
│   └── package.json
├── .github/workflows/
├── artifacts/
├── Customer Complaints.csv
├── Makefile
├── pyproject.toml
├── requirements.txt
└── README.md
```
