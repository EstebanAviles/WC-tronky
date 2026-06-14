let leaderboardRows = [];
let matchRows = [];
let selectedPlayer = null;
let selectedTab = "recent";

const TEAM_FLAGS = {
  ALEMANIA: "DE",
  ARGELIA: "DZ",
  ARGENTINA: "AR",
  "ARABIA SAUDITA": "SA",
  AUSTRALIA: "AU",
  AUSTRIA: "AT",
  BELGICA: "BE",
  BOSNIA: "BA",
  BRASIL: "BR",
  "CABO VERDE": "CV",
  CANADA: "CA",
  COLOMBIA: "CO",
  "COREA DEL SUR": "KR",
  "COSTA DE MARFIL": "CI",
  CROACIA: "HR",
  CURAZAO: "CW",
  ECUADOR: "EC",
  EGIPTO: "EG",
  ESCOCIA: "GB-SCT",
  ESPAÑA: "ES",
  "ESTADOS UNIDOS": "US",
  FRANCIA: "FR",
  GHANA: "GH",
  HAITI: "HT",
  INGLATERRA: "GB-ENG",
  IRAK: "IQ",
  IRAN: "IR",
  JAPON: "JP",
  JORDANIA: "JO",
  MARRUECOS: "MA",
  MEXICO: "MX",
  NORUEGA: "NO",
  "NUEVA ZELANDA": "NZ",
  "PAISES BAJOS": "NL",
  PANAMA: "PA",
  PARAGUAY: "PY",
  PORTUGAL: "PT",
  QATAR: "QA",
  "RD CONGO": "CD",
  "REPUBLICA CHECA": "CZ",
  SENEGAL: "SN",
  SUDAFRICA: "ZA",
  SUECIA: "SE",
  SUIZA: "CH",
  TUNEZ: "TN",
  TURQUIA: "TR",
  URUGUAY: "UY",
  UZBEKISTAN: "UZ",
};

async function loadPageData() {
  await Promise.all([loadLeaderboard(), loadMatches()]);
  renderStats();
}

async function loadLeaderboard() {
  const lastUpdated = document.getElementById("last-updated");
  const playerCount = document.getElementById("player-count");
  const leaderName = document.getElementById("leader-name");
  const tbody = document.getElementById("leaderboard-body");
  const statusPill = document.getElementById("status-pill");
  const tableMessage = document.getElementById("table-message");

  try {
    const response = await fetch("./data/leaderboard.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar la tabla.");

    const data = await response.json();
    leaderboardRows = data.leaderboard || [];

    playerCount.textContent = leaderboardRows.length;
    leaderName.textContent = leaderboardRows[0]?.participant || "-";
    lastUpdated.textContent = formatTimestamp(data.last_updated);
    statusPill.textContent = "Actualizada";
    statusPill.className = "status-pill status-pill--ok";
    tableMessage.textContent = leaderboardRows.length ? "" : "Todavía no hay pronósticos puntuados.";
    tbody.innerHTML = "";

    leaderboardRows.forEach((row, index) => {
      const rank = row.rank || index + 1;
      const tr = document.createElement("tr");
      tr.className = rank <= 3 ? `rank-${rank}` : "";
      tr.innerHTML = `
        <td data-label="Puesto"><span class="rank-badge ${rankClass(rank)}">${rankLabel(rank)}</span></td>
        <td data-label="Jugador">
          <button class="player-button" type="button">${escapeHtml(row.participant)}</button>
          <span class="movement ${movementClass(row.movement)}">${movementLabel(row.movement)}</span>
        </td>
        <td data-label="Puntos"><strong>${row.points}</strong></td>
        <td data-label="Marcador exacto">${row.exact_scores}</td>
        <td data-label="Ganador correcto">${row.correct_results}</td>
        <td data-label="Fallos">${row.missed_results}</td>
      `;
      tr.querySelector(".player-button").addEventListener("click", () => openPlayerDialog(row));
      tbody.appendChild(tr);
    });
  } catch (error) {
    statusPill.textContent = "Error de datos";
    statusPill.className = "status-pill status-pill--error";
    tableMessage.textContent = error.message;
  }
}

async function loadMatches() {
  const matchList = document.getElementById("match-list");
  const matchStatus = document.getElementById("matches-status");
  const matchMessage = document.getElementById("match-message");

  try {
    const response = await fetch("./data/match_scores.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar los partidos.");

    const data = await response.json();
    matchRows = data.matches || [];

    matchStatus.textContent = "Actualizados";
    matchStatus.className = "status-pill status-pill--ok";
    matchMessage.textContent = matchRows.length ? "" : "Todavía no hay partidos.";
    renderMatches(matchList);
  } catch (error) {
    matchStatus.textContent = "Error de datos";
    matchStatus.className = "status-pill status-pill--error";
    matchMessage.textContent = error.message;
  }
}

