import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PREDICTIONS_PATH = ROOT / "data" / "predictions.csv"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"
LEADERBOARD_PATH = ROOT / "docs" / "data" / "leaderboard.json"
SCORING_STATUSES = {"finished", "live"}

TEAM_FLAGS = {
    "ALEMANIA": "DE",
    "ARGELIA": "DZ",
    "ARGENTINA": "AR",
    "ARABIA SAUDITA": "SA",
    "AUSTRALIA": "AU",
    "AUSTRIA": "AT",
    "BELGICA": "BE",
    "BOSNIA": "BA",
    "BRASIL": "BR",
    "CABO VERDE": "CV",
    "CANADA": "CA",
    "COLOMBIA": "CO",
    "COREA DEL SUR": "KR",
    "COSTA DE MARFIL": "CI",
    "CROACIA": "HR",
    "CURAZAO": "CW",
    "ECUADOR": "EC",
    "EGIPTO": "EG",
    "ESCOCIA": "GB-SCT",
    "ESPAÑA": "ES",
    "ESPANA": "ES",
    "ESTADOS UNIDOS": "US",
    "FRANCIA": "FR",
    "HAITI": "HT",
    "INGLATERRA": "GB-ENG",
    "IRAK": "IQ",
    "IRAN": "IR",
    "JAPON": "JP",
    "JORDANIA": "JO",
    "MARRUECOS": "MA",
    "MEXICO": "MX",
    "NORUEGA": "NO",
    "NUEVA ZELANDA": "NZ",
    "PAISES BAJOS": "NL",
    "PANAMA": "PA",
    "PARAGUAY": "PY",
    "PORTUGAL": "PT",
    "QATAR": "QA",
    "RD CONGO": "CD",
    "REPUBLICA CHECA": "CZ",
    "SENEGAL": "SN",
    "SUDAFRICA": "ZA",
    "SUECIA": "SE",
    "SUIZA": "CH",
    "TUNEZ": "TN",
    "TURQUIA": "TR",
    "URUGUAY": "UY",
}


def outcome(home_score, away_score):
    if home_score > away_score:
        return "H"
    if home_score < away_score:
        return "A"
    return "D"


def points_for_prediction(prediction, match):
    predicted_home = int(prediction["predicted_home_score"])
    predicted_away = int(prediction["predicted_away_score"])
    actual_home = int(match["home_score"])
    actual_away = int(match["away_score"])

    if predicted_home == actual_home and predicted_away == actual_away:
        return 5, True, False
    if outcome(predicted_home, predicted_away) == outcome(actual_home, actual_away):
        return 2, False, True
    return 0, False, False


def result_type(exact, correct):
    if exact:
        return "exact"
    if correct:
        return "correct"
    return "miss"


def recent_result(prediction, match, points, exact, correct):
    return {
        "match_id": int(prediction["match_id"]),
        "source_match_id": match.get("source_match_id"),
        "source_order": int(match.get("source_order", prediction["match_id"])),
        "played_at": match.get("played_at", ""),
        "stage": match.get("stage", prediction.get("stage", "")),
        "group": match.get("group", prediction.get("group", "")),
        "status": str(match.get("status", "")).lower(),
        "home_team": match.get("home_team", prediction["home_team"]),
        "away_team": match.get("away_team", prediction["away_team"]),
        "home_flag": TEAM_FLAGS.get(match.get("home_team", prediction["home_team"]), ""),
        "away_flag": TEAM_FLAGS.get(match.get("away_team", prediction["away_team"]), ""),
        "predicted_home_score": int(prediction["predicted_home_score"]),
        "predicted_away_score": int(prediction["predicted_away_score"]),
        "actual_home_score": int(match["home_score"]),
        "actual_away_score": int(match["away_score"]),
        "points": points,
        "result": result_type(exact, correct),
    }


def load_matches():
    with MATCH_SCORES_PATH.open(encoding="utf-8") as file:
        data = json.load(file)

    matches = {}
    for match in data.get("matches", []):
        if match.get("home_score") is None or match.get("away_score") is None:
            continue
        matches[int(match["match_id"])] = match
    return matches


def source_order(match):
    return int(match.get("source_order", match["match_id"]))


def current_scoring_matches(matches):
    return {
        match_id: match
        for match_id, match in matches.items()
        if str(match.get("status", "")).lower() in SCORING_STATUSES
    }


def previous_scoring_matches(matches):
    live_matches = [
        match
        for match in matches.values()
        if str(match.get("status", "")).lower() == "live"
    ]
    if live_matches:
        return {
            match_id: match
            for match_id, match in matches.items()
            if str(match.get("status", "")).lower() == "finished"
        }

    finished_matches = [
        match
        for match in matches.values()
        if str(match.get("status", "")).lower() == "finished"
    ]
    if not finished_matches:
        return {}

    latest_finished = max(finished_matches, key=source_order)
    latest_match_id = int(latest_finished["match_id"])
    return {
        match_id: match
        for match_id, match in matches.items()
        if match_id != latest_match_id
    }


def rank_map(leaderboard):
    return {
        row["participant"]: index + 1
        for index, row in enumerate(leaderboard)
    }


def score_leaderboard(predictions, matches):
    rows = []
    for participant, group in predictions.groupby("participant"):
        points_total = 0
        exact_scores = 0
        correct_results = 0
        missed_results = 0
        recent_results = []

        for _, prediction in group.iterrows():
            match = matches.get(int(prediction["match_id"]))
            if not match:
                continue

            points, exact, correct = points_for_prediction(prediction, match)
            status = str(match.get("status", "")).lower()

            if status in SCORING_STATUSES:
                points_total += points
                exact_scores += int(exact)
                correct_results += int(correct)
                missed_results += int(not exact and not correct)
                recent_results.append(recent_result(prediction, match, points, exact, correct))

        rows.append(
            {
                "participant": participant,
                "points": points_total,
                "exact_scores": exact_scores,
                "correct_results": correct_results,
                "missed_results": missed_results,
                "recent_results": sorted(
                    recent_results,
                    key=lambda row: row["source_order"],
                    reverse=True,
                )[:5],
                "all_results": sorted(
                    recent_results,
                    key=lambda row: row["source_order"],
                    reverse=True,
                ),
            }
        )

    return sorted(
        rows,
        key=lambda row: (
            row["points"],
            row["exact_scores"],
            row["correct_results"],
        ),
        reverse=True,
    )


def main():
    predictions = pd.read_csv(PREDICTIONS_PATH)
    matches = current_scoring_matches(load_matches())
    previous_ranks = rank_map(
        score_leaderboard(predictions, previous_scoring_matches(matches))
    )
    leaderboard = score_leaderboard(predictions, matches)

    for index, row in enumerate(leaderboard):
        current_rank = index + 1
        previous_rank = previous_ranks.get(row["participant"])
        row["rank"] = current_rank
        row["movement"] = 0 if previous_rank is None else previous_rank - current_rank

    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "leaderboard": leaderboard,
    }
    LEADERBOARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LEADERBOARD_PATH.open("w", encoding="utf-8") as file:
        json.dump(output, file, indent=2, ensure_ascii=False)
        file.write("\n")

    print(f"Wrote {len(leaderboard)} leaderboard rows to {LEADERBOARD_PATH}")


if __name__ == "__main__":
    main()
