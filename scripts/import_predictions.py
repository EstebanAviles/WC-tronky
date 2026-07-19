import argparse
import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = ROOT / "data" / "predictions.csv"
CHAMPIONS_JSON_PATH = ROOT / "docs" / "data" / "champions.json"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"
SHEET_NAME = "PRONOSTICOS"
CHAMPION_SHEET_NAME = "CAMPEON"

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
    "8VOS": "OCTAVOS",
    "3PUESTO": "TERCER PUESTO",
}
RETIRED_PARTICIPANTS = {"Biankits"}


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


def champion_sheet(path):
    workbook = pd.ExcelFile(path)
    for sheet in workbook.sheet_names:
        if normalize_text(sheet) == CHAMPION_SHEET_NAME:
            return sheet
    return ""


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
    if normalize_stage(row["Fase"]) == "GRUPOS":
        return ""

    home_score = int(row["GolLocal"])
    away_score = int(row["GolVisitante"])
    if home_score > away_score:
        return normalize_team(row["Local"])
    if away_score > home_score:
        return normalize_team(row["Visitante"])
    return normalize_team(row[qualifier_column]) if qualifier_column else ""


def has_complete_prediction(row):
    return not pd.isna(row["GolLocal"]) and not pd.isna(row["GolVisitante"])


def prediction_record(row, participant, qualifier_column, matches):
    match, reverse = canonical_match(row, matches)
    complete_prediction = has_complete_prediction(row)
    home_score = int(row["GolVisitante"] if reverse else row["GolLocal"]) if complete_prediction else pd.NA
    away_score = int(row["GolLocal"] if reverse else row["GolVisitante"]) if complete_prediction else pd.NA

    return {
        "participant": participant,
        "match_id": match["match_id"] if match else int(row["Partido"]),
        "stage": match["stage"] if match else normalize_stage(row["Fase"]),
        "group": match["group"] if match else normalize_text(row.get("Grupo", "")),
        "home_team": match["home_team"] if match else normalize_team(row["Local"]),
        "away_team": match["away_team"] if match else normalize_team(row["Visitante"]),
        "predicted_home_score": home_score,
        "predicted_away_score": away_score,
        "predicted_qualifier": predicted_qualifier(row, qualifier_column) if complete_prediction else "",
        "did_not_predict": not complete_prediction,
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


def load_workbook_champion(path):
    sheet = champion_sheet(path)
    if not sheet:
        return None

    frame = pd.read_excel(path, sheet_name=sheet, header=None)
    values = [
        value
        for value in frame.to_numpy().ravel().tolist()
        if not pd.isna(value) and normalize_text(value)
    ]
    if not values:
        return None

    return {
        "participant": participant_name(path),
        "champion": normalize_team(values[-1]),
    }


def write_public_champions(champions):
    records = sorted(champions, key=lambda row: row["participant"])
    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "champions": records,
    }
    CHAMPIONS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CHAMPIONS_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(output, file, indent=2, ensure_ascii=False)
        file.write("\n")


def missing_prediction_records(predictions, existing):
    participants = sorted(existing["participant"].dropna().unique())
    current_keys = set(zip(predictions["participant"], predictions["match_id"]))
    matches = predictions.drop_duplicates("match_id").set_index("match_id")
    records = []

    for participant in participants:
        for match_id, match in matches.iterrows():
            if (participant, match_id) in current_keys:
                continue
            records.append(
                {
                    "participant": participant,
                    "match_id": int(match_id),
                    "stage": match["stage"],
                    "group": match["group"],
                    "home_team": match["home_team"],
                    "away_team": match["away_team"],
                    "predicted_home_score": pd.NA,
                    "predicted_away_score": pd.NA,
                    "predicted_qualifier": "",
                    "did_not_predict": True,
                }
            )

    return pd.DataFrame(records)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="*", help="Excel files or directories. Defaults to data/raw.")
    parser.add_argument("--fill-missing", action="store_true", help="Add explicit no-prediction rows for missing participants.")
    args = parser.parse_args()

    excel_files = prediction_files(args.inputs)
    if not excel_files:
        raise FileNotFoundError(f"No Excel files found in {RAW_DIR}")

    matches = load_canonical_matches()
    predictions = pd.concat(
        [load_workbook_predictions(path, matches) for path in excel_files],
        ignore_index=True,
    )
    champions = [
        champion
        for champion in (load_workbook_champion(path) for path in excel_files)
        if champion and champion["participant"] not in RETIRED_PARTICIPANTS
    ]
    predictions = predictions[
        ~predictions["participant"].isin(RETIRED_PARTICIPANTS)
    ]
    if OUTPUT_PATH.exists():
        existing = pd.read_csv(OUTPUT_PATH)
        existing = existing[
            ~existing["participant"].isin(RETIRED_PARTICIPANTS)
        ]
        if "predicted_qualifier" not in existing.columns:
            existing["predicted_qualifier"] = ""
        if "did_not_predict" not in existing.columns:
            existing["did_not_predict"] = False
        if args.fill_missing:
            missing = missing_prediction_records(predictions, existing)
            predictions = pd.concat([predictions, missing], ignore_index=True)
        current_keys = set(zip(predictions["participant"], predictions["match_id"]))
        preserved = existing[
            ~existing.apply(lambda row: (row["participant"], row["match_id"]) in current_keys, axis=1)
        ]
        predictions = pd.concat([predictions, preserved], ignore_index=True)

    predictions = predictions.sort_values(["participant", "match_id"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(OUTPUT_PATH, index=False)
    if champions:
        write_public_champions(champions)
    print(f"Wrote {len(predictions)} predictions to {OUTPUT_PATH}")
    if champions:
        print(f"Wrote {len(champions)} champion predictions to {CHAMPIONS_JSON_PATH}")


if __name__ == "__main__":
    main()
