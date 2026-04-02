PYTHON ?= python3
VENV ?= .venv
PIP := $(VENV)/bin/pip
PYTHON_BIN := $(VENV)/bin/python
PYTEST := $(VENV)/bin/pytest
UVICORN := $(VENV)/bin/uvicorn
NPM ?= npm

.PHONY: help venv install install-backend install-frontend test test-backend build build-frontend run-backend run-frontend clean

help:
	@printf "Available targets:\n"
	@printf "  make venv              Create the local Python virtual environment\n"
	@printf "  make install           Install backend and frontend dependencies\n"
	@printf "  make install-backend   Install backend dependencies into .venv\n"
	@printf "  make install-frontend  Install frontend dependencies\n"
	@printf "  make test              Run backend tests\n"
	@printf "  make build             Build the frontend production bundle\n"
	@printf "  make run-backend       Start the FastAPI development server\n"
	@printf "  make run-frontend      Start the Vite development server\n"
	@printf "  make clean             Remove local build artifacts\n"

venv:
	$(PYTHON) -m venv $(VENV)

install: install-backend install-frontend

install-backend: venv
	$(PIP) install -e ".[dev]"

install-frontend:
	cd frontend && $(NPM) install

test: test-backend

test-backend:
	PYTHONPATH=backend/src $(PYTEST)

build: build-frontend

build-frontend:
	cd frontend && $(NPM) run build

run-backend:
	$(UVICORN) business_analysis_ai.api.main:app --reload --app-dir backend/src --host 0.0.0.0 --port 8000

run-frontend:
	cd frontend && $(NPM) run dev

clean:
	rm -rf frontend/dist .pytest_cache backend/.pytest_cache

