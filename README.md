# La Polla Tronky

Scoreboard estático y archivado de una polla amistosa del Mundial. La página pública vive en `docs/`, se puede servir con GitHub Pages o Cloudflare Pages y usa exclusivamente los resultados finales versionados en el repositorio.

## Estado Actual

La app muestra:

- Tabla final con puntos, marcadores exactos (`E`), diferencias de gol (`DG`), ganadores correctos (`G`), fallos (`F`) y partidos jugados (`PJ`).
- Puestos compartidos cuando dos o más jugadores empatan en todos los criterios de desempate.
- Resumen del ganador y del criterio final de desempate.
- Resultados recientes y distribución de pronósticos de campeón.
- Modal por jugador con historial de pronósticos y evolución histórica de puestos.
- Modal por partido con el puntaje obtenido por cada participante.

La página no consulta APIs externas, no ejecuta refrescos periódicos y no modifica los puntajes finales.

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
    match_scores.json      # resultados finales congelados
    predictions.json       # pronosticos publicos
scripts/
  import_predictions.py    # Excel -> data/predictions.csv
  fetch_results.py         # API -> docs/data/match_scores.json
  score_predictions.py     # CSV + marcadores -> JSON publico
cloudflare-worker.js       # implementación live histórica, ya no usada por el sitio
```

## Datos Finales

Los archivos de `docs/data/` conservan el cierre del torneo. `match_scores.json` contiene los 104 partidos finalizados y `leaderboard.json` contiene la clasificación final. El frontend solo carga estos archivos estáticos.

Los scripts de `scripts/` se mantienen como herramientas históricas y de recuperación. No se ejecutan automáticamente.

## Reglas de Puntaje

- Marcador exacto: `+6`
- Ganador correcto: `+3`
- Fallo: `+0`
- Campeón acertado: `+15`.

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

Las siguientes herramientas solo son necesarias para reconstruir los archivos finales de forma manual.

Importar Excels locales:

```bat
conda run -n worldcup-tronky python scripts\import_predictions.py
```

Volver a consultar marcadores externos, solo para recuperación excepcional:

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

El workflow `.github/workflows/update-scoreboard.yml` ya no tiene un cron. Solo puede ejecutarse manualmente para reconstruir los JSON a partir de los resultados finales que ya están versionados:

1. Entrar al repositorio.
2. Abrir `Actions`.
3. Seleccionar `Rebuild frozen scoreboard`.
4. Hacer click en `Run workflow`.
5. Opcionalmente escribir el motivo de la reconstrucción.
6. Confirmar con el boton verde `Run workflow`.

El workflow ejecuta:

```bash
python scripts/score_predictions.py
```

Luego commitea cambios en `docs/data/*.json` si existen.

## Servicios Live Retirados

El frontend ya no consulta el Cloudflare Worker ni ninguna API de resultados. `cloudflare-worker.js` se conserva únicamente como referencia histórica.

Si el Worker sigue desplegado en Cloudflare, desactivar su Cron Trigger para evitar consultas externas innecesarias. Este cambio se realiza en la configuración del Worker y no desde GitHub Pages.

## Deploy

La pagina es estatica. Cualquier plataforma que sirva `docs/` funciona:

- GitHub Pages
- Cloudflare Pages

Despues de hacer cambios de codigo:

```bat
git add docs README.md .github
git commit -m "Describe change"
git push
```

Si Cloudflare Pages esta conectado al repositorio, el deploy deberia dispararse automaticamente con cada push a `main`.

## Notas Importantes

- `data/raw/` contiene archivos Excel locales y no debe commitearse.
- `data/predictions.csv` es el insumo limpio para generar los JSON publicos.
- `docs/data/*.json` sí son públicos y contienen el cierre definitivo usado por la página.
- El sitio no consulta servicios live ni vuelve a cargar los datos cuando la pestaña recupera el foco.
- Los nombres visibles pueden mapearse a nicknames en `docs/app.js`.
