import csv
import json
from collections.abc import Iterable
from pathlib import Path


def create_training_record(
    user_text: str,
    assistant_text: str,
    system_prompt: str,
) -> dict[str, list[dict[str, str]]]:
    return {
        "messages": [
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": user_text.strip()},
            {"role": "assistant", "content": assistant_text.strip()},
        ]
    }


def iter_csv_rows(input_csv: Path) -> Iterable[dict[str, str]]:
    with input_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        yield from reader


def convert_csv_to_jsonl(
    input_csv: Path,
    output_jsonl: Path,
    system_prompt: str,
    user_column: str,
    assistant_column: str,
) -> dict[str, object]:
    sample_messages: list[dict[str, str]] = []
    rows_written = 0
    output_jsonl.parent.mkdir(parents=True, exist_ok=True)

    with output_jsonl.open("w", encoding="utf-8") as sink:
        for row in iter_csv_rows(input_csv):
            record = create_training_record(
                user_text=row[user_column],
                assistant_text=row[assistant_column],
                system_prompt=system_prompt,
            )
            sink.write(json.dumps(record) + "\n")
            rows_written += 1
            if not sample_messages:
                sample_messages = record["messages"]

    return {
        "rows": rows_written,
        "sample_messages": sample_messages,
        "output_jsonl": output_jsonl,
    }

