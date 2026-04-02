import { useEffect, useState } from "react";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const fallbackApiBaseUrls = Array.from(
  new Set(
    [
      configuredApiBaseUrl,
      `${window.location.protocol}//${window.location.hostname}:8000`,
      "http://127.0.0.1:8000",
      "http://localhost:8000",
    ].filter(Boolean),
  ),
);
const defaultPrompt =
  "Given a customer complaint text, extract and return the following information in JSON format: Topic, Problem, Customer_Dissatisfaction_Index.";
const METRICS_POLL_INTERVAL_MS = 10000;
const JOB_STAGES = ["validating_files", "queued", "running", "succeeded"];
const defaultFineTuningModel = "gpt-4.1-mini-2025-04-14";

async function requestJson(path, options = {}) {
  let lastError = null;

  for (const apiBaseUrl of fallbackApiBaseUrls) {
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        const detail =
          typeof payload === "string"
            ? payload
            : payload?.detail || JSON.stringify(payload);
        throw new Error(detail || "Request failed");
      }
      return payload;
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error;
      }
      lastError = { apiBaseUrl, error };
    }
  }

  const failedBaseUrl = lastError?.apiBaseUrl || "the configured backend";
  throw new Error(
    `Could not reach the backend at ${failedBaseUrl}. Make sure the FastAPI server is running.`,
  );
}

function MetricSummary({ summary, label }) {
  if (!summary) {
    return null;
  }

  return (
    <div className="metric-summary">
      <div>
        <p className="metric-summary-label">{label} min</p>
        <p className="metric-summary-value">{summary.min.toFixed(4)}</p>
      </div>
      <div>
        <p className="metric-summary-label">{label} max</p>
        <p className="metric-summary-value">{summary.max.toFixed(4)}</p>
      </div>
      <div>
        <p className="metric-summary-label">{label} latest</p>
        <p className="metric-summary-value">{summary.latest.toFixed(4)}</p>
      </div>
    </div>
  );
}

function JobLifecycle({ status }) {
  const currentIndex = JOB_STAGES.indexOf(status);
  const isTerminalFailure = status === "failed" || status === "cancelled";

  return (
    <div className="lifecycle-panel">
      <p className="lifecycle-heading">Fine-tuning lifecycle</p>
      <div className="lifecycle-list">
        {JOB_STAGES.map((stage, index) => {
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          const className = [
            "lifecycle-step",
            isCompleted ? "is-completed" : "",
            isCurrent ? "is-current" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div className={className} key={stage}>
              <div className="lifecycle-dot" />
              <p>{stage}</p>
            </div>
          );
        })}
      </div>
      <p className={`status-pill ${isTerminalFailure ? "status-error" : ""}`}>
        Current status: {status || "unknown"}
      </p>
    </div>
  );
}

