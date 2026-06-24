let leaderboardRows = [];
let matchRows = [];
let staticMatchRows = [];
let predictionRows = [];
let fallbackLeaderboardRows = [];
let fallbackLastUpdated = "";
let liveLastUpdated = "";
let selectedPlayer = null;
let isLoadingPageData = false;
let isRefreshingLive = false;
let liveRefreshTimerId = null;
let freshnessTimerId = null;
let lastMatchSignature = "";
let selectedResultFilter = null;
let selectedMatchView = "scheduled";
let previousLeaderboardSnapshot = new Map();
let hasRenderedLeaderboard = false;
let enableLeaderboardAnimations = false;
const expandedMatchViews = new Set();

const LIVE_API_URL = "https://worldcup-tronky-live.eavileslino.workers.dev/scores";
const LIVE_REFRESH_ACTIVE_MS = 5000;
const LIVE_REFRESH_WATCH_MS = 10000;
const LIVE_REFRESH_IDLE_MS = 60000;
const LIVE_FETCH_TIMEOUT_MS = 10000;
const LIVE_STALE_WARNING_MS = 120000;
const KICKOFF_WATCH_BEFORE_MS = 30 * 60 * 1000;
const KICKOFF_WATCH_AFTER_MS = 20 * 60 * 1000;
const DISPLAY_TIME_ZONE = "America/Lima";
const SCORING_STATUSES = new Set(["finished", "live"]);
const EXACT_POINTS = 6;
const CORRECT_POINTS = 3;
const MATCH_COMPACT_LIMIT = 6;
const COUNTER_FILTERS = {
  exact: "Marcador exacto",
  goalDifference: "Diferencia de goles",
  correct: "Ganador correcto",
  miss: "Fallos",
};

const MATCH_TIME_ZONES = {
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
};

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
  "CURA?AO": "CURAZAO",
  CURACAO: "CURAZAO",
  CURAÇAO: "CURAZAO",
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

const PARTICIPANT_LABELS = {
  Alen: "Alen Ganador",
  Zhoko: "Zhoko Ganador",
};

async function loadPageData() {
  if (isLoadingPageData) return;
  isLoadingPageData = true;

  try {
    const [leaderboardData, matchData, predictionData] = await Promise.all([
      fetchJson("./data/leaderboard.json"),
      fetchJson("./data/match_scores.json"),
      fetchJson("./data/predictions.json"),
    ]);

    predictionRows = predictionData.predictions || [];
    staticMatchRows = matchData.matches || [];
    fallbackLeaderboardRows = leaderboardData.leaderboard || [];
    fallbackLastUpdated = matchData.last_updated || leaderboardData.last_updated;
    matchRows = staticMatchRows;
    lastMatchSignature = matchesSignature(matchRows);
    renderPageState();
    startFreshnessClock();
    startLiveRefreshLoop(0);
  } catch (error) {
    setLoadError(error);
  } finally {
    isLoadingPageData = false;
  }
}

function renderPageState() {
  leaderboardRows = predictionRows.length
    ? scoreLeaderboard(predictionRows, matchRows)
    : fallbackLeaderboardRows;
  renderLeaderboard(leaderboardRows, liveLastUpdated || fallbackLastUpdated);
  renderHeroLive(matchRows);
  renderMatches(document.getElementById("match-list"));
}

async function refreshLiveMatches() {
  if (isRefreshingLive || !staticMatchRows.length) return;
  isRefreshingLive = true;

  try {
    const liveRows = await liveMatches(staticMatchRows);
    if (!liveRows) return;

    const nextSignature = matchesSignature(liveRows);
    if (nextSignature === lastMatchSignature) {
      matchRows = liveRows;
      renderHeroLive(matchRows);
      updateFreshnessDisplay(liveLastUpdated || fallbackLastUpdated);
      return;
    }

    matchRows = liveRows;
    lastMatchSignature = nextSignature;
    renderPageState();
  } finally {
    isRefreshingLive = false;
    enableLeaderboardAnimations = true;
  }
}

function startLiveRefreshLoop(delayMs = liveRefreshDelay()) {
  if (liveRefreshTimerId) clearTimeout(liveRefreshTimerId);
  liveRefreshTimerId = setTimeout(async () => {
    try {
      await refreshLiveMatches();
    } catch (error) {
      console.warn("Live refresh failed; retrying soon.", error);
    } finally {
      startLiveRefreshLoop();
    }
  }, delayMs);
}

function liveRefreshDelay() {
  if (document.hidden) return LIVE_REFRESH_IDLE_MS;
  if (hasLiveMatch(matchRows)) return LIVE_REFRESH_ACTIVE_MS;
  if (hasMatchNearKickoff(matchRows)) return LIVE_REFRESH_WATCH_MS;
  return LIVE_REFRESH_IDLE_MS;
}

function hasLiveMatch(matches) {
  return matches.some((match) => match.status === "live");
}

function hasMatchNearKickoff(matches) {
  const now = Date.now();
  return matches.some((match) => {
    if (match.status !== "scheduled") return false;
    const kickoff = matchTimestamp(match);
    if (Number.isNaN(kickoff)) return false;
    return kickoff - now <= KICKOFF_WATCH_BEFORE_MS && now - kickoff <= KICKOFF_WATCH_AFTER_MS;
  });
}

