import json
import os
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PREDICTIONS_PATH = ROOT / "data" / "predictions.csv"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"

API_URL = "https://v3.football.api-sports.io/fixtures"
WORLDCUP26_API_URL = "https://worldcup26.ir/get/games"
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"}
FINISHED_STATUSES = {"FT", "AET", "PEN"}

TEAM_ALIASES = {
    "ALGERIA": "ARGELIA",
    "ARGENTINA": "ARGENTINA",
    "SAUDI ARABIA": "ARABIA SAUDITA",
    "AUSTRIA": "AUSTRIA",
    "BELGIUM": "BELGICA",
    "BOSNIA AND HERZEGOVINA": "BOSNIA",
    "BRAZIL": "BRASIL",
    "CAPE VERDE": "CABO VERDE",
    "COLOMBIA": "COLOMBIA",
    "COTE D IVOIRE": "COSTA DE MARFIL",
    "COTE D'IVOIRE": "COSTA DE MARFIL",
    "CROATIA": "CROACIA",
    "CZECHIA": "REPUBLICA CHECA",
    "CZECH REPUBLIC": "REPUBLICA CHECA",
    "DR CONGO": "RD CONGO",
    "DEMOCRATIC REPUBLIC OF CONGO": "RD CONGO",
    "DEMOCRATIC REPUBLIC OF THE CONGO": "RD CONGO",
    "CONGO DR": "RD CONGO",
    "CURACAO": "CURAZAO",
    "ECUADOR": "ECUADOR",
    "EGYPT": "EGIPTO",
    "ENGLAND": "INGLATERRA",
    "FRANCE": "FRANCIA",
    "GERMANY": "ALEMANIA",
    "HAITI": "HAITI",
    "IRAN": "IRAN",
    "IRAQ": "IRAK",
    "IVORY COAST": "COSTA DE MARFIL",
    "JAPAN": "JAPON",
    "JORDAN": "JORDANIA",
    "KOREA REPUBLIC": "COREA DEL SUR",
    "MEXICO": "MEXICO",
    "MOROCCO": "MARRUECOS",
    "NETHERLANDS": "PAISES BAJOS",
    "NEW ZEALAND": "NUEVA ZELANDA",
    "NORWAY": "NORUEGA",
    "PARAGUAY": "PARAGUAY",
    "PORTUGAL": "PORTUGAL",
    "QATAR": "QATAR",
    "SCOTLAND": "ESCOCIA",
    "SENEGAL": "SENEGAL",
    "SOUTH AFRICA": "SUDAFRICA",
    "SOUTH KOREA": "COREA DEL SUR",
    "SPAIN": "ESPANA",
    "SWEDEN": "SUECIA",
    "SWITZERLAND": "SUIZA",
    "TUNISIA": "TUNEZ",
    "TURKIYE": "TURQUIA",
    "TURKEY": "TURQUIA",
    "UNITED STATES": "ESTADOS UNIDOS",
    "URUGUAY": "URUGUAY",
    "UZBEKISTAN": "UZBEKISTAN",
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


def find_schedule_match(schedule, home_team, away_team):
    schedule_row = schedule.get((home_team, away_team))
    if schedule_row:
        return schedule_row, False

    schedule_row = schedule.get((away_team, home_team))
    if schedule_row:
        return schedule_row, True

    return None, False


def fetch_fixtures():
    api_key = os.environ.get("FOOTBALL_API_KEY")
    league_id = os.environ.get("FOOTBALL_API_LEAGUE_ID")
    season = os.environ.get("FOOTBALL_API_SEASON", "2026")

    if not api_key:
        raise RuntimeError("FOOTBALL_API_KEY is required.")
    if not league_id:
        raise RuntimeError("FOOTBALL_API_LEAGUE_ID is required.")

    payload = get_json(
        f"{API_URL}?{urlencode({'league': league_id, 'season': season})}",
        headers={"x-apisports-key": api_key},
    )
    if payload.get("errors"):
        raise RuntimeError(f"API-Football returned errors: {payload['errors']}")
    return payload.get("response", [])


def fetch_worldcup26_games():
    url = os.environ.get("WORLDCUP26_API_URL", WORLDCUP26_API_URL)
    payload = get_json(url)
    if isinstance(payload, list):
        return payload
    return payload.get("games", [])


def get_json(url, headers=None):
    request = Request(url, headers=headers or {})
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} from {url}: {body}") from error


