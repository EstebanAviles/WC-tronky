let leaderboardRows = [];
let matchRows = [];
let predictionRows = [];
let selectedPlayer = null;
let selectedTab = "recent";

const LIVE_API_URL = "https://worldcup26.ir/get/games";
const LIVE_REFRESH_MS = 15000;
const SCORING_STATUSES = new Set(["finished", "live"]);
const EXACT_POINTS = 5;
const CORRECT_POINTS = 2;

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

const TEAM_ALIASES = {
  ALGERIA: "ARGELIA",
  ARGENTINA: "ARGENTINA",
  "SAUDI ARABIA": "ARABIA SAUDITA",
  AUSTRIA: "AUSTRIA",
  BELGIUM: "BELGICA",
  "BOSNIA AND HERZEGOVINA": "BOSNIA",
  BRAZIL: "BRASIL",
  "CAPE VERDE": "CABO VERDE",
  COLOMBIA: "COLOMBIA",
  "COTE D IVOIRE": "COSTA DE MARFIL",
  "COTE D'IVOIRE": "COSTA DE MARFIL",
  CROATIA: "CROACIA",
  CZECHIA: "REPUBLICA CHECA",
  "CZECH REPUBLIC": "REPUBLICA CHECA",
  "DR CONGO": "RD CONGO",
  "DEMOCRATIC REPUBLIC OF CONGO": "RD CONGO",
  "DEMOCRATIC REPUBLIC OF THE CONGO": "RD CONGO",
  "CONGO DR": "RD CONGO",
  CURACAO: "CURAZAO",
  ECUADOR: "ECUADOR",
  EGYPT: "EGIPTO",
  ENGLAND: "INGLATERRA",
  FRANCE: "FRANCIA",
  GERMANY: "ALEMANIA",
  HAITI: "HAITI",
  IRAN: "IRAN",
  IRAQ: "IRAK",
  "IVORY COAST": "COSTA DE MARFIL",
  JAPAN: "JAPON",
  JORDAN: "JORDANIA",
  "KOREA REPUBLIC": "COREA DEL SUR",
  MEXICO: "MEXICO",
  MOROCCO: "MARRUECOS",
  NETHERLANDS: "PAISES BAJOS",
  "NEW ZEALAND": "NUEVA ZELANDA",
  NORWAY: "NORUEGA",
  PARAGUAY: "PARAGUAY",
  PORTUGAL: "PORTUGAL",
  QATAR: "QATAR",
  SCOTLAND: "ESCOCIA",
  SENEGAL: "SENEGAL",
  "SOUTH AFRICA": "SUDAFRICA",
  "SOUTH KOREA": "COREA DEL SUR",
  SPAIN: "ESPANA",
  SWEDEN: "SUECIA",
  SWITZERLAND: "SUIZA",
  TUNISIA: "TUNEZ",
  TURKIYE: "TURQUIA",
  TURKEY: "TURQUIA",
  "UNITED STATES": "ESTADOS UNIDOS",
  URUGUAY: "URUGUAY",
  UZBEKISTAN: "UZBEKISTAN",
  USA: "ESTADOS UNIDOS",
};