function matchesSignature(matches) {
  return JSON.stringify(matches.map((match) => [
    Number(match.match_id),
    match.status,
    match.home_score,
    match.away_score,
    match.played_at,
    match.live_elapsed,
    match.football_data_status,
    Number(match.source_order || match.match_id),
  ]));
}

function startFreshnessClock() {
  if (freshnessTimerId) return;
  freshnessTimerId = setInterval(() => {
    updateFreshnessDisplay(liveLastUpdated || fallbackLastUpdated);
  }, 1000);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar ${path}.`);
  return response.json();
}

function renderLeaderboard(rows, lastUpdatedValue) {
  const playerCount = document.getElementById("player-count");
  const leaderName = document.getElementById("leader-name");
  const leaderSummary = document.getElementById("leader-summary");
  const tbody = document.getElementById("leaderboard-body");
  const tableMessage = document.getElementById("table-message");

  playerCount.textContent = rows.length;
  leaderName.textContent = leaderLabel(rows);
  leaderSummary.textContent = leaderSummaryLabel(rows);
  updateFreshnessDisplay(lastUpdatedValue);
  tableMessage.textContent = rows.length ? "" : "Todavía no hay pronósticos puntuados.";
  tbody.innerHTML = "";

  rows.forEach((row, index) => {
    const rank = row.rank || index + 1;
    const previous = previousLeaderboardSnapshot.get(row.participant);
    const didChange = enableLeaderboardAnimations && hasRenderedLeaderboard && previous && (previous.rank !== rank || previous.points !== row.points);
    const tr = document.createElement("tr");
    tr.className = rowClass(rank, rows.length, row.is_last);
    if (didChange) tr.classList.add("row-updated");
    tr.innerHTML = `
      <td data-label="Puesto"><span class="rank-badge ${rankClass(rank)}">${rankLabel(rank)}</span></td>
      <td data-label="Jugador">
        <button class="player-button" type="button">${escapeHtml(participantLabel(row.participant))}</button>
        <span class="movement ${movementClass(row.movement)}">${movementLabel(row.movement)}</span>
      </td>
      <td data-label="Puntos"><strong>${row.points}</strong></td>
      <td data-label="E">${counterButtonMarkup("exact", row.exact_scores)}</td>
      <td data-label="DG">${counterButtonMarkup("goalDifference", row.goal_differences ?? 0)}</td>
      <td data-label="G">${counterButtonMarkup("correct", row.correct_results)}</td>
      <td data-label="F">${counterButtonMarkup("miss", row.missed_results)}</td>
      <td data-label="PJ">${row.played_matches}</td>
      <td data-label="Últimas 5">${lastFiveMarkup(row.recent_results || [])}</td>
    `;
    tr.querySelector(".player-button").addEventListener("click", () => openPlayerDialog(row));
    tr.querySelectorAll("[data-counter-filter]").forEach((button) => {
      button.addEventListener("click", () => openPlayerDialog(row, button.dataset.counterFilter));
    });
    tbody.appendChild(tr);
  });

  previousLeaderboardSnapshot = new Map(rows.map((row, index) => [
    row.participant,
    {
      rank: row.rank || index + 1,
      points: row.points,
    },
  ]));
  hasRenderedLeaderboard = true;
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
  const matchesTitle = document.getElementById("matches-title");
  const isScheduledView = selectedMatchView === "scheduled";
  const allMatches = matchRows
    .filter((match) => isScheduledView ? match.status === "scheduled" : match.status === "finished")
    .sort((a, b) => isScheduledView ? matchSort("scheduled", a, b) : matchSort("recent", a, b));
  const isExpanded = expandedMatchViews.has(selectedMatchView);
  const matches = isExpanded ? allMatches : allMatches.slice(0, MATCH_COMPACT_LIMIT);

  matchesTitle.textContent = isScheduledView ? "Próximos partidos" : "Resultados recientes";
  matchStatus.textContent = isScheduledView ? "Próximos" : "Recientes";
  matchStatus.className = "status-pill status-pill--ok";
  matchMessage.textContent = allMatches.length
    ? ""
    : (isScheduledView ? "No hay próximos partidos." : "Todavía no hay resultados recientes.");
  container.innerHTML = "";

  if (!allMatches.length) return;

  const section = document.createElement("section");
  section.className = "match-group";
  section.innerHTML = `<div class="match-grid"></div>`;
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
        <div class="match-card__date">${escapeHtml(matchDateLabel(match))}</div>
        ${liveDebugMarkup(match)}
      </button>
    `;
    card.querySelector("button").addEventListener("click", () => openMatchDialog(match));
    grid.appendChild(card);
  });

  container.appendChild(section);

  if (allMatches.length > MATCH_COMPACT_LIMIT) {
    const toggle = document.createElement("button");
    toggle.className = "match-toggle";
    toggle.type = "button";
    toggle.textContent = isExpanded ? "Ver menos" : `Ver todos (${allMatches.length})`;
    toggle.addEventListener("click", () => {
      if (isExpanded) expandedMatchViews.delete(selectedMatchView);
      else expandedMatchViews.add(selectedMatchView);
      renderMatches(container);
    });
    container.appendChild(toggle);
  }
}

