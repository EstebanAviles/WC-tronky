# La Polla Tronky

Scoreboard estatico para una polla amistosa del Mundial. La pagina publica vive en `docs/`, se puede servir con GitHub Pages o Cloudflare Pages, y recalcula la tabla en el navegador usando los pronosticos publicos y los marcadores actuales.

## Estado Actual

La app muestra:

- Tabla en vivo con puntos, marcadores exactos (`E`), diferencias de gol (`DG`), ganadores correctos (`G`), fallos (`F`) y partidos jugados (`PJ`).
- Puestos compartidos cuando dos o mas jugadores empatan en todos los criterios de desempate.
- Resumen del lider, indicando ventaja por puntos o por criterio de desempate.
- Banner con partido en vivo cuando existe.
- Pestañas de partidos: `Proximos partidos` y `Resultados recientes`.
- Modal por jugador con historial de pronosticos y evolucion historica de puestos.
- Modal por partido con quienes estan sumando con el marcador actual.
- Actualizacion live desde Cloudflare Worker cuando el endpoint esta disponible.

## Arquitectura

```text
data/
  predictions.csv          # pronosticos normalizados
  raw/                     # Excels locales, no se deben commitear
docs/
  index.html               # sitio estatico
  styles.css
  app.js
  assets/
  data/
    leaderboard.json       # tabla publica generada
    match_scores.json      # marcadores actuales/base
    predictions.json       # pronosticos publicos
scripts/
  import_predictions.py    # Excel -> data/predictions.csv
  fetch_results.py         # API -> docs/data/match_scores.json
  score_predictions.py     # CSV + marcadores -> JSON publico
cloudflare-worker.js       # cache live para /scores
```

## Flujo de Datos

1. Cada jugador tiene un Excel en `data/raw/`.
2. El script `scripts/import_predictions.py` lee la hoja `PRONÓSTICOS` y genera `data/predictions.csv`.
3. `scripts/fetch_results.py` actualiza `docs/data/match_scores.json`.
4. `scripts/score_predictions.py` genera:
   - `docs/data/predictions.json`
   - `docs/data/leaderboard.json`
5. El frontend carga esos JSON y, si el Worker responde, usa `/scores` para recalcular la tabla con marcadores live.

## Reglas de Puntaje

- Marcador exacto: `+6`
- Ganador correcto: `+3`
- Fallo: `+0`

Criterios de desempate:

1. Puntos
2. Marcadores exactos
3. Diferencias de gol acertadas
4. Ganadores correctos

Si dos jugadores empatan en todos esos criterios, comparten puesto. El ranking usa formato competitivo: por ejemplo `9, 9, 11`.

## Comandos Locales

Crear o actualizar el ambiente:

```bat
conda env update -f environment.yml --prune
```

Importar Excels locales:

```bat
conda run -n worldcup-tronky python scripts\import_predictions.py
```

Actualizar marcadores:

```bat
conda run -n worldcup-tronky python scripts\fetch_results.py
```

Regenerar JSON publicos:

```bat
conda run -n worldcup-tronky python scripts\score_predictions.py
```

Servir la pagina localmente:

```bat
conda run -n worldcup-tronky python -m http.server 8000 --directory docs
```

Luego abrir:

```text
http://localhost:8000
```

## GitHub Actions

El workflow `.github/workflows/update-scoreboard.yml` corre cada 5 minutos y tambien puede ejecutarse manualmente desde GitHub:

1. Entrar al repositorio.
2. Abrir `Actions`.
3. Seleccionar `Update scoreboard`.
4. Hacer click en `Run workflow`.
5. Opcionalmente escribir un motivo, por ejemplo `Match ended`.
6. Confirmar con el boton verde `Run workflow`.

El workflow ejecuta:

```bash
python scripts/fetch_results.py
python scripts/score_predictions.py
```

Luego commitea cambios en `docs/data/*.json` si existen.

## APIs y Secretos

Fuente principal gratuita:

```text
https://worldcup26.ir/get/games
```

El workflow usa por defecto:

```text
FOOTBALL_DATA_SOURCE=worldcup26
WORLDCUP26_API_URL=https://worldcup26.ir/get/games
```

Backup opcional con API-Football:

- Secret: `FOOTBALL_API_KEY`
- Variable: `FOOTBALL_API_LEAGUE_ID`
- Variable opcional: `FOOTBALL_API_SEASON`, por defecto `2026`

Backup opcional con football-data.org:

- GitHub Actions secret: `FOOTBALL_DATA_TOKEN`
- Cloudflare Worker secret: `FOOTBALL_DATA_TOKEN`
- Variable opcional: `FOOTBALL_DATA_SEASON`, por defecto `2026`

Nunca colocar API keys en `docs/app.js` ni en ningun archivo publico.

## Cloudflare Worker Live

El frontend consulta:

```text
https://worldcup-tronky-live.eavileslino.workers.dev/scores
```

El codigo versionado esta en:

```text
cloudflare-worker.js
```

Configuracion esperada en Cloudflare:

- Ruta publica: `/scores`
- KV binding: `CACHE`
- Secret opcional: `FOOTBALL_DATA_TOKEN`
- Cron Trigger recomendado:

```cron
* * * * *
```

El Worker cachea el marcador por pocos segundos para que el primer usuario no tenga que esperar tanto a la API externa. Si la API principal no marca como live un partido que ya empezo, el Worker puede usar football-data.org como backup, limitado a una llamada cada 12 segundos como maximo.

## Deploy

La pagina es estatica. Cualquier plataforma que sirva `docs/` funciona:

- GitHub Pages
- Cloudflare Pages

Despues de hacer cambios de codigo:

```bat
git add docs README.md scripts cloudflare-worker.js .github
git commit -m "Describe change"
git push
```

Si Cloudflare Pages esta conectado al repositorio, el deploy deberia dispararse automaticamente con cada push a `main`.

## Notas Importantes

- `data/raw/` contiene archivos Excel locales y no debe commitearse.
- `data/predictions.csv` es el insumo limpio para generar los JSON publicos.
- `docs/data/*.json` si son publicos y se usan por la pagina.
- La pagina puede recalcular puntos con marcadores live como si el partido terminara con el resultado actual.
- Los nombres visibles pueden mapearse a nicknames en `docs/app.js`.