function renderMatches(container) {
  const groups = [
    ["live", "En vivo"],
    ["finished", "Finalizados"],
    ["scheduled", "Próximos"],
  ];
  container.innerHTML = "";

  groups.forEach(([status, title]) => {
    const matches = matchRows
      .filter((match) => match.status === status)
      .sort((a, b) => Number(b.source_order || b.match_id) - Number(a.source_order || a.match_id));
    if (!matches.length) return;

    const section = document.createElement("section");
    section.className = "match-group";
    section.innerHTML = `<h3>${title}</h3><div class="match-grid"></div>`;
    const grid = section.querySelector(".match-grid");

    matches.forEach((match) => {
      const card = document.createElement("article");
      card.className = `match-card ${match.status === "live" ? "match-card--live" : ""}`;
      card.innerHTML = `
        <button class="match-card__button" type="button">
          <div class="match-card__meta">
            <span>${match.group ? `Grupo ${match.group}` : match.stage}</span>
            <strong>${statusLabel(match.status)}</strong>
          </div>
          <div class="match-card__score">
            <span title="${escapeHtml(match.home_team)}">${flagMarkup(flagForTeam(match.home_team), match.home_team, "flag-img--large")}</span>
            <strong>${scoreLabel(match)}</strong>
            <span title="${escapeHtml(match.away_team)}">${flagMarkup(flagForTeam(match.away_team), match.away_team, "flag-img--large")}</span>
          </div>
          <div class="match-card__date">${escapeHtml(match.played_at || "")}</div>
        </button>
      `;
      card.querySelector("button").addEventListener("click", () => openMatchDialog(match));
      grid.appendChild(card);
    });

    container.appendChild(section);
  });
}

function renderStats() {
  const statsGrid = document.getElementById("stats-grid");
  if (!statsGrid || !leaderboardRows.length) return;

  const allResults = leaderboardRows.flatMap((row) =>
    (row.all_results || []).map((result) => ({ ...result, participant: row.participant }))
  );
  const exactLeader = maxBy(leaderboardRows, (row) => row.exact_scores);
  const missLeader = maxBy(leaderboardRows, (row) => row.missed_results);
  const exactMatch = topMatchBy(allResults, "exact");
  const hardestMatch = topMatchBy(allResults, "miss");

  const cards = [
    ["Líder", leaderboardRows[0].participant, `${leaderboardRows[0].points} pts`],
    ["Más marcadores exactos", exactLeader.participant, exactLeader.exact_scores],
    ["Más fallos", missLeader.participant, missLeader.missed_results],
    ["Partido con más exactos", exactMatch?.label || "-", exactMatch ? exactMatch.count : "-"],
    ["Partido más difícil", hardestMatch?.label || "-", hardestMatch ? hardestMatch.count : "-"],
  ];

  statsGrid.innerHTML = cards
    .map(([label, value, detail]) => `
      <article class="stat-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(String(detail))}</small>
      </article>
    `)
    .join("");
}

function openPlayerDialog(player) {
  selectedPlayer = player;
  selectedTab = "recent";
  document.getElementById("dialog-player-name").textContent = player.participant;
  document.getElementById("dialog-player-points").textContent = player.points;
  setActiveTab();
  renderPlayerResults();
  document.getElementById("player-dialog").showModal();
}

function renderPlayerResults() {
  const recentList = document.getElementById("recent-list");
  const results = selectedTab === "all"
    ? selectedPlayer?.all_results || []
    : selectedPlayer?.recent_results || [];

  recentList.innerHTML = results.length
    ? results.map((match) => resultCard(match)).join("")
    : `<p class="table-message">Todavía no hay partidos puntuados.</p>`;
}

