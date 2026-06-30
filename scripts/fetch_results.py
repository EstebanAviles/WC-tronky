import json
import os
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PREDICTIONS_PATH = ROOT / "data" / "predictions.csv"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"

API_URL = "https://v3.football.api-sports.io/fixtures"
WORLDCUP26_API_URL = "https://worldcup26.ir/get/games"
FOOTBALL_DATA_API_URL = "https://api.football-data.org/v4/competitions/WC/matches"
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"}
FINISHED_STATUSES = {"FT", "AET", "PEN"}
FOOTBALL_DATA_LIVE_STATUSES = {"IN_PLAY", "PAUSED"}
FOOTBALL_DATA_FINISHED_STATUSES = {"FINISHED"}
ASSUMED_LIVE_WINDOW_SECONDS = 165 * 60

TBD_TEAM = "TBD"

STAGE_LABELS = {
    "group": "GRUPOS",
    "r32": "16AVOS",
    "r16": "OCTAVOS",
    "qf": "CUARTOS",
    "sf": "SEMIFINALES",
    "third": "TERCER PUESTO",
    "final": "FINAL",
}

MATCH_TIME_ZONES = {
    1: "America/Mexico_City",
    2: "America/Mexico_City",
    3: "America/Toronto",
    4: "America/Los_Angeles",
    5: "America/New_York",
    6: "America/Vancouver",
    7: "America/New_York",
    8: "America/Los_Angeles",
    9: "America/New_York",
    10: "America/Chicago",
    11: "America/Chicago",
    12: "America/Mexico_City",
    13: "America/Los_Angeles",
    14: "America/New_York",
    15: "America/Los_Angeles",
    16: "America/New_York",
    17: "America/New_York",
    18: "America/New_York",
    19: "America/Chicago",
    20: "America/Los_Angeles",
    21: "America/Chicago",
    22: "America/Chicago",
    23: "America/Mexico_City",
    24: "America/Toronto",
    25: "America/Mexico_City",
    26: "America/Los_Angeles",
    27: "America/Vancouver",
    28: "America/New_York",
    29: "America/New_York",
    30: "America/New_York",
    31: "America/Los_Angeles",
    32: "America/Los_Angeles",
    33: "America/Toronto",
    34: "America/Chicago",
    35: "America/Chicago",
    36: "America/Mexico_City",
    37: "America/Los_Angeles",
    38: "America/Vancouver",
    39: "America/New_York",
    40: "America/New_York",
    41: "America/New_York",
    42: "America/New_York",
    43: "America/Chicago",
    44: "America/Los_Angeles",
    45: "America/Chicago",
    46: "America/Toronto",
    47: "America/Mexico_City",
    48: "America/New_York",
    49: "America/New_York",
    50: "America/New_York",
    51: "America/Mexico_City",
    52: "America/Mexico_City",
    53: "America/Los_Angeles",
    54: "America/Vancouver",
    55: "America/New_York",
    56: "America/New_York",
    57: "America/Los_Angeles",
    58: "America/Los_Angeles",
    59: "America/Chicago",
    60: "America/Chicago",
    61: "America/Toronto",
    62: "America/New_York",
    63: "America/Los_Angeles",
    64: "America/Vancouver",
    65: "America/Chicago",
    66: "America/Mexico_City",
    67: "America/New_York",
    68: "America/New_York",
    69: "America/Chicago",
    70: "America/Chicago",
    71: "America/New_York",
    72: "America/New_York",
}

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
    "IR IRAN": "IRAN",
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


def normalize_api_team(value):
    return normalize_team(value) if value else TBD_TEAM


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


def fetch_football_data_matches():
    token = os.environ.get("FOOTBALL_DATA_TOKEN")
    season = os.environ.get("FOOTBALL_DATA_SEASON", "2026")
    if not token:
        return []

    payload = get_json(
        f"{FOOTBALL_DATA_API_URL}?{urlencode({'season': season})}",
        headers={"X-Auth-Token": token},
    )
    return payload.get("matches", [])


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
        "matchday": None,
    }


def worldcup26_status(game):
    finished = str(game.get("finished", "")).upper()
    elapsed = str(game.get("time_elapsed", "")).lower()

    if finished == "TRUE":
        return "finished"
    if elapsed and elapsed not in {"notstarted", "not started", "0", "none", "null"}:
        return "live"
    return "scheduled"


