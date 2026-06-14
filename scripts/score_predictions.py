import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PREDICTIONS_PATH = ROOT / "data" / "predictions.csv"
MATCH_SCORES_PATH = ROOT / "docs" / "data" / "match_scores.json"
LEADERBOARD_PATH = ROOT / "docs" / "data" / "leaderboard.json"


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
        return 6, True, False
    if outcome(predicted_home, predicted_away) == outcome(actual_home, actual_away):
        return 3, False, True
    return 0, False, False


def load_matches():
    with MATCH_SCORES_PATH.open(encoding="utf-8") as file:
        data = json.load(file)

    matches = {}
    for match in data.get("matches", []):
        if match.get("home_score") is None or match.get("away_score") is None:
            continue
        matches[int(match["match_id"])] = match
    return matches


def main():
    predictions = pd.read_csv(PREDICTIONS_PATH)
    matches = load_matches()

    rows = []
    for participant, group in predictions.groupby("participant"):
        confirmed_points = 0
        live_projected_points = 0
        exact_scores = 0
        correct_results = 0

        for _, prediction in group.iterrows():
            match = matches.get(int(prediction["match_id"]))
            if not match:
                continue

            points, exact, correct = points_for_prediction(prediction, match)
            status = str(match.get("status", "")).lower()

            if status in {"finished", "live"}:
                live_projected_points += points

            if status == "finished":
                confirmed_points += points
                exact_scores += int(exact)
                correct_results += int(correct)

        rows.append(
            {
                "participant": participant,
                "confirmed_points": confirmed_points,
                "live_projected_points": live_projected_points,
                "exact_scores": exact_scores,
                "correct_results": correct_results,
            }
        )

    leaderboard = sorted(
        rows,
        key=lambda row: (
            row["confirmed_points"],
            row["live_projected_points"],
            row["exact_scores"],
            row["correct_results"],
        ),
        reverse=True,
    )

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
