from pathlib import Path

from business_analysis_ai.services.datasets import convert_csv_to_jsonl


def test_convert_csv_to_jsonl(tmp_path: Path) -> None:
    input_csv = tmp_path / "complaints.csv"
    input_csv.write_text(
        "Complaints,Details\n"
        "\"Internet is unstable\",\"{\\\"Topic\\\": \\\"Internet\\\"}\"\n",
        encoding="utf-8",
    )
    output_jsonl = tmp_path / "training_data.jsonl"

    payload = convert_csv_to_jsonl(
        input_csv=input_csv,
        output_jsonl=output_jsonl,
        system_prompt="System prompt",
        user_column="Complaints",
        assistant_column="Details",
    )

    assert payload["rows"] == 1
    assert output_jsonl.exists()
    assert "\"role\": \"user\"" in output_jsonl.read_text(encoding="utf-8")