function LineChart({ points, xLabel, yLabel, title, stroke, emptyMessage }) {
  if (!points.length) {
    return (
      <div className="chart-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const width = 520;
  const height = 240;
  const padding = 32;
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  function scaleX(value) {
    if (minX === maxX) {
      return width / 2;
    }
    return padding + ((value - minX) / (maxX - minX)) * (width - padding * 2);
  }

  function scaleY(value) {
    if (minY === maxY) {
      return height / 2;
    }
    return height - padding - ((value - minY) / (maxY - minY)) * (height - padding * 2);
  }

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x)} ${scaleY(point.y)}`)
    .join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padding + (height - padding * 2) * ratio,
  }));

  return (
    <div className="chart-panel">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {yTicks.map((tick) => (
          <line
            key={tick.y}
            x1={padding}
            y1={tick.y}
            x2={width - padding}
            y2={tick.y}
            className="grid-line"
          />
        ))}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          className="axis"
        />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis" />
        <path d={pathData} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        {points.map((point) => (
          <circle
            key={`${point.x}-${point.y}`}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="4"
            fill={stroke}
          />
        ))}
        <text x={width / 2} y={height - 6} textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
        <text
          x="14"
          y={height / 2}
          textAnchor="middle"
          className="axis-label"
          transform={`rotate(-90 14 ${height / 2})`}
        >
          {yLabel}
        </text>
        <text x={padding} y={padding - 10} className="chart-boundary">
          {maxY.toFixed(4)}
        </text>
        <text x={padding} y={height - padding + 18} className="chart-boundary">
          {minY.toFixed(4)}
        </text>
      </svg>
    </div>
  );
}

function ParsedInferenceOutput({ outputText }) {
  let parsedOutput = null;
  try {
    parsedOutput = JSON.parse(outputText);
  } catch {
    parsedOutput = null;
  }

  if (!parsedOutput || typeof parsedOutput !== "object" || Array.isArray(parsedOutput)) {
    return <pre>{outputText}</pre>;
  }

  return (
    <div className="structured-output">
      {Object.entries(parsedOutput).map(([key, value]) => (
        <div className="structured-output-row" key={key}>
          <p className="structured-output-key">{key}</p>
          <p className="structured-output-value">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [datasetResult, setDatasetResult] = useState(null);
  const [trainingFilePath, setTrainingFilePath] = useState("artifacts/training_data.jsonl");
  const [fineTuningModel, setFineTuningModel] = useState(defaultFineTuningModel);
  const [jobResult, setJobResult] = useState(null);
  const [jobId, setJobId] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState(null);
  const [autoRefreshMetrics, setAutoRefreshMetrics] = useState(true);
  const [autoRefreshJob, setAutoRefreshJob] = useState(true);
  const [inferenceModelName, setInferenceModelName] = useState("gpt-4o-mini");
  const [complaintText, setComplaintText] = useState(
    "I am very Angry! I want my money back!",
  );
  const [inferenceResult, setInferenceResult] = useState(null);
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const trainingLossPoints = metrics
    ? metrics.loss_points.map((point) => ({
        x: point.step,
        y: point.value,
      }))
    : [];
  const tokenAccuracyPoints = metrics
    ? metrics.accuracy_points.map((point) => ({
        x: point.step,
        y: point.value,
      }))
    : [];

  useEffect(() => {
    let ignore = false;

    async function checkBackend() {
      try {
        const payload = await requestJson("/health");
        if (!ignore) {
          setBackendStatus(payload.status === "ok" ? "Backend connected" : "Backend unknown");
        }
      } catch (requestError) {
        if (!ignore) {
          setBackendStatus(requestError.message);
        }
      }
    }

    checkBackend();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!autoRefreshJob || !jobId) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const payload = await requestJson(`/api/fine-tuning/jobs/${jobId}`);
        setJobResult(payload);
        if (payload.fine_tuned_model) {
          setInferenceModelName(payload.fine_tuned_model);
        }
      } catch {
        // Keep the last successful job status visible during transient polling failures.
      }
    }, METRICS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshJob, jobId]);

  useEffect(() => {
    if (!autoRefreshMetrics || !jobId) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const payload = await requestJson(`/api/fine-tuning/jobs/${jobId}/metrics`);
        setMetrics(payload);
      } catch {
        // Keep the last successful metrics on screen during transient polling failures.
      }
    }, METRICS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshMetrics, jobId]);

  async function handleDatasetConvert() {
    setLoading("Converting dataset...");
    setError("");
    try {
      const payload = await requestJson("/api/datasets/convert", {
        method: "POST",
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      setDatasetResult(payload);
      setTrainingFilePath(String(payload.output_jsonl));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  async function handleCreateJob() {
    setLoading("Creating fine-tuning job...");
    setError("");
    try {
      const payload = await requestJson("/api/fine-tuning/jobs", {
        method: "POST",
        body: JSON.stringify({
          training_file_path: trainingFilePath,
          model: fineTuningModel,
        }),
      });
      setJobResult(payload);
      setJobId(payload.job_id);
      if (payload.fine_tuned_model) {
        setInferenceModelName(payload.fine_tuned_model);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  async function handleLoadMetrics() {
    setLoading("Loading metrics...");
    setError("");
    try {
      const payload = await requestJson(`/api/fine-tuning/jobs/${jobId}/metrics`);
      setMetrics(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  async function handleLoadEvents() {
    setLoading("Loading events...");
    setError("");
    try {
      const payload = await requestJson(`/api/fine-tuning/jobs/${jobId}/events`);
      setEvents(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  async function handleUseLatestModel() {
    setLoading("Loading latest job...");
    setError("");
    try {
      const payload = await requestJson("/api/fine-tuning/jobs/latest");
      setJobResult(payload);
      setJobId(payload.job_id);
      setInferenceModelName(payload.fine_tuned_model || "gpt-4o-mini");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  async function handleCancelJob() {
    if (!jobId) {
      setError("Enter a fine-tuning job id before trying to stop it.");
      return;
    }

    setLoading("Stopping fine-tuning job...");
    setError("");
    try {
      const payload = await requestJson(`/api/fine-tuning/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      setJobResult(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  async function handleRunInference() {
    setLoading("Running extraction...");
    setError("");
    try {
      const payload = await requestJson("/api/inference/extract", {
        method: "POST",
        body: JSON.stringify({
          complaint_text: complaintText,
          model_name: inferenceModelName || null,
          system_prompt: systemPrompt,
        }),
      });
      setInferenceResult(payload);
      setInferenceModelName(payload.model_name);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Notebook to Product</p>
        <h1>GenAI Business Analysis Studio</h1>
        <p className="lede">
          A production-oriented shell around your dataset preparation, fine-tuning,
          and monitoring workflow.
        </p>
        <p className="backend-status">{backendStatus}</p>
      </section>

      <section className="card-grid">
        <article className="card">
          <h2>1. Prepare Training Data</h2>
          <label htmlFor="systemPrompt">System prompt</label>
          <textarea
            id="systemPrompt"
            rows="6"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
          <button onClick={handleDatasetConvert}>Convert CSV to JSONL</button>
          {datasetResult && (
            <div className="result">
              <p>{datasetResult.rows} rows written.</p>
              <p>Output: {String(datasetResult.output_jsonl)}</p>
            </div>
          )}
        </article>

        <article className="card">
          <h2>2. Create Fine-Tuning Job</h2>
          <label htmlFor="fineTuningModel">Base model</label>
          <input
            id="fineTuningModel"
            value={fineTuningModel}
            onChange={(event) => setFineTuningModel(event.target.value)}
          />
          <label htmlFor="trainingFilePath">Training file path</label>
          <input
            id="trainingFilePath"
            value={trainingFilePath}
            onChange={(event) => setTrainingFilePath(event.target.value)}
          />
          <button onClick={handleCreateJob}>Start Fine-Tuning</button>
          <button onClick={handleUseLatestModel}>Use Latest Job</button>
          <button
            onClick={handleCancelJob}
            disabled={!jobId || ["succeeded", "failed", "cancelled"].includes(jobResult?.status)}
          >
            Stop Job
          </button>
          {jobResult && (
            <div className="result">
              <JobLifecycle status={jobResult.status} />
              <p>Job: {jobResult.job_id}</p>
              <p>Status: {jobResult.status}</p>
              <p>Base model: {jobResult.model}</p>
              <p>Fine-tuned model: {jobResult.fine_tuned_model || "Not ready yet"}</p>
              {jobResult.error_message && (
                <div className="error-callout">
                  <p className="error-callout-title">Failure reason</p>
                  <p>{jobResult.error_message}</p>
                  {jobResult.error_code && <p>Error code: {jobResult.error_code}</p>}
                </div>
              )}
            </div>
          )}
        </article>

        <article className="card">
          <h2>3. Monitor Training</h2>
          <label htmlFor="jobId">Fine-tuning job id</label>
          <input id="jobId" value={jobId} onChange={(event) => setJobId(event.target.value)} />
          <label className="checkbox-row" htmlFor="autoRefreshMetrics">
            <input
              id="autoRefreshMetrics"
              type="checkbox"
              checked={autoRefreshMetrics}
              onChange={(event) => setAutoRefreshMetrics(event.target.checked)}
            />
            Auto-refresh every 10 seconds
          </label>
          <label className="checkbox-row" htmlFor="autoRefreshJob">
            <input
              id="autoRefreshJob"
              type="checkbox"
              checked={autoRefreshJob}
              onChange={(event) => setAutoRefreshJob(event.target.checked)}
            />
            Track job status every 10 seconds
          </label>
          <button onClick={handleLoadMetrics} disabled={!jobId}>
            Load Metrics
          </button>
          <button onClick={handleLoadEvents} disabled={!jobId}>
            Inspect Raw Events
          </button>
          <button
            onClick={handleCancelJob}
            disabled={!jobId || ["succeeded", "failed", "cancelled"].includes(jobResult?.status)}
          >
            Stop Job
          </button>
          {metrics && (
            <div className="result">
              {jobResult?.status && <JobLifecycle status={jobResult.status} />}
              <p>Steps tracked: {metrics.steps.length}</p>
              <p>Total events: {metrics.event_count}</p>
              <p>Metric events: {metrics.metric_event_count}</p>
              <p>{autoRefreshMetrics ? "Auto-refresh is on." : "Auto-refresh is off."}</p>
              <p>{autoRefreshJob ? "Job tracking is on." : "Job tracking is off."}</p>
              {jobResult?.error_message && (
                <div className="error-callout">
                  <p className="error-callout-title">Failure reason</p>
                  <p>{jobResult.error_message}</p>
                  {jobResult.error_code && <p>Error code: {jobResult.error_code}</p>}
                </div>
              )}
              <p>{metrics.status_hint}</p>
              <MetricSummary summary={metrics.loss_summary} label="Loss" />
              <LineChart
                points={trainingLossPoints}
                xLabel="steps"
                yLabel="training_loss"
                title="Training Loss vs Steps"
                stroke="#c2410c"
                emptyMessage="No training_loss points yet. This usually appears after the job moves beyond validation and starts training."
              />
              <MetricSummary summary={metrics.accuracy_summary} label="Accuracy" />
              <LineChart
                points={tokenAccuracyPoints}
                xLabel="steps"
                yLabel="train_mean_token_accuracy"
                title="Token Accuracy vs Steps"
                stroke="#0f766e"
                emptyMessage="No accuracy points yet. Metrics will appear here once OpenAI emits training events."
              />
              <pre>{JSON.stringify(metrics, null, 2)}</pre>
            </div>
          )}
          {events && (
            <div className="result">
              <p>Raw events returned: {events.events.length}</p>
              <pre>{JSON.stringify(events, null, 2)}</pre>
            </div>
          )}
        </article>

        <article className="card">
          <h2>4. Test Model</h2>
          <label htmlFor="inferenceModelName">Model name</label>
          <input
            id="inferenceModelName"
            value={inferenceModelName}
            onChange={(event) => setInferenceModelName(event.target.value)}
            placeholder="ft:your-model-id or gpt-4o-mini"
          />
          <label htmlFor="complaintText">Customer complaint</label>
          <textarea
            id="complaintText"
            rows="5"
            value={complaintText}
            onChange={(event) => setComplaintText(event.target.value)}
          />
          <button onClick={handleRunInference} disabled={!complaintText.trim()}>
            Run Extraction
          </button>
          {inferenceResult && (
            <div className="result">
              <p>Model used: {inferenceResult.model_name}</p>
              <ParsedInferenceOutput outputText={inferenceResult.output_text} />
            </div>
          )}
        </article>
      </section>

      {(loading || error) && (
        <section className="status-panel">
          {loading && <p>{loading}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </main>
  );
}
