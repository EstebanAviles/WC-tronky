import json
import os
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests


ROOT = Path(__file__).resolve().parents[1]
PREDICTIONS_PATH = ROOT / "data" / "predictions.csv"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"

API_URL = "https://v3.football.api-sports.io/fixtures"
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"}
FINISHED_STATUSES = {"FT", "AET", "PEN"}

TEAM_ALIASES = {
    "BOSNIA AND HERZEGOVINA": "BOSNIA",
    "COTE D IVOIRE": "COSTA DE MARFIL",
    "COTE D'IVOIRE": "COSTA DE MARFIL",
    "CZECHIA": "REPUBLICA CHECA",
    "CZECH REPUBLIC": "REPUBLICA CHECA",
    "CURACAO": "CURAZAO",
    "IRAN": "IRAN",
    "IVORY COAST": "COSTA DE MARFIL",
    "KOREA REPUBLIC": "COREA DEL SUR",
    "MOROCCO": "MARRUECOS",
    "NETHERLANDS": "PAISES BAJOS",
    "SOUTH AFRICA": "SUDAFRICA",
    "SOUTH KOREA": "COREA DEL SUR",
    "SWITZERLAND": "SUIZA",
    "TURKIYE": "TURQUIA",
    "TURKEY": "TURQUIA",
    "UNITED STATES": "ESTADOS UNIDOS",
    "USA": "ESTADOS UNIDOS",
}


def normalize_team(value):
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.upper().replace(".", "").replace("-", " ").strip()
    text = " ".join(text.split())
    return TEAM_ALIASES.get(text, text)


def load_schedule():
    predictions = pd.read_csv(PREDICTIONS_PATH)
    schedule = predictions[
        [
            "match_id",
            "stage",
            "group",
            "home_team",
            "away_team",
        ]
    ].drop_duplicates("match_id")

    by_pair = {}
    for row in schedule.to_dict("records"):
        key = (normalize_team(row["home_team"]), normalize_team(row["away_team"]))
        by_pair[key] = row
    return by_pair


def api_status(short_status):
    if short_status in FINISHED_STATUSES:
        return "finished"
    if short_status in LIVE_STATUSES:
        return "live"
    return "scheduled"


def fetch_fixtures():
    api_key = os.environ.get("FOOTBALL_API_KEY")
    league_id = os.environ.get("FOOTBALL_API_LEAGUE_ID")
    season = os.environ.get("FOOTBALL_API_SEASON", "2026")

    if not api_key:
        raise RuntimeError("FOOTBALL_API_KEY is required.")
    if not league_id:
        raise RuntimeError("FOOTBALL_API_LEAGUE_ID is required.")

    response = requests.get(
        API_URL,
        params={"league": league_id, "season": season},
        headers={"x-apisports-key": api_key},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors"):
        raise RuntimeError(f"API-Football returned errors: {payload['errors']}")
    return payload.get("response", [])


def convert_fixture(fixture, schedule):
    teams = fixture.get("teams", {})
    goals = fixture.get("goals", {})
    status = fixture.get("fixture", {}).get("status", {})

    home_team = normalize_team(teams.get("home", {}).get("name", ""))
    away_team = normalize_team(teams.get("away", {}).get("name", ""))
    schedule_row = schedule.get((home_team, away_team))
    if not schedule_row:
        return None

    home_score = goals.get("home")
    away_score = goals.get("away")
    if home_score is None or away_score is None:
        return None

    return {
        "match_id": int(schedule_row["match_id"]),
        "stage": schedule_row["stage"],
        "group": schedule_row["group"],
        "home_team": schedule_row["home_team"],
        "away_team": schedule_row["away_team"],
        "home_score": int(home_score),
        "away_score": int(away_score),
        "status": api_status(status.get("short")),
    }


def main():
    schedule = load_schedule()
    fixtures = fetch_fixtures()
    matches = []

    for fixture in fixtures:
        match = convert_fixture(fixture, schedule)
        if match and match["status"] in {"finished", "live"}:
            matches.append(match)

    matches = sorted(matches, key=lambda match: match["match_id"])
    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "api-football",
        "matches": matches,
    }
    with MATCH_SCORES_PATH.open("w", encoding="utf-8") as file:
        json.dump(output, file, indent=2, ensure_ascii=False)
        file.write("\n")

    print(f"Wrote {len(matches)} live/finished matches to {MATCH_SCORES_PATH}")


if __name__ == "__main__":
    main()