async function loadPageData() {
  try {
    const [leaderboardData, matchData, predictionData] = await Promise.all([
      fetchJson("./data/leaderboard.json"),
      fetchJson("./data/match_scores.json"),
      fetchJson("./data/predictions.json"),
    ]);

    predictionRows = predictionData.predictions || [];
    matchRows = await liveMatches(matchData.matches || []);
    leaderboardRows = predictionRows.length
      ? scoreLeaderboard(predictionRows, matchRows)
      : leaderboardData.leaderboard || [];

    renderLeaderboard(leaderboardRows, matchData.last_updated || leaderboardData.last_updated);
    renderHeroLive(matchRows);
    renderMatches(document.getElementById("match-list"));
  } catch (error) {
    setLoadError(error);
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar ${path}.`);
  return response.json();
}

function renderLeaderboard(rows, lastUpdatedValue) {
  const lastUpdated = document.getElementById("last-updated");
  const playerCount = document.getElementById("player-count");
  const leaderName = document.getElementById("leader-name");
  const tbody = document.getElementById("leaderboard-body");
  const statusPill = document.getElementById("status-pill");
  const tableMessage = document.getElementById("table-message");

  playerCount.textContent = rows.length;
  leaderName.textContent = rows[0]?.participant || "-";
  lastUpdated.textContent = formatTimestamp(lastUpdatedValue);
  statusPill.textContent = "En vivo";
  statusPill.className = "status-pill status-pill--ok";
  tableMessage.textContent = rows.length ? "" : "Todavía no hay pronósticos puntuados.";
  tbody.innerHTML = "";

  rows.forEach((row, index) => {
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
}

function setLoadError(error) {
  document.getElementById("status-pill").textContent = "Error de datos";
  document.getElementById("status-pill").className = "status-pill status-pill--error";
  document.getElementById("table-message").textContent = error.message;
  document.getElementById("matches-status").textContent = "Error de datos";
  document.getElementById("matches-status").className = "status-pill status-pill--error";
  document.getElementById("match-message").textContent = error.message;
}

function renderMatches(container) {
  const matchStatus = document.getElementById("matches-status");
  const matchMessage = document.getElementById("match-message");
  const groups = [
    ["live", "En vivo"],
    ["finished", "Finalizados"],
    ["scheduled", "Próximos"],
  ];

  matchStatus.textContent = "En vivo";
  matchStatus.className = "status-pill status-pill--ok";
  matchMessage.textContent = matchRows.length ? "" : "Todavía no hay partidos.";
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
      card.className = [
        "match-card",
        match.status === "live" ? "match-card--live" : "",
        groupClass(match.group),
      ].filter(Boolean).join(" ");
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

function renderHeroLive(matches) {
  const livePanel = document.getElementById("hero-live");
  const liveMatch = matches
    .filter((match) => match.status === "live")
    .sort((a, b) => Number(b.source_order || b.match_id) - Number(a.source_order || a.match_id))[0];

  if (!liveMatch) {
    livePanel.hidden = true;
    return;
  }

  livePanel.hidden = false;
  document.getElementById("hero-live-home").innerHTML = flagMarkup(flagForTeam(liveMatch.home_team), liveMatch.home_team);
  document.getElementById("hero-live-score").textContent = scoreLabel(liveMatch);
  document.getElementById("hero-live-away").innerHTML = flagMarkup(flagForTeam(liveMatch.away_team), liveMatch.away_team);
  document.getElementById("hero-live-meta").textContent = `${liveMatch.home_team} vs ${liveMatch.away_team}`;
}

async function liveMatches(staticMatches) {
  try {
    const response = await fetch(`${LIVE_API_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return staticMatches;

    const payload = await response.json();
    const games = Array.isArray(payload) ? payload : payload.games || [];
    const schedule = scheduleByPair(staticMatches);
    const byMatchId = new Map(staticMatches.map((match) => [Number(match.match_id), { ...match }]));

    games.forEach((game) => {
      const converted = convertLiveGame(game, schedule);
      if (converted) byMatchId.set(Number(converted.match_id), converted);
    });

    return [...byMatchId.values()].sort((a, b) => Number(a.source_order || a.match_id) - Number(b.source_order || b.match_id));
  } catch (_error) {
    return staticMatches;
  }
}

function scheduleByPair(matches) {
  const schedule = new Map();
  matches.forEach((match) => {
    schedule.set(pairKey(match.home_team, match.away_team), { match, reverse: false });
    schedule.set(pairKey(match.away_team, match.home_team), { match, reverse: true });
  });
  return schedule;
}

function convertLiveGame(game, schedule) {
  const homeTeam = normalizeTeam(game.home_team_name_en || "");
  const awayTeam = normalizeTeam(game.away_team_name_en || "");
  const scheduleMatch = schedule.get(pairKey(homeTeam, awayTeam));
  if (!scheduleMatch) return null;

  const status = liveGameStatus(game);
  const homeScore = numberOrNull(game.home_score);
  const awayScore = numberOrNull(game.away_score);
  const scoreHome = scheduleMatch.reverse ? awayScore : homeScore;
  const scoreAway = scheduleMatch.reverse ? homeScore : awayScore;

  if (status !== "scheduled" && (scoreHome === null || scoreAway === null)) return null;

  return {
    ...scheduleMatch.match,
    home_score: status === "scheduled" ? null : scoreHome,
    away_score: status === "scheduled" ? null : scoreAway,
    status,
    source_match_id: numberOrNull(game.id),
    source_order: liveSourceOrder(game),
    played_at: game.local_date || scheduleMatch.match.played_at || "",
  };
}

function liveGameStatus(game) {
  const finished = String(game.finished || "").toUpperCase();
  const elapsed = String(game.time_elapsed || "").toLowerCase();
  if (finished === "TRUE") return "finished";
  if (elapsed && !["notstarted", "not started", "0", "none", "null"].includes(elapsed)) return "live";
  return "scheduled";
}

function liveSourceOrder(game) {
  const id = Number(game.id || 0);
  const parsed = parseWorldCupDate(game.local_date || "");
  return Number.isNaN(parsed) ? id : parsed + id;
}

function parseWorldCupDate(value) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return NaN;
  const [, month, day, year, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
}

function scoreLeaderboard(predictions, matches) {
  const currentMatches = currentScoringMatches(matches);
  const previousRanks = rankMap(scoreRows(predictions, previousScoringMatches(currentMatches)));
  return scoreRows(predictions, currentMatches).map((row, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(row.participant);
    return {
      ...row,
      rank,
      movement: previousRank ? previousRank - rank : 0,
    };
  });
}

function currentScoringMatches(matches) {
  return matches.filter((match) => SCORING_STATUSES.has(String(match.status || "").toLowerCase()));
}

function previousScoringMatches(matches) {
  if (matches.some((match) => match.status === "live")) {
    return matches.filter((match) => match.status === "finished");
  }

  const finished = matches.filter((match) => match.status === "finished");
  if (!finished.length) return [];

  const latest = finished.slice().sort((a, b) => Number(b.source_order || b.match_id) - Number(a.source_order || a.match_id))[0];
  return matches.filter((match) => Number(match.match_id) !== Number(latest.match_id));
}

function rankMap(rows) {
  return new Map(rows.map((row, index) => [row.participant, index + 1]));
}

function scoreRows(predictions, matches) {
  const matchesById = new Map(matches.map((match) => [Number(match.match_id), match]));
  const rowsByPlayer = new Map();

  predictions.forEach((prediction) => {
    const participant = prediction.participant;
    const row = rowsByPlayer.get(participant) || {
      participant,
      points: 0,
      exact_scores: 0,
      correct_results: 0,
      missed_results: 0,
      recent_results: [],
      all_results: [],
    };
    const match = matchesById.get(Number(prediction.match_id));

    if (match) {
      const scored = scorePrediction(prediction, match);
      row.points += scored.points;
      row.exact_scores += scored.result === "exact" ? 1 : 0;
      row.correct_results += scored.result === "correct" ? 1 : 0;
      row.missed_results += scored.result === "miss" ? 1 : 0;
      row.all_results.push(resultForPlayer(prediction, match, scored));
    }

    rowsByPlayer.set(participant, row);
  });

  return [...rowsByPlayer.values()]
    .map((row) => {
      const allResults = row.all_results.sort((a, b) => Number(b.source_order || b.match_id) - Number(a.source_order || a.match_id));
      return {
        ...row,
        recent_results: allResults.slice(0, 5),
        all_results: allResults,
      };
    })
    .sort((a, b) => b.points - a.points || b.exact_scores - a.exact_scores || b.correct_results - a.correct_results);
}

function scorePrediction(prediction, match) {
  const predictedHome = Number(prediction.predicted_home_score);
  const predictedAway = Number(prediction.predicted_away_score);
  const actualHome = Number(match.home_score);
  const actualAway = Number(match.away_score);

  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { points: EXACT_POINTS, result: "exact" };
  }
  if (outcome(predictedHome, predictedAway) === outcome(actualHome, actualAway)) {
    return { points: CORRECT_POINTS, result: "correct" };
  }
  return { points: 0, result: "miss" };
}

