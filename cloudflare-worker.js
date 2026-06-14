const API_URL = "https://worldcup26.ir/get/games";
const CACHE_KEY = "scores";
const MAX_CACHE_AGE_MS = 10 * 1000;

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
  const payload = {
    updatedAt: new Date().toISOString(),
    data,
  };
  await env.CACHE.put(CACHE_KEY, JSON.stringify(payload));
  return payload;
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
