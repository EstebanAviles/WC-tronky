const API_URL = "https://worldcup26.ir/get/games";
const FOOTBALL_DATA_API_URL = "https://api.football-data.org/v4/competitions/WC/matches";
const CACHE_KEY = "scores";
const FOOTBALL_DATA_CACHE_KEY = "football-data-matches";
const MAX_CACHE_AGE_MS = 10 * 1000;
const FOOTBALL_DATA_BACKUP_CACHE_MS = 12 * 1000;
const ASSUMED_LIVE_WINDOW_MS = 165 * 60 * 1000;

const FOOTBALL_DATA_LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED"]);
const FOOTBALL_DATA_FINISHED_STATUSES = new Set(["FINISHED"]);

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

const TEAM_ALIASES = {
  "BOSNIA AND HERZEGOVINA": "BOSNIA",
  BOSNIA: "BOSNIA",
  "CAPE VERDE ISLANDS": "CAPE VERDE",
  "CAPE VERDE": "CAPE VERDE",
  CURACAO: "CURACAO",
  "CURAÇAO": "CURACAO",
  "CURA?AO": "CURACAO",
  CZECHIA: "CZECH REPUBLIC",
  "CZECH REPUBLIC": "CZECH REPUBLIC",
  "CONGO DR": "DR CONGO",
  "DR CONGO": "DR CONGO",
  "DEMOCRATIC REPUBLIC OF CONGO": "DR CONGO",
  "DEMOCRATIC REPUBLIC OF THE CONGO": "DR CONGO",
  "IR IRAN": "IRAN",
  "KOREA REPUBLIC": "SOUTH KOREA",
  "KOREA REPUBLIC OF": "SOUTH KOREA",
  TURKIYE: "TURKEY",
  USA: "UNITED STATES",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/scores") return json({ error: "Not found" }, 404);

    const cached = await readCache(env);
    const isFresh = cached && Date.now() - Date.parse(cached.updatedAt) < MAX_CACHE_AGE_MS;

    if (cached) {
      if (!isFresh) ctx.waitUntil(refreshScores(env));
      return json(cached.data, 200, cached.updatedAt);
    }

    const fresh = await refreshScores(env);
    return json(fresh.data, 200, fresh.updatedAt);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refreshScores(env));
  },
};

async function readCache(env) {
  return env.CACHE.get(CACHE_KEY, "json");
}