function resultForPlayer(prediction, match, scored) {
  return {
    match_id: Number(prediction.match_id),
    source_match_id: match.source_match_id,
    source_order: Number(match.source_order || prediction.match_id),
    played_at: match.played_at || "",
    stage: match.stage || prediction.stage || "",
    group: match.group || prediction.group || "",
    status: String(match.status || "").toLowerCase(),
    home_team: match.home_team || prediction.home_team,
    away_team: match.away_team || prediction.away_team,
    home_flag: flagForTeam(match.home_team || prediction.home_team),
    away_flag: flagForTeam(match.away_team || prediction.away_team),
    predicted_home_score: Number(prediction.predicted_home_score),
    predicted_away_score: Number(prediction.predicted_away_score),
    actual_home_score: Number(match.home_score),
    actual_away_score: Number(match.away_score),
    points: scored.points,
    result: scored.result,
  };
}

function outcome(homeScore, awayScore) {
  if (homeScore > awayScore) return "H";
  if (homeScore < awayScore) return "A";
  return "D";
}

function pairKey(homeTeam, awayTeam) {
  return `${normalizeTeam(homeTeam)}|${normalizeTeam(awayTeam)}`;
}

function normalizeTeam(value) {
  const text = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replaceAll(".", "")
    .replaceAll("-", " ")
    .trim()
    .replace(/\s+/g, " ");
  return TEAM_ALIASES[text] || text;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "null") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function groupClass(group) {
  const normalized = String(group || "").trim().toLowerCase();
  return /^[a-h]$/.test(normalized) ? `match-card--group-${normalized}` : "";
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
setInterval(loadPageData, LIVE_REFRESH_MS);

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
