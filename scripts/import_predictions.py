import argparse
import json
import unicodedata
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = ROOT / "data" / "predictions.csv"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"
SHEET_NAME = "PRONOSTICOS"

REQUIRED_COLUMNS = [
    "Partido",
    "Fase",
    "Local",
    "GolLocal",
    "GolVisitante",
    "Visitante",
]
QUALIFIER_COLUMNS = ["Clasifica", "Clasificado", "Ganador"]
PARTICIPANT_ALIASES = {
    "ALEN GANADOR": "Alen",
    "ZHOKO GANADOR": "Zhoko",
}
TEAM_ALIASES = {
    "BOSNIA Y HERZEGOVINA": "BOSNIA",
    "ESPANA": "ESPANA",
}
STAGE_ALIASES = {
    "16VOS": "16AVOS",
}


def normalize_text(value):
    if pd.isna(value):
        return ""
    text = str(value).strip().upper()
    text = "".join(
        character
        for character in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(character)
    )
    return " ".join(text.split())


def normalize_team(value):
    text = normalize_text(value)
    return TEAM_ALIASES.get(text, text)


def normalize_stage(value):
    text = normalize_text(value)
    return STAGE_ALIASES.get(text, text)


def participant_name(path):
    name = path.stem.strip()
    return PARTICIPANT_ALIASES.get(normalize_text(name), name)


def prediction_files(inputs):
    paths = [Path(input_path) for input_path in inputs] if inputs else [RAW_DIR]
    excel_files = []
    for path in paths:
        if path.is_dir():
            excel_files.extend(sorted(path.glob("*.xlsx")))
            excel_files.extend(sorted(path.glob("*.xls")))
        else:
            excel_files.append(path)
    return excel_files


def prediction_sheet(path):
    workbook = pd.ExcelFile(path)
    for sheet in workbook.sheet_names:
        if normalize_text(sheet) == SHEET_NAME:
            return sheet
    if len(workbook.sheet_names) > 1:
        return workbook.sheet_names[1]
    return workbook.sheet_names[0]


def load_canonical_matches():
    if not MATCH_SCORES_PATH.exists():
        return []
    with MATCH_SCORES_PATH.open(encoding="utf-8") as file:
        data = json.load(file)
    return [
        {
            "match_id": int(match["match_id"]),
            "stage": normalize_stage(match.get("stage", "")),
            "group": normalize_text(match.get("group", "")),
            "home_team": normalize_team(match.get("home_team", "")),
            "away_team": normalize_team(match.get("away_team", "")),
        }
        for match in data.get("matches", [])
        if match.get("home_team") and match.get("away_team")
    ]


def canonical_match(row, matches):
    home_team = normalize_team(row["Local"])
    away_team = normalize_team(row["Visitante"])
    stage = normalize_stage(row["Fase"])
    candidates = []

    for match in matches:
        if match["home_team"] == home_team and match["away_team"] == away_team:
            candidates.append((match, False))
        elif match["home_team"] == away_team and match["away_team"] == home_team:
            candidates.append((match, True))

    stage_matches = [
        candidate
        for candidate in candidates
        if not stage or candidate[0]["stage"] == stage
    ]
    if stage_matches:
        return stage_matches[0]
    if candidates:
        return candidates[0]
    return None, False


def predicted_qualifier(row, qualifier_column):
    if qualifier_column:
        return normalize_team(row[qualifier_column])
    if normalize_stage(row["Fase"]) == "GRUPOS":
        return ""
    home_score = int(row["GolLocal"])
    away_score = int(row["GolVisitante"])
    if home_score > away_score:
        return normalize_team(row["Local"])
    if away_score > home_score:
        return normalize_team(row["Visitante"])
    return ""


def prediction_record(row, participant, qualifier_column, matches):
    match, reverse = canonical_match(row, matches)
    home_score = int(row["GolVisitante"] if reverse else row["GolLocal"])
    away_score = int(row["GolLocal"] if reverse else row["GolVisitante"])

    return {
        "participant": participant,
        "match_id": match["match_id"] if match else int(row["Partido"]),
        "stage": match["stage"] if match else normalize_stage(row["Fase"]),
        "group": match["group"] if match else normalize_text(row.get("Grupo", "")),
        "home_team": match["home_team"] if match else normalize_team(row["Local"]),
        "away_team": match["away_team"] if match else normalize_team(row["Visitante"]),
        "predicted_home_score": home_score,
        "predicted_away_score": away_score,
        "predicted_qualifier": predicted_qualifier(row, qualifier_column),
    }


def load_workbook_predictions(path, matches):
    participant = participant_name(path)
    frame = pd.read_excel(path, sheet_name=prediction_sheet(path))
    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(f"{path.name} is missing columns: {', '.join(missing)}")

    qualifier_column = next((column for column in QUALIFIER_COLUMNS if column in frame.columns), None)
    columns = (
        REQUIRED_COLUMNS
        + (["Grupo"] if "Grupo" in frame.columns else [])
        + ([qualifier_column] if qualifier_column else [])
    )
    frame = frame[columns].copy()
    frame = frame.dropna(subset=["Partido", "Local", "Visitante"])

    return pd.DataFrame(
        [
            prediction_record(row, participant, qualifier_column, matches)
            for _, row in frame.iterrows()
        ]
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="*", help="Excel files or directories. Defaults to data/raw.")
    args = parser.parse_args()

    excel_files = prediction_files(args.inputs)
    if not excel_files:
        raise FileNotFoundError(f"No Excel files found in {RAW_DIR}")

    matches = load_canonical_matches()
    predictions = pd.concat(
        [load_workbook_predictions(path, matches) for path in excel_files],
        ignore_index=True,
    )
    if OUTPUT_PATH.exists():
        existing = pd.read_csv(OUTPUT_PATH)
        if "predicted_qualifier" not in existing.columns:
            existing["predicted_qualifier"] = ""
        current_keys = set(zip(predictions["participant"], predictions["match_id"]))
        preserved = existing[
            ~existing.apply(lambda row: (row["participant"], row["match_id"]) in current_keys, axis=1)
        ]
        predictions = pd.concat([predictions, preserved], ignore_index=True)

    predictions = predictions.sort_values(["participant", "match_id"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(predictions)} predictions to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