def convert_fixture(fixture, schedule):
    teams = fixture.get("teams", {})
    goals = fixture.get("goals", {})
    status = fixture.get("fixture", {}).get("status", {})

    home_team = normalize_team(teams.get("home", {}).get("name", ""))
    away_team = normalize_team(teams.get("away", {}).get("name", ""))
    schedule_row, reverse_score = find_schedule_match(schedule, home_team, away_team)
    if not schedule_row:
        return None

    fixture_status = api_status(status.get("short"))
    home_score = goals.get("home")
    away_score = goals.get("away")
    if fixture_status in {"finished", "live"} and (home_score is None or away_score is None):
        return None
    if reverse_score:
        home_score, away_score = away_score, home_score

    return {
        "match_id": int(schedule_row["match_id"]),
        "stage": schedule_row["stage"],
        "group": schedule_row["group"],
        "home_team": schedule_row["home_team"],
        "away_team": schedule_row["away_team"],
        "home_score": int(home_score) if home_score is not None else None,
        "away_score": int(away_score) if away_score is not None else None,
        "status": fixture_status,
        "source_match_id": fixture.get("fixture", {}).get("id"),
        "source_order": fixture.get("fixture", {}).get("timestamp", int(schedule_row["match_id"])),
        "played_at": fixture.get("fixture", {}).get("date"),
    }


def worldcup26_status(game):
    finished = str(game.get("finished", "")).upper()
    elapsed = str(game.get("time_elapsed", "")).lower()

    if finished == "TRUE":
        return "finished"
    if elapsed and elapsed not in {"notstarted", "not started", "0", "none", "null"}:
        return "live"
    return "scheduled"


def worldcup26_source_order(game):
    source_id = int(game["id"])
    local_date = game.get("local_date", "")
    try:
        played_at = datetime.strptime(local_date, "%m/%d/%Y %H:%M")
        return int(played_at.timestamp()) * 1000 + source_id
    except ValueError:
        return source_id


def convert_worldcup26_game(game, schedule):
    home_team = normalize_team(game.get("home_team_name_en", ""))
    away_team = normalize_team(game.get("away_team_name_en", ""))
    schedule_row, reverse_score = find_schedule_match(schedule, home_team, away_team)
    if not schedule_row:
        return None

    match_id = int(schedule_row["match_id"])
    game_status = worldcup26_status(game)
    home_score = game.get("home_score")
    away_score = game.get("away_score")
    if game_status in {"finished", "live"} and (home_score is None or away_score is None):
        return None
    if reverse_score:
        home_score, away_score = away_score, home_score

    return {
        "match_id": match_id,
        "stage": schedule_row["stage"],
        "group": schedule_row["group"],
        "home_team": schedule_row["home_team"],
        "away_team": schedule_row["away_team"],
        "home_score": int(home_score) if game_status in {"finished", "live"} else None,
        "away_score": int(away_score) if game_status in {"finished", "live"} else None,
        "status": game_status,
        "source_match_id": int(game["id"]),
        "source_order": worldcup26_source_order(game),
        "played_at": game.get("local_date", ""),
    }


def fetch_matches(schedule):
    source = os.environ.get("FOOTBALL_DATA_SOURCE", "worldcup26").lower()
    if source == "api-football":
        return [
            convert_fixture(fixture, schedule)
            for fixture in fetch_fixtures()
        ], "api-football"

    return [
        convert_worldcup26_game(game, schedule)
        for game in fetch_worldcup26_games()
    ], "worldcup26"


def main():
    schedule = load_schedule()
    fetched, source = fetch_matches(schedule)
    fetched_matches = {}

    for match in fetched:
        if match:
            fetched_matches[match["match_id"]] = match

    if not fetched_matches:
        print(f"No {source} matches matched the prediction schedule.")
        print("Keeping existing match_scores.json unchanged.")
        return

    matches = sorted(fetched_matches.values(), key=lambda match: int(match["source_order"]))
    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source,
        "matches": matches,
    }
    with MATCH_SCORES_PATH.open("w", encoding="utf-8") as file:
        json.dump(output, file, indent=2, ensure_ascii=False)
        file.write("\n")

    print(f"Fetched {len(fetched_matches)} matches from {source}.")
    print(f"Wrote {len(matches)} matches to {MATCH_SCORES_PATH}")


if __name__ == "__main__":
    main()