def is_within_assumed_live_window(game):
    local_date = game.get("local_date", "")
    source_id = int(game["id"])
    try:
        time_zone = ZoneInfo(MATCH_TIME_ZONES.get(source_id, "America/Lima"))
        kickoff = datetime.strptime(local_date, "%m/%d/%Y %H:%M").replace(tzinfo=time_zone)
    except ValueError:
        return False

    elapsed = datetime.now(timezone.utc) - kickoff.astimezone(timezone.utc)
    return 0 <= elapsed.total_seconds() <= ASSUMED_LIVE_WINDOW_SECONDS


def worldcup26_source_order(game):
    source_id = int(game["id"])
    local_date = game.get("local_date", "")
    try:
        time_zone = ZoneInfo(MATCH_TIME_ZONES.get(source_id, "America/Lima"))
        played_at = datetime.strptime(local_date, "%m/%d/%Y %H:%M").replace(tzinfo=time_zone)
        return int(played_at.timestamp()) * 1000 + source_id
    except ValueError:
        return source_id


def convert_worldcup26_game(game, schedule):
    source_match_id = int(game["id"])
    home_team = normalize_api_team(game.get("home_team_name_en", ""))
    away_team = normalize_api_team(game.get("away_team_name_en", ""))
    schedule_row, reverse_score = find_schedule_match(schedule, home_team, away_team)
    if not schedule_row:
        schedule_row = {
            "match_id": source_match_id,
            "stage": STAGE_LABELS.get(str(game.get("type", "")).lower(), str(game.get("type", "")).upper() or "PARTIDO"),
            "group": str(game.get("group", "")).upper() or "",
            "home_team": home_team,
            "away_team": away_team,
        }
        reverse_score = False

    match_id = int(schedule_row["match_id"])
    game_status = worldcup26_status(game)
    home_score = game.get("home_score")
    away_score = game.get("away_score")
    home_penalty_score = game.get("home_penalty_score")
    away_penalty_score = game.get("away_penalty_score")
    if game_status in {"finished", "live"} and (home_score is None or away_score is None):
        return None
    if reverse_score:
        home_score, away_score = away_score, home_score
        home_penalty_score, away_penalty_score = away_penalty_score, home_penalty_score

    return {
        "match_id": match_id,
        "stage": schedule_row["stage"],
        "group": schedule_row["group"],
        "home_team": schedule_row["home_team"],
        "away_team": schedule_row["away_team"],
        "home_score": int(home_score) if game_status in {"finished", "live"} else None,
        "away_score": int(away_score) if game_status in {"finished", "live"} else None,
        "status": game_status,
        "source_match_id": source_match_id,
        "source_order": worldcup26_source_order(game),
        "played_at_timezone": MATCH_TIME_ZONES.get(source_match_id, ""),
        "played_at": game.get("local_date", ""),
        "matchday": int_or_none(game.get("matchday")),
        "home_penalty_score": int_or_none(home_penalty_score),
        "away_penalty_score": int_or_none(away_penalty_score),
        "winner_team": worldcup26_winner_team(game, schedule_row, reverse_score),
    }


def int_or_none(value):
    if value in {None, "", "null"}:
        return None
    return int(value)


def worldcup26_winner_team(game, schedule_row, reverse_score):
    explicit_winner = game.get("winner_team_name_en", "")
    if explicit_winner:
        return normalize_api_team(explicit_winner)

    home_penalty_score = game.get("home_penalty_score")
    away_penalty_score = game.get("away_penalty_score")
    if int_or_none(home_penalty_score) is None or int_or_none(away_penalty_score) is None:
        return ""

    home_penalty_score = int_or_none(home_penalty_score)
    away_penalty_score = int_or_none(away_penalty_score)
    if home_penalty_score == away_penalty_score:
        return ""

    home_won = home_penalty_score > away_penalty_score
    if reverse_score:
        home_won = not home_won
    return schedule_row["home_team"] if home_won else schedule_row["away_team"]


def football_data_status(status):
    if status in FOOTBALL_DATA_FINISHED_STATUSES:
        return "finished"
    if status in FOOTBALL_DATA_LIVE_STATUSES:
        return "live"
    return "scheduled"