async function refreshScores(env) {
  const response = await fetch(`${API_URL}?t=${Date.now()}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const cached = await readCache(env);
    if (cached) return cached;
    throw new Error(`Source API failed: ${response.status}`);
  }

  const data = await response.json();
  const enhancedData = await applyFootballDataBackup(env, applyWorldcup26DerivedFields(data));
  const payload = {
    updatedAt: new Date().toISOString(),
    data: enhancedData,
  };
  await env.CACHE.put(CACHE_KEY, JSON.stringify(payload));
  return payload;
}

async function applyFootballDataBackup(env, data) {
  if (!env.FOOTBALL_DATA_TOKEN) return data;

  const games = Array.isArray(data) ? data : data.games || [];
  const suspiciousGames = games.filter((game) => isSuspiciousNotStartedGame(game) || needsFootballDataWinner(game));
  if (!suspiciousGames.length) return data;

  const footballDataMatches = await readFootballDataMatches(env);
  if (!footballDataMatches.length) return data;

  const enhancedGames = games.map((game) => {
    if (!suspiciousGames.includes(game)) return game;
    const backup = footballDataMatches.find((match) => isSameFootballDataMatch(game, match));
    return backup ? mergeFootballDataMatch(game, backup) : game;
  });

  return Array.isArray(data) ? enhancedGames : { ...data, games: enhancedGames };
}

function applyWorldcup26DerivedFields(data) {
  const games = Array.isArray(data) ? data : data.games || [];
  const enhancedGames = games.map((game) => {
    const winner = worldcup26PenaltyWinner(game);
    return winner ? { ...game, winner_team: winner } : game;
  });
  return Array.isArray(data) ? enhancedGames : { ...data, games: enhancedGames };
}

async function readFootballDataMatches(env) {
  const cached = await env.CACHE.get(FOOTBALL_DATA_CACHE_KEY, "json");
  if (cached && Date.now() - Date.parse(cached.updatedAt) < FOOTBALL_DATA_BACKUP_CACHE_MS) {
    return cached.matches || [];
  }

  try {
    const url = new URL(FOOTBALL_DATA_API_URL);
    url.searchParams.set("season", env.FOOTBALL_DATA_SEASON || "2026");
    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
      },
    });
    if (!response.ok) return cached?.matches || [];

    const payload = await response.json();
    const matches = payload.matches || [];
    await env.CACHE.put(FOOTBALL_DATA_CACHE_KEY, JSON.stringify({
      updatedAt: new Date().toISOString(),
      matches,
    }));
    return matches;
  } catch (_error) {
    return cached?.matches || [];
  }
}

function isSuspiciousNotStartedGame(game) {
  if (String(game.finished || "").toUpperCase() === "TRUE") return false;
  const elapsed = String(game.time_elapsed || "").toLowerCase();
  const isNotStarted = !elapsed || ["notstarted", "not started", "0", "none", "null"].includes(elapsed);
  return isNotStarted && isWithinAssumedLiveWindow(game);
}

function needsFootballDataWinner(game) {
  if (game.winner_team) return false;
  if (worldcup26PenaltyWinner(game)) return false;
  if (!isKnockoutGame(game)) return false;
  const status = footballDataStatusFromWorldcup26(game);
  if (status !== "finished") return false;
  const homeScore = numberOrNull(game.home_score);
  const awayScore = numberOrNull(game.away_score);
  return homeScore !== null && awayScore !== null && homeScore === awayScore;
}

function isKnockoutGame(game) {
  return String(game.type || "").toLowerCase() !== "group";
}

function footballDataStatusFromWorldcup26(game) {
  if (String(game.finished || "").toUpperCase() === "TRUE") return "finished";
  const elapsed = String(game.time_elapsed || "").toLowerCase();
  if (elapsed && !["notstarted", "not started", "0", "none", "null"].includes(elapsed)) return "live";
  return "scheduled";
}

function isWithinAssumedLiveWindow(game) {
  const kickoff = parseWorldCupDate(game.local_date || "", timeZoneForGame(game));
  if (Number.isNaN(kickoff)) return false;
  const elapsedMs = Date.now() - kickoff;
  return elapsedMs >= 0 && elapsedMs <= ASSUMED_LIVE_WINDOW_MS;
}

function isSameFootballDataMatch(game, match) {
  const home = normalizeTeam(match.homeTeam?.name || match.homeTeam?.shortName || match.homeTeam?.tla || "");
  const away = normalizeTeam(match.awayTeam?.name || match.awayTeam?.shortName || match.awayTeam?.tla || "");
  return normalizeTeam(game.home_team_name_en || "") === home
    && normalizeTeam(game.away_team_name_en || "") === away;
}

function mergeFootballDataMatch(game, match) {
  const status = footballDataStatus(match.status);
  const score = currentFootballDataScore(match);
  if (status === "scheduled" || score.home === null || score.away === null) return game;
  const penaltyWinner = worldcup26PenaltyWinner(game);

  return {
    ...game,
    home_score: penaltyWinner ? game.home_score : String(score.home),
    away_score: penaltyWinner ? game.away_score : String(score.away),
    finished: status === "finished" ? "TRUE" : "FALSE",
    time_elapsed: status === "finished" ? "finished" : "live",
    tronky_source: "football-data-backup",
    football_data_match_id: match.id,
    football_data_status: match.status,
    winner_team: penaltyWinner || footballDataWinner(match, game),
  };
}

function footballDataStatus(status) {
  if (FOOTBALL_DATA_FINISHED_STATUSES.has(status)) return "finished";
  if (FOOTBALL_DATA_LIVE_STATUSES.has(status)) return "live";
  return "scheduled";
}

function currentFootballDataScore(match) {
  const fullTime = match.score?.fullTime || {};
  const regularTime = match.score?.regularTime || {};
  const halfTime = match.score?.halfTime || {};
  return {
    home: numberOrNull(fullTime.home ?? regularTime.home ?? halfTime.home),
    away: numberOrNull(fullTime.away ?? regularTime.away ?? halfTime.away),
  };
}

function footballDataWinner(match, game) {
  const winner = match.score?.winner;
  if (winner === "HOME_TEAM") return game.home_team_name_en || "";
  if (winner === "AWAY_TEAM") return game.away_team_name_en || "";
  return "";
}

function worldcup26PenaltyWinner(game) {
  const homePenalty = numberOrNull(game.home_penalty_score);
  const awayPenalty = numberOrNull(game.away_penalty_score);
  if (homePenalty === null || awayPenalty === null || homePenalty === awayPenalty) return "";
  return homePenalty > awayPenalty ? game.home_team_name_en || "" : game.away_team_name_en || "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function normalizeTeam(value) {
  const text = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replaceAll(".", "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replaceAll("&", " AND ")
    .replace(/\s+/g, " ")
    .trim();
  return TEAM_ALIASES[text] || text;
}

function timeZoneForGame(game) {
  return MATCH_TIME_ZONES[Number(game.id)] || "America/Lima";
}

function parseWorldCupDate(value, timeZone) {
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

function json(body, status = 200, updatedAt = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "x-tronky-cache-updated-at": updatedAt,
    },
  });
}