function renderHeroLive(matches) {
  const livePanel = document.getElementById("hero-live");
  const liveMatchesList = matches
    .filter((match) => match.status === "live")
    .sort((a, b) => Number(a.source_order || a.match_id) - Number(b.source_order || b.match_id));

  if (!liveMatchesList.length) {
    livePanel.hidden = true;
    livePanel.innerHTML = "";
    return;
  }

  livePanel.hidden = false;
  livePanel.innerHTML = `
    <div class="hero-live__list">
      ${liveMatchesList.map((match, index) => heroLiveButtonMarkup(match, index, liveMatchesList.length)).join("")}
    </div>
  `;
  livePanel.querySelectorAll("[data-live-match-index]").forEach((button) => {
    const liveMatch = liveMatchesList[Number(button.dataset.liveMatchIndex)];
    button.addEventListener("click", () => openMatchDialog(liveMatch));
  });
}

function heroLiveButtonMarkup(match, index, liveCount) {
  const debug = liveDebugLabel(match);
  const label = liveCount > 1 ? `En vivo ${index + 1}/${liveCount}` : "En vivo";
  return `
    <button class="hero-live__button" data-live-match-index="${index}" type="button">
      <div class="hero-live__topline">
        <span class="hero-live__label">${escapeHtml(label)}</span>
        <span class="hero-live__credit">Gracias a: ${escapeHtml(liveSourceLabel(match))}</span>
      </div>
      <div class="hero-live__teams">
        <span>${flagMarkup(flagForTeam(match.home_team), match.home_team)}</span>
        <strong>${escapeHtml(scoreLabel(match))}</strong>
        <span>${flagMarkup(flagForTeam(match.away_team), match.away_team)}</span>
      </div>
      <div class="hero-live__footer">
        <small class="hero-live__meta">${escapeHtml(`${match.home_team} vs ${match.away_team}`)}</small>
        ${debug ? `<small class="hero-live__debug">${escapeHtml(debug)}</small>` : ""}
      </div>
    </button>
  `;
}

async function liveMatches(staticMatches) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${LIVE_API_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    liveLastUpdated = response.headers.get("x-tronky-cache-updated-at") || new Date().toISOString();
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
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function matchSort(status, a, b) {
  const orderA = matchSortValue(a);
  const orderB = matchSortValue(b);
  return status === "scheduled" ? orderA - orderB : orderB - orderA;
}

function matchSortValue(match) {
  const timestamp = matchTimestamp(match);
  return Number.isNaN(timestamp) ? Number(match.source_order || match.match_id) : timestamp;
}

function matchTimestamp(match) {
  return parseWorldCupDate(match.played_at || "", timeZoneForMatch(match));
}

function timeZoneForMatch(match) {
  return match.played_at_timezone || MATCH_TIME_ZONES[Number(match.source_match_id)] || DISPLAY_TIME_ZONE;
}

function matchDateLabel(match) {
  const timestamp = matchTimestamp(match);
  if (Number.isNaN(timestamp)) return match.played_at || "";
  return `${formatPeruDateTime(timestamp)} (Peru)`;
}

function formatPeruDateTime(timestamp) {
  const parts = new Intl.DateTimeFormat("es-PE", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
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
    source_order: liveSourceOrder(game, scheduleMatch.match),
    played_at: game.local_date || scheduleMatch.match.played_at || "",
    tronky_source: game.tronky_source || "worldcup26",
    live_elapsed: String(game.time_elapsed || ""),
    football_data_status: game.football_data_status || "",
  };
}

function liveSourceLabel(match) {
  return match.tronky_source === "football-data-backup" || match.backup_source === "football-data"
    ? "No iraní"
    : "Iraní";
}

function liveGameStatus(game) {
  const finished = String(game.finished || "").toUpperCase();
  const elapsed = String(game.time_elapsed || "").toLowerCase();
  if (finished === "TRUE") return "finished";
  if (elapsed && !["notstarted", "not started", "0", "none", "null"].includes(elapsed)) return "live";
  return "scheduled";
}

function liveSourceOrder(game, match) {
  const id = Number(game.id || 0);
  const parsed = parseWorldCupDate(game.local_date || "", timeZoneForMatch(match));
  return Number.isNaN(parsed) ? id : parsed + id;
}

function parseWorldCupDate(value, timeZone = DISPLAY_TIME_ZONE) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return NaN;
  const [, month, day, year, hour, minute] = match;
  return zonedTimeToUtcMs({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  }, timeZone);
}