def football_data_score(match):
    score = match.get("score", {})
    full_time = score.get("fullTime") or {}
    regular_time = score.get("regularTime") or {}
    half_time = score.get("halfTime") or {}
    return (
        first_score(full_time.get("home"), regular_time.get("home"), half_time.get("home")),
        first_score(full_time.get("away"), regular_time.get("away"), half_time.get("away")),
    )


def first_score(*values):
    for value in values:
        if value is not None:
            return value
    return None


def convert_football_data_match(match, schedule):
    home_names = match.get("homeTeam", {})
    away_names = match.get("awayTeam", {})
    home_team = normalize_team(home_names.get("name") or home_names.get("shortName") or home_names.get("tla", ""))
    away_team = normalize_team(away_names.get("name") or away_names.get("shortName") or away_names.get("tla", ""))
    schedule_row, reverse_score = find_schedule_match(schedule, home_team, away_team)
    if not schedule_row:
        return None

    match_status = football_data_status(match.get("status", ""))
    home_score, away_score = football_data_score(match)
    if match_status in {"finished", "live"} and (home_score is None or away_score is None):
        return None
    if reverse_score:
        home_score, away_score = away_score, home_score

    utc_date = match.get("utcDate")
    source_order = int(datetime.fromisoformat(utc_date.replace("Z", "+00:00")).timestamp()) if utc_date else int(schedule_row["match_id"])
    return {
        "match_id": int(schedule_row["match_id"]),
        "stage": schedule_row["stage"],
        "group": schedule_row["group"],
        "home_team": schedule_row["home_team"],
        "away_team": schedule_row["away_team"],
        "home_score": int(home_score) if match_status in {"finished", "live"} else None,
        "away_score": int(away_score) if match_status in {"finished", "live"} else None,
        "status": match_status,
        "source_match_id": match.get("id"),
        "source_order": source_order * 1000,
        "played_at": utc_date or "",
        "backup_source": "football-data",
        "matchday": schedule_row.get("matchday"),
        "winner_team": football_data_winner(match, schedule_row, reverse_score),
    }


def football_data_winner(match, schedule_row, reverse_score):
    winner = (match.get("score") or {}).get("winner")
    if reverse_score:
        if winner == "HOME_TEAM":
            winner = "AWAY_TEAM"
        elif winner == "AWAY_TEAM":
            winner = "HOME_TEAM"
    if winner == "HOME_TEAM":
        return schedule_row["home_team"]
    if winner == "AWAY_TEAM":
        return schedule_row["away_team"]
    return ""


def apply_football_data_backup(matches, schedule):
    if not os.environ.get("FOOTBALL_DATA_TOKEN"):
        return matches

    suspicious_match_ids = {
        match["match_id"]
        for match in matches
        if match and (
            match["status"] == "scheduled" and is_within_assumed_live_window({"id": match["source_match_id"], "local_date": match["played_at"]})
            or needs_football_data_winner(match)
        )
    }
    if not suspicious_match_ids:
        return matches

    backups = {}
    try:
        football_data_matches = fetch_football_data_matches()
    except RuntimeError as error:
        print(f"football-data backup failed: {error}")
        return matches

    for match in football_data_matches:
        converted = convert_football_data_match(match, schedule)
        if converted and converted["match_id"] in suspicious_match_ids and converted["status"] in {"live", "finished"}:
            backups[converted["match_id"]] = converted

    return [
        {**match, **backups[match["match_id"]]} if match and match["match_id"] in backups else match
        for match in matches
    ]


def needs_football_data_winner(match):
    if match.get("winner_team"):
        return False
    if str(match.get("stage", "")).upper() == "GRUPOS":
        return False
    if str(match.get("status", "")).lower() != "finished":
        return False
    return match.get("home_score") is not None and match.get("home_score") == match.get("away_score")


def fetch_matches(schedule):
    source = os.environ.get("FOOTBALL_DATA_SOURCE", "worldcup26").lower()
    if source == "api-football":
        return [
            convert_fixture(fixture, schedule)
            for fixture in fetch_fixtures()
        ], "api-football"

    matches = [
        convert_worldcup26_game(game, schedule)
        for game in fetch_worldcup26_games()
    ]
    return apply_football_data_backup(matches, schedule), "worldcup26"


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
