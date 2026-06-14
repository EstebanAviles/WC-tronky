async function loadLeaderboard() {
  const lastUpdated = document.getElementById("last-updated");
  const playerCount = document.getElementById("player-count");
  const leaderName = document.getElementById("leader-name");
  const tbody = document.getElementById("leaderboard-body");
  const statusPill = document.getElementById("status-pill");
  const tableMessage = document.getElementById("table-message");
  try {
    const response = await fetch("./data/leaderboard.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load leaderboard data.");
    }

    const data = await response.json();
    const leaderboard = data.leaderboard || [];

    playerCount.textContent = leaderboard.length;
    leaderName.textContent = leaderboard[0]?.participant || "-";
    lastUpdated.textContent = formatTimestamp(data.last_updated);
    statusPill.textContent = "Updated";
    statusPill.className = "status-pill status-pill--ok";
    tableMessage.textContent = leaderboard.length ? "" : "No predictions have been scored yet.";

    tbody.innerHTML = "";

    leaderboard.forEach((row, index) => {
      const rank = index + 1;
      const tr = document.createElement("tr");
      tr.className = rank <= 3 ? `rank-${rank}` : "";

      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass(rank)}">${rankLabel(rank)}</span></td>
        <td>
          <button class="player-button" type="button">${row.participant}</button>
        </td>
        <td><strong>${row.points}</strong></td>
        <td>${row.exact_scores}</td>
        <td>${row.correct_results}</td>
        <td>${row.missed_results}</td>
      `;

      tr.querySelector(".player-button").addEventListener("click", () => {
        openPlayerDialog(row);
      });

      tbody.appendChild(tr);
    });

  } catch (error) {
    statusPill.textContent = "Data error";
    statusPill.className = "status-pill status-pill--error";
    tableMessage.textContent = error.message;
  }
}

function openPlayerDialog(player) {
  const dialog = document.getElementById("player-dialog");
  const playerName = document.getElementById("dialog-player-name");
  const playerPoints = document.getElementById("dialog-player-points");
  const recentList = document.getElementById("recent-list");

  playerName.textContent = player.participant;
  playerPoints.textContent = player.points;
  recentList.innerHTML = "";

  const results = player.recent_results || [];
  if (!results.length) {
    recentList.innerHTML = `<p class="table-message">No scored matches yet.</p>`;
  }

  results.forEach((match) => {
    const item = document.createElement("article");
    item.className = `recent-card recent-card--${match.result}`;
    item.innerHTML = `
      <div class="recent-card__teams">
        <span>${flagEmoji(match.home_flag)} ${match.home_team}</span>
        <strong>${match.actual_home_score} - ${match.actual_away_score}</strong>
        <span>${flagEmoji(match.away_flag)} ${match.away_team}</span>
      </div>
      <div class="recent-card__meta">
        <span>Prediction: ${match.predicted_home_score} - ${match.predicted_away_score}</span>
        <span>${resultLabel(match.result)}</span>
        <strong>+${match.points}</strong>
      </div>
    `;
    recentList.appendChild(item);
  });

  dialog.showModal();
}

function resultLabel(result) {
  if (result === "exact") return "Exact score";
  if (result === "correct") return "Correct outcome";
  return "Missed";
}

function flagEmoji(code) {
  if (!code) return "";

  const specialCases = {
    "GB-ENG": "🏴",
    "GB-SCT": "🏴",
  };
  if (specialCases[code]) return specialCases[code];
  if (!/^[A-Z]{2}$/.test(code)) return "";

  return code
    .split("")
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
    .join("");
}

function rankLabel(rank) {
  if (rank === 1) return "Gold medal";
  if (rank === 2) return "Silver medal";
  if (rank === 3) return "Bronze medal";
  return rank;
}

function rankClass(rank) {
  if (rank === 1) return "rank-badge--gold";
  if (rank === 2) return "rank-badge--silver";
  if (rank === 3) return "rank-badge--bronze";
  return "";
}

function formatTimestamp(value) {
  if (!value) return "No data yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

loadLeaderboard();
setInterval(loadLeaderboard, 60000);

document.getElementById("dialog-close").addEventListener("click", () => {
  document.getElementById("player-dialog").close();
});