function zonedTimeToUtcMs(target, timeZone) {
  let utcMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  for (let index = 0; index < 3; index += 1) {
    const parts = datePartsInTimeZone(utcMs, timeZone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
    const offset = targetAsUtc - localAsUtc;
    if (offset === 0) break;
    utcMs += offset;
  }
  return utcMs;
}

function datePartsInTimeZone(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function scoreLeaderboard(predictions, matches) {
  const currentMatches = currentScoringMatches(matches);
  const previousRanks = rankMap(assignCompetitionRanks(scoreRows(predictions, previousScoringMatches(currentMatches))));
  return assignCompetitionRanks(scoreRows(predictions, currentMatches)).map((row) => {
    const previousRank = previousRanks.get(row.participant);
    return {
      ...row,
      movement: previousRank ? previousRank - row.rank : 0,
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
  return new Map(rows.map((row, index) => [row.participant, row.rank || index + 1]));
}

function assignCompetitionRanks(rows) {
  const lastIndex = rows.length - 1;
  const rankedRows = [];
  rows.forEach((row, index) => {
    const previous = rankedRows[index - 1];
    const rank = previous && sameLeaderboardScore(row, previous) ? previous.rank : index + 1;
    rankedRows.push({
      ...row,
      rank,
      is_last: index === lastIndex || (rows[lastIndex] && sameLeaderboardScore(row, rows[lastIndex])),
    });
  });
  return rankedRows;
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
      goal_differences: 0,
      correct_results: 0,
      missed_results: 0,
      played_matches: 0,
      recent_results: [],
      all_results: [],
    };
    const match = matchesById.get(Number(prediction.match_id));

    if (match) {
      const scored = scorePrediction(prediction, match);
      row.points += scored.points;
      row.exact_scores += scored.result === "exact" ? 1 : 0;
      row.goal_differences += scored.goalDifference ? 1 : 0;
      row.correct_results += scored.result === "correct" ? 1 : 0;
      row.missed_results += scored.result === "miss" ? 1 : 0;
      row.played_matches += 1;
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
    .sort((a, b) => b.points - a.points || b.exact_scores - a.exact_scores || b.goal_differences - a.goal_differences || b.correct_results - a.correct_results);
}

function scorePrediction(prediction, match) {
  const predictedHome = Number(prediction.predicted_home_score);
  const predictedAway = Number(prediction.predicted_away_score);
  const actualHome = Number(match.home_score);
  const actualAway = Number(match.away_score);

  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { points: EXACT_POINTS, result: "exact", goalDifference: true };
  }
  if (outcome(predictedHome, predictedAway) === outcome(actualHome, actualAway)) {
    return {
      points: CORRECT_POINTS,
      result: "correct",
      goalDifference: predictedHome - predictedAway === actualHome - actualAway,
    };
  }
  return {
    points: 0,
    result: "miss",
    goalDifference: predictedHome - predictedAway === actualHome - actualAway,
  };
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
    goal_difference: scored.goalDifference,
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
  if (/^CURA.AO$/.test(text)) return "CURAZAO";
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

function participantLabel(name) {
  return PARTICIPANT_LABELS[name] || name || "";
}

function leaderLabel(rows) {
  if (!rows.length) return "-";
  const leader = rows[0];
  return rows
    .filter((row) => sameLeaderboardScore(row, leader))
    .map((row) => participantLabel(row.participant))
    .join(", ");
}

function leaderSummaryLabel(rows) {
  if (!rows.length) return "Todavía no hay líder.";
  const leaders = rows.filter((row) => sameLeaderboardScore(row, rows[0]));
  const next = rows.find((row) => !sameLeaderboardScore(row, rows[0]));
  const pointsTiedNext = rows.find((row) => row.participant !== rows[0].participant && Number(row.points) === Number(rows[0].points));

  if (leaders.length > 1) {
    return `Empate en la punta con ${rows[0].points} puntos.`;
  }
  if (!next) return `Lidera con ${rows[0].points} puntos.`;
  if (pointsTiedNext) {
    return `Lidera por ${tiebreakerLabel(rows[0], pointsTiedNext)}.`;
  }

  const gap = rows[0].points - next.points;
  return `Lidera por ${gap} punto${gap === 1 ? "" : "s"}.`;
}

function tiebreakerLabel(leader, challenger) {
  if (Number(leader.exact_scores) !== Number(challenger.exact_scores)) return "marcadores exactos";
  if (Number(leader.goal_differences || 0) !== Number(challenger.goal_differences || 0)) return "diferencias de gol";
  if (Number(leader.correct_results) !== Number(challenger.correct_results)) return "ganadores correctos";
  return "desempate";
}

function sameLeaderboardScore(a, b) {
  return Number(a.points) === Number(b.points)
    && Number(a.exact_scores) === Number(b.exact_scores)
    && Number(a.goal_differences || 0) === Number(b.goal_differences || 0)
    && Number(a.correct_results) === Number(b.correct_results);
}

function openPlayerDialog(player, resultFilter = null) {
  selectedPlayer = player;
  selectedResultFilter = resultFilter;
  const isCounterDetail = Boolean(resultFilter);
  document.querySelector("#player-dialog .dialog-score").hidden = isCounterDetail;
  document.querySelector("#player-dialog .dialog-tabs").hidden = isCounterDetail;
  document.getElementById("player-dialog-eyebrow").textContent = resultFilter ? "Detalle del contador" : "Racha del Jugador";
  document.getElementById("dialog-player-name").textContent = participantLabel(player.participant);
  document.getElementById("dialog-player-points").textContent = player.points;
  setPlayerTab("history");
  renderPlayerResults();
  renderRankHistory();
  document.getElementById("player-dialog").showModal();
}

function renderPlayerResults() {
  const recentList = document.getElementById("history-panel");
  const results = selectedPlayer?.all_results || [];
  const filteredResults = selectedResultFilter
    ? results.filter((match) => matchMatchesCounterFilter(match, selectedResultFilter))
    : results;
  const heading = selectedResultFilter
    ? `<div class="filter-summary"><strong>${escapeHtml(COUNTER_FILTERS[selectedResultFilter])}</strong><span>${filteredResults.length} partido${filteredResults.length === 1 ? "" : "s"}</span></div>`
    : "";
  const emptyMessage = selectedResultFilter
    ? "No hay partidos para este contador."
    : "Todavía no hay partidos puntuados.";

  recentList.innerHTML = filteredResults.length
    ? `${heading}${filteredResults.map((match) => resultCard(match)).join("")}`
    : `${heading}<p class="table-message">${emptyMessage}</p>`;
}

function renderRankHistory() {
  const panel = document.getElementById("rank-history-panel");
  const history = rankHistoryForPlayer(selectedPlayer?.participant);
  panel.innerHTML = history.points.length
    ? rankHistoryPlotMarkup(history)
    : `<p class="table-message">Todavía no hay suficientes partidos para mostrar puestos.</p>`;
  attachRankPlotTooltipHandlers(panel);
}

function rankHistoryForPlayer(participant) {
  const playedMatches = currentScoringMatches(matchRows)
    .slice()
    .sort((a, b) => matchSortValue(a) - matchSortValue(b));
  const currentRows = assignCompetitionRanks(scoreRows(predictionRows, playedMatches));
  const points = [];

  playedMatches.forEach((_, index) => {
    const partialMatches = playedMatches.slice(0, index + 1);
    const rows = assignCompetitionRanks(scoreRows(predictionRows, partialMatches));
    const playerRow = rows.find((row) => row.participant === participant);
    if (!playerRow) return;
    points.push({
      played: index + 1,
      rank: playerRow.rank,
      rowCount: rows.length,
    });
  });

  return {
    points,
    lastRank: currentRows.at(-1)?.rank || 1,
  };
}

function rankHistoryPlotMarkup(history) {
  const width = 640;
  const height = 305;
  const margin = { top: 26, right: 24, bottom: 64, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxPlayed = Math.max(...history.points.map((point) => point.played), 1);
  const maxRank = Math.max(history.lastRank, ...history.points.map((point) => point.rank), 1);
  const xFor = (played) => margin.left + (maxPlayed === 1 ? plotWidth / 2 : ((played - 1) / (maxPlayed - 1)) * plotWidth);
  const yFor = (rank) => margin.top + (maxRank === 1 ? 0 : ((rank - 1) / (maxRank - 1)) * plotHeight);
  const linePoints = history.points.map((point) => `${xFor(point.played)},${yFor(point.rank)}`).join(" ");
  const pointMarkup = history.points
    .map((point) => rankPointMarkup(point, xFor(point.played), yFor(point.rank), width, margin))
    .join("");
  const rankBands = [1, 2, 3, history.lastRank]
    .filter((rank, index, ranks) => rank <= maxRank && ranks.indexOf(rank) === index)
    .map((rank) => rankBandMarkup(rank, maxRank, margin.left, yFor(rank), plotWidth, plotHeight));
  const xTicks = history.points
    .filter((point, index, points) => index === 0 || index === points.length - 1 || point.played % 5 === 0)
    .map((point) => `<text class="rank-plot__tick" x="${xFor(point.played)}" y="${height - 38}" text-anchor="middle">${point.played}</text>`)
    .join("");
  const yTicks = [1, 2, 3, history.lastRank, maxRank]
    .filter((rank, index, ranks) => rank <= maxRank && ranks.indexOf(rank) === index)
    .map((rank) => `<text class="rank-plot__tick" x="${margin.left - 12}" y="${yFor(rank) + 4}" text-anchor="end">${rank}</text>`)
    .join("");

  return `
    <div class="rank-plot-card">
      <svg class="rank-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución de puestos de ${escapeHtml(participantLabel(selectedPlayer?.participant))}">
        <rect class="rank-plot__area" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="8"></rect>
        ${rankBands.join("")}
        <line class="rank-plot__axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}"></line>
        <line class="rank-plot__axis" x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}"></line>
        ${yTicks}
        ${xTicks}
        <text class="rank-plot__label" x="${margin.left}" y="16">Puesto</text>
        <text class="rank-plot__label" x="${width - margin.right}" y="${height - 10}" text-anchor="end">Partidos jugados</text>
        <polyline class="rank-plot__line" points="${linePoints}"></polyline>
        ${pointMarkup}
      </svg>
    </div>
  `;
}

function rankPointMarkup(point, x, y, width, margin) {
  const label = String(point.rank);
  const tooltipWidth = 34;
  const tooltipHeight = 28;
  const tooltipX = Math.max(margin.left + 4, Math.min(x - tooltipWidth / 2, width - margin.right - tooltipWidth - 4));
  const tooltipY = y - tooltipHeight - 14 < margin.top ? y + 14 : y - tooltipHeight - 14;
  const textY = tooltipY + 18;

  return `
    <g class="rank-plot__point-wrap" tabindex="0" role="button" aria-label="${escapeHtml(label)}">
      <circle class="rank-plot__point-hit" cx="${x}" cy="${y}" r="13"></circle>
      <circle class="rank-plot__point" cx="${x}" cy="${y}" r="4"></circle>
      <g class="rank-plot__tooltip">
        <rect x="${tooltipX}" y="${tooltipY}" width="${tooltipWidth}" height="${tooltipHeight}" rx="6"></rect>
        <text x="${tooltipX + tooltipWidth / 2}" y="${textY}" text-anchor="middle">${escapeHtml(label)}</text>
      </g>
    </g>
  `;
}

function rankBandMarkup(rank, maxRank, x, y, width, plotHeight) {
  const classes = { 1: "gold", 2: "silver", 3: "bronze" };
  const className = rank === maxRank ? "last" : classes[rank];
  if (!className) return "";
  const bandHeight = maxRank === 1 ? plotHeight : Math.max(12, plotHeight / maxRank);
  return `<rect class="rank-plot__band rank-plot__band--${className}" x="${x}" y="${y - bandHeight / 2}" width="${width}" height="${bandHeight}"></rect>`;
}

function attachRankPlotTooltipHandlers(panel) {
  const points = panel.querySelectorAll(".rank-plot__point-wrap");
  points.forEach((point) => {
    point.addEventListener("click", () => {
      const wasActive = point.classList.contains("rank-plot__point-wrap--active");
      points.forEach((item) => item.classList.remove("rank-plot__point-wrap--active"));
      if (!wasActive) point.classList.add("rank-plot__point-wrap--active");
    });
    point.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      point.click();
    });
  });
}

function setPlayerTab(tabName) {
  document.querySelectorAll("[data-player-tab]").forEach((button) => {
    const isActive = button.dataset.playerTab === tabName;
    button.classList.toggle("dialog-tab--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  document.getElementById("history-panel").hidden = tabName !== "history";
  document.getElementById("rank-history-panel").hidden = tabName !== "rankHistory";
}

function setMatchView(viewName) {
  selectedMatchView = viewName;
  document.querySelectorAll("[data-match-view]").forEach((button) => {
    const isActive = button.dataset.matchView === viewName;
    button.classList.toggle("match-tab--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  renderMatches(document.getElementById("match-list"));
}

function counterButtonMarkup(filterName, value) {
  const label = COUNTER_FILTERS[filterName];
  return `
    <button class="counter-button" type="button" data-counter-filter="${filterName}" aria-label="Ver ${escapeHtml(label)}">
      ${value}
    </button>
  `;
}

function matchMatchesCounterFilter(match, filterName) {
  if (filterName === "exact") return match.result === "exact";
  if (filterName === "correct") return match.result === "correct";
  if (filterName === "miss") return match.result === "miss";
  if (filterName === "goalDifference") return hasGoalDifference(match);
  return true;
}

function hasGoalDifference(match) {
  if (typeof match.goal_difference === "boolean") return match.goal_difference;
  return Number(match.predicted_home_score) - Number(match.predicted_away_score)
    === Number(match.actual_home_score) - Number(match.actual_away_score);
}

function openMatchDialog(match) {
  const dialog = document.getElementById("match-dialog");
  const title = document.getElementById("dialog-match-title");
  const list = document.getElementById("match-prediction-list");
  const tabs = document.getElementById("match-dialog-tabs");
  const simulatorPanel = document.getElementById("match-simulator-panel");
  const canSimulate = canSimulateMatch(match);
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
  tabs.hidden = true;
  simulatorPanel.hidden = true;
  list.hidden = false;
  setMatchDialogTab("predictions");

  list.innerHTML = predictions.length
    ? `${matchImpactMarkup(predictions)}${predictions.map((prediction) => `
      <article class="prediction-card prediction-card--${prediction.result}">
        <strong>${escapeHtml(participantLabel(prediction.participant))}</strong>
        <span>Pronóstico: ${prediction.predicted_home_score} - ${prediction.predicted_away_score}</span>
        <span>${resultLabel(prediction.result)}</span>
        <b>+${prediction.points}</b>
      </article>
    `).join("")}`
    : `<p class="table-message">Este partido todavía no tiene pronósticos puntuados.</p>`;

  if (match.status === "scheduled") {
    list.innerHTML = scheduledMatchPredictionsMarkup(match);
    if (canSimulate) {
      tabs.hidden = false;
      renderMatchSimulator(match);
    }
  }

  dialog.showModal();
}

function canSimulateMatch(match) {
  if (match.status !== "scheduled" || hasLiveMatch(matchRows)) return false;
  const nextMatch = nextScheduledMatch();
  return Boolean(nextMatch) && Number(nextMatch.match_id) === Number(match.match_id);
}

function nextScheduledMatch() {
  return matchRows
    .filter((match) => match.status === "scheduled")
    .sort((a, b) => matchSort("scheduled", a, b))[0];
}

function setMatchDialogTab(tabName) {
  document.querySelectorAll("[data-match-tab]").forEach((button) => {
    const isActive = button.dataset.matchTab === tabName;
    button.classList.toggle("dialog-tab--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  document.getElementById("match-prediction-list").hidden = tabName !== "predictions";
  document.getElementById("match-simulator-panel").hidden = tabName !== "simulator";
}

function renderMatchSimulator(match) {
  const panel = document.getElementById("match-simulator-panel");
  panel.innerHTML = `
    <div class="simulator-card">
      <div class="simulator-card__header">
        <span>${flagMarkup(flagForTeam(match.home_team), match.home_team)} ${escapeHtml(match.home_team)}</span>
        <div class="simulator-score">
          <input type="number" min="0" max="20" step="1" value="0" aria-label="Goles de ${escapeHtml(match.home_team)}" data-sim-home>
          <strong>-</strong>
          <input type="number" min="0" max="20" step="1" value="0" aria-label="Goles de ${escapeHtml(match.away_team)}" data-sim-away>
        </div>
        <span>${flagMarkup(flagForTeam(match.away_team), match.away_team)} ${escapeHtml(match.away_team)}</span>
      </div>
      <p>Simulación del partido</p>
    </div>
    <div class="simulator-table-wrap">
      <table class="simulator-table">
        <colgroup>
          <col class="sim-col-rank">
          <col class="sim-col-player">
          <col class="sim-col-points">
          <col class="sim-col-move">
        </colgroup>
        <thead>
          <tr>
            <th>Puesto</th>
            <th>Jugador</th>
            <th>Puntos</th>
            <th>Mov.</th>
          </tr>
        </thead>
        <tbody data-sim-results></tbody>
      </table>
    </div>
  `;

  const update = () => updateMatchSimulation(match, panel);
  panel.querySelectorAll("[data-sim-home], [data-sim-away]").forEach((input) => {
    input.addEventListener("input", update);
  });
  update();
}

function updateMatchSimulation(match, panel) {
  const homeScore = simulatorScoreValue(panel.querySelector("[data-sim-home]").value);
  const awayScore = simulatorScoreValue(panel.querySelector("[data-sim-away]").value);
  const tbody = panel.querySelector("[data-sim-results]");

  const simulatedMatches = matchRows.map((row) => Number(row.match_id) === Number(match.match_id)
    ? {
      ...row,
      status: "finished",
      home_score: homeScore,
      away_score: awayScore,
    }
    : row);
  const rows = scoreLeaderboard(predictionRows, simulatedMatches);

  tbody.innerHTML = rows.map((row, index) => {
    const rank = row.rank || index + 1;
    return `
      <tr class="${rowClass(rank, rows.length, row.is_last)}">
        <td><span class="rank-badge ${rankClass(rank)}">${rankLabel(rank)}</span></td>
        <td>${escapeHtml(participantLabel(row.participant))}</td>
        <td><strong>${row.points}</strong></td>
        <td><span class="movement ${movementClass(row.movement)}">${movementLabel(row.movement)}</span></td>
      </tr>
    `;
  }).join("");
}

function simulatorScoreValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(20, Math.floor(number));
}

function matchImpactMarkup(predictions) {
  const exact = predictions.filter((prediction) => prediction.result === "exact");
  const correct = predictions.filter((prediction) => prediction.result === "correct");
  const scoring = exact.length + correct.length;

  return `
    <section class="match-impact">
      <div>
        <span>Están sumando con este resultado</span>
        <strong>${scoring} jugador${scoring === 1 ? "" : "es"}</strong>
      </div>
      <div class="match-impact__groups">
        ${impactGroupMarkup("Marcador exacto", exact, "exact")}
        ${impactGroupMarkup("Ganador correcto", correct, "correct")}
      </div>
    </section>
  `;
}

function impactGroupMarkup(label, predictions, result) {
  return `
    <div class="match-impact__group match-impact__group--${result}">
      <span>${label}</span>
      <div>
        ${predictions.length
          ? predictions.map((prediction) => `<b>${escapeHtml(participantLabel(prediction.participant))}</b>`).join("")
          : "<em>Nadie</em>"}
      </div>
    </div>
  `;
}

function scheduledMatchPredictionsMarkup(match) {
  const predictions = predictionRows
    .filter((prediction) => Number(prediction.match_id) === Number(match.match_id))
    .sort((a, b) => participantLabel(a.participant).localeCompare(participantLabel(b.participant), "es"));

  if (!predictions.length) {
    return `<p class="table-message">Este partido todav&iacute;a no tiene pron&oacute;sticos.</p>`;
  }

  const groups = [
    {
      outcome: "H",
      title: teamHeading(match.home_team),
      predictions: predictions.filter((prediction) => predictionOutcome(prediction) === "H"),
    },
    {
      outcome: "A",
      title: teamHeading(match.away_team),
      predictions: predictions.filter((prediction) => predictionOutcome(prediction) === "A"),
    },
    {
      outcome: "D",
      title: "Empate",
      predictions: predictions.filter((prediction) => predictionOutcome(prediction) === "D"),
    },
  ];

  return groups.map((group) => predictionGroupMarkup(group)).join("");
}

function predictionGroupMarkup(group) {
  return `
    <section class="prediction-group prediction-group--${group.outcome.toLowerCase()}">
      <h3>${group.title}<span>${group.predictions.length}</span></h3>
      <div class="prediction-group__list">
        ${group.predictions.length
          ? group.predictions.map((prediction) => scheduledPredictionCard(prediction)).join("")
          : `<p class="table-message">Sin pron&oacute;sticos.</p>`}
      </div>
    </section>
  `;
}

function scheduledPredictionCard(prediction) {
  return `
    <article class="prediction-card prediction-card--scheduled">
      <strong>${escapeHtml(participantLabel(prediction.participant))}</strong>
      <span>Pron&oacute;stico: ${prediction.predicted_home_score} - ${prediction.predicted_away_score}</span>
    </article>
  `;
}

function predictionOutcome(prediction) {
  return outcome(Number(prediction.predicted_home_score), Number(prediction.predicted_away_score));
}

function teamHeading(team) {
  return `${flagMarkup(flagForTeam(team), team)} ${escapeHtml(team)}`;
}

function resultCard(match) {
  return `
    <article class="recent-card recent-card--${match.result}">
      <div class="recent-card__teams">
        <span>${flagMarkup(match.home_flag, match.home_team)} ${escapeHtml(match.home_team)}</span>
        <strong title="Pronóstico">${match.predicted_home_score} - ${match.predicted_away_score}</strong>
        <span>${flagMarkup(match.away_flag, match.away_team)} ${escapeHtml(match.away_team)}</span>
      </div>
      <div class="recent-card__meta">
        <span>Final: ${match.actual_home_score} - ${match.actual_away_score}</span>
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

function liveDebugLabel(match) {
  if (match.status !== "live") return "";
  const minute = liveMinuteFromElapsed(match.live_elapsed);
  if (minute) return `Min. ${minute}`;
  return "";
}

function liveDebugMarkup(match) {
  const label = liveDebugLabel(match);
  return label ? `<div class="match-card__debug">${escapeHtml(label)}</div>` : "";
}

function liveMinuteFromElapsed(value) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (!text || ["live", "in_play", "in play", "none", "null"].includes(normalized)) return "";
  const direct = text.match(/^(\d{1,3}(?:\s*\+\s*\d{1,2})?)$/);
  if (direct) return `${direct[1].replace(/\s+/g, "")}'`;
  const embedded = text.match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!embedded) return "";
  return `${embedded[1]}${embedded[2] ? `+${embedded[2]}` : ""}'`;
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
  return rank;
}

function rankClass(rank) {
  if (rank === 1) return "rank-badge--gold";
  if (rank === 2) return "rank-badge--silver";
  if (rank === 3) return "rank-badge--bronze";
  return "";
}

function rowClass(rank, rowCount, isLast = false) {
  const classes = [];
  if (rank <= 3) classes.push(`rank-${rank}`);
  if (rank === rowCount || isLast) classes.push("rank-last");
  return classes.join(" ");
}

function lastFiveMarkup(results) {
  if (!results.length) return `<span class="form-strip form-strip--empty">-</span>`;
  return `
    <span class="form-strip" aria-label="Últimas 5 predicciones">
      ${results.slice(0, 5).map((result) => `
        <span class="form-dot form-dot--${result.result}" title="${resultLabel(result.result)}">
          ${shortResultLabel(result.result)}
        </span>
      `).join("")}
    </span>
  `;
}

function shortResultLabel(result) {
  if (result === "exact") return "E";
  if (result === "correct") return "G";
  return "F";
}

function formatTimestamp(value) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function updateFreshnessDisplay(value) {
  const lastUpdated = document.getElementById("last-updated");
  const statusPill = document.getElementById("status-pill");
  if (!lastUpdated || !statusPill) return;

  lastUpdated.textContent = freshnessLabel(value);
  lastUpdated.title = formatTimestamp(value);

  if (hasLiveMatch(matchRows) && isStaleTimestamp(value)) {
    statusPill.textContent = "Datos con demora";
    statusPill.className = "status-pill status-pill--warning";
    return;
  }

  statusPill.textContent = "En vivo";
  statusPill.className = "status-pill status-pill--ok";
}

function freshnessLabel(value) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return "Actualizado ahora";
  if (seconds < 60) return `Actualizado hace ${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Actualizado hace ${minutes} min`;

  return formatTimestamp(value);
}

function isStaleTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > LIVE_STALE_WARNING_MS;
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

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    if (staticMatchRows.length) {
      refreshLiveMatches();
      startLiveRefreshLoop();
    }
    else loadPageData();
  } else if (staticMatchRows.length) {
    startLiveRefreshLoop();
  }
});
window.addEventListener("focus", () => {
  if (staticMatchRows.length) {
    refreshLiveMatches();
    startLiveRefreshLoop();
  }
  else loadPageData();
});

document.getElementById("dialog-close").addEventListener("click", () => {
  document.getElementById("player-dialog").close();
});
document.querySelectorAll("[data-player-tab]").forEach((button) => {
  button.addEventListener("click", () => setPlayerTab(button.dataset.playerTab));
});
document.querySelectorAll("[data-match-view]").forEach((button) => {
  button.addEventListener("click", () => setMatchView(button.dataset.matchView));
});
document.querySelectorAll("[data-match-tab]").forEach((button) => {
  button.addEventListener("click", () => setMatchDialogTab(button.dataset.matchTab));
});
document.getElementById("match-dialog-close").addEventListener("click", () => {
  document.getElementById("match-dialog").close();
});