function openMatchDialog(match) {
  const dialog = document.getElementById("match-dialog");
  const title = document.getElementById("dialog-match-title");
  const list = document.getElementById("match-prediction-list");
  const predictions = leaderboardRows
    .map((player) => {
      const result = (player.all_results || []).find((item) => item.match_id === match.match_id);
      return result ? { ...result, participant: player.participant } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.points - a.points || resultWeight(b.result) - resultWeight(a.result));

  title.innerHTML = `
    ${flagMarkup(flagForTeam(match.home_team), match.home_team)}
    <span>${escapeHtml(scoreLabel(match))}</span>
    ${flagMarkup(flagForTeam(match.away_team), match.away_team)}
  `;
  list.innerHTML = predictions.length
    ? predictions.map((prediction) => `
      <article class="prediction-card prediction-card--${prediction.result}">
        <strong>${escapeHtml(prediction.participant)}</strong>
        <span>Pronóstico: ${prediction.predicted_home_score} - ${prediction.predicted_away_score}</span>
        <span>${resultLabel(prediction.result)}</span>
        <b>+${prediction.points}</b>
      </article>
    `).join("")
    : `<p class="table-message">Este partido todavía no tiene pronósticos puntuados.</p>`;

  dialog.showModal();
}

function resultCard(match) {
  return `
    <article class="recent-card recent-card--${match.result}">
      <div class="recent-card__teams">
        <span>${flagMarkup(match.home_flag, match.home_team)} ${escapeHtml(match.home_team)}</span>
        <strong>${match.actual_home_score} - ${match.actual_away_score}</strong>
        <span>${flagMarkup(match.away_flag, match.away_team)} ${escapeHtml(match.away_team)}</span>
      </div>
      <div class="recent-card__meta">
        <span>Pronóstico: ${match.predicted_home_score} - ${match.predicted_away_score}</span>
        <span>${resultLabel(match.result)}</span>
        <strong>+${match.points}</strong>
      </div>
    </article>
  `;
}

function topMatchBy(results, resultType) {
  const counts = new Map();
  results
    .filter((result) => result.result === resultType)
    .forEach((result) => {
      const key = result.match_id;
      const current = counts.get(key) || {
        count: 0,
        label: `${result.home_team} ${result.actual_home_score}-${result.actual_away_score} ${result.away_team}`,
      };
      current.count += 1;
      counts.set(key, current);
    });
  return [...counts.values()].sort((a, b) => b.count - a.count)[0];
}

function maxBy(rows, score) {
  return rows.slice().sort((a, b) => score(b) - score(a))[0];
}

function resultWeight(result) {
  if (result === "exact") return 3;
  if (result === "correct") return 2;
  return 1;
}

function resultLabel(result) {
  if (result === "exact") return "Marcador exacto";
  if (result === "correct") return "Ganador correcto";
  return "Fallo";
}

function statusLabel(status) {
  if (status === "live") return "En vivo";
  if (status === "finished") return "Finalizado";
  return "Programado";
}

function scoreLabel(match) {
  if (match.home_score === null || match.away_score === null) return "-";
  return `${match.home_score} - ${match.away_score}`;
}

function movementLabel(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "=";
}

function movementClass(value) {
  if (value > 0) return "movement--up";
  if (value < 0) return "movement--down";
  return "movement--same";
}

function flagForTeam(team) {
  return TEAM_FLAGS[team] || "";
}

function flagMarkup(code, label, extraClass = "") {
  const assetCode = flagAssetCode(code);
  if (!assetCode) return "";
  const classes = ["flag-img", extraClass].filter(Boolean).join(" ");
  return `<img class="${classes}" src="https://flagcdn.com/${assetCode}.svg" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" loading="lazy">`;
}

function flagAssetCode(code) {
  if (!code) return "";
  const normalized = String(code).toLowerCase();
  if (/^[a-z]{2}$/.test(normalized)) return normalized;
  if (/^gb-(eng|sct|wls)$/.test(normalized)) return normalized;
  return "";
}

function rankLabel(rank) {
  if (rank === 1) return "Oro";
  if (rank === 2) return "Plata";
  if (rank === 3) return "Bronce";
  return rank;
}

function rankClass(rank) {
  if (rank === 1) return "rank-badge--gold";
  if (rank === 2) return "rank-badge--silver";
  if (rank === 3) return "rank-badge--bronze";
  return "";
}

function formatTimestamp(value) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function setActiveTab() {
  document.getElementById("tab-recent").classList.toggle("tab-button--active", selectedTab === "recent");
  document.getElementById("tab-all").classList.toggle("tab-button--active", selectedTab === "all");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadPageData();
setInterval(loadPageData, 60000);

document.getElementById("dialog-close").addEventListener("click", () => {
  document.getElementById("player-dialog").close();
});
document.getElementById("match-dialog-close").addEventListener("click", () => {
  document.getElementById("match-dialog").close();
});
document.getElementById("tab-recent").addEventListener("click", () => {
  selectedTab = "recent";
  setActiveTab();
  renderPlayerResults();
});
document.getElementById("tab-all").addEventListener("click", () => {
  selectedTab = "all";
  setActiveTab();
  renderPlayerResults();
});
