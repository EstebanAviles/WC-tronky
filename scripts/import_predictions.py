from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = ROOT / "data" / "predictions.csv"
SHEET_NAME = "PRONÓSTICOS"

REQUIRED_COLUMNS = [
    "Partido",
    "Fase",
    "Grupo",
    "Local",
    "GolLocal",
    "GolVisitante",
    "Visitante",
]


def normalize_text(value):
    if pd.isna(value):
        return ""
    return str(value).strip().upper()


def load_workbook_predictions(path):
    participant = path.stem.strip()
    frame = pd.read_excel(path, sheet_name=SHEET_NAME)
    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(f"{path.name} is missing columns: {', '.join(missing)}")

    frame = frame[REQUIRED_COLUMNS].copy()
    frame = frame.dropna(subset=["Partido", "Local", "Visitante"])

    output = pd.DataFrame(
        {
            "participant": participant,
            "match_id": frame["Partido"].astype(int),
            "stage": frame["Fase"].map(normalize_text),
            "group": frame["Grupo"].map(normalize_text),
            "home_team": frame["Local"].map(normalize_text),
            "away_team": frame["Visitante"].map(normalize_text),
            "predicted_home_score": frame["GolLocal"].astype(int),
            "predicted_away_score": frame["GolVisitante"].astype(int),
        }
    )
    return output


def main():
    excel_files = sorted(RAW_DIR.glob("*.xlsx")) + sorted(RAW_DIR.glob("*.xls"))
    if not excel_files:
        raise FileNotFoundError(f"No Excel files found in {RAW_DIR}")

    predictions = pd.concat(
        [load_workbook_predictions(path) for path in excel_files],
        ignore_index=True,
    )
    predictions = predictions.sort_values(["participant", "match_id"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(predictions)} predictions to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
