# STATUS — 2026-08-03

## Estado general
Motor multi-película completo (Portra 400/160, Ektar 100, Fuji Pro 400H, Gold 200) con grano/halation/carácter de color propios por emulsión, y ahora además **una 6ª categoría**: el usuario puede crear películas nuevas desde dentro de la app subiendo una foto de referencia — Claude (vision) analiza la foto y propone un perfil completo, honestamente etiquetado como emulación (no una digitalización real). Proyecto en GitHub (`javiersuarezginer/nw-film`), despliegue automático en Vercel confirmado tras varios pushes de esta sesión (`bd57e77` → `75d149a` → `f51326d` → `755d00c` → `4fa0d84`).

Sesión con tres bloques de trabajo: (1) el usuario reportó que las 5 películas se sentían "iguales con distinta temperatura" comparándolas con una cuadrícula real externa — se recalibró grano/halation/color por película a partir de 5 fotos de referencia reales que aportó; (2) rediseño de la cuadrícula de comparación (imágenes a ratio real, sin cards ni barras negras); (3) función grande nueva: creación de películas por IA, con backend propio (primera pieza de servidor de todo el proyecto).

## Último trabajo realizado
- **Grano/halation/color por película**: cada película tiene ahora `FilmGrainCharacter` (tamaño/intensidad) y `halationMultiplier` propios, además del `FilmColorCharacter` ya existente (amplificado, sobre todo Fuji Pro 400H). Calibrado con 5 fotos de referencia reales del usuario (`docs/reference/{Portra160,Portra400,Ektar100,Gold200,Fujicolor400h}.*`) — el intento de medir grano por FFT no funcionó (fotos de internet, no escaneo controlado) y se descartó honestamente; comparar parches de color sí dio señal fiable y confirmó/amplificó varios valores. Ver `decisions.md`.
- **Cuadrícula de películas rediseñada**: imágenes a su ratio real (antes forzaban `aspect-ratio: 3/2` con barras negras), sin "cards" con borde/fondo, gutter pequeño entre columnas, nombre debajo con espacio antes de la siguiente fila.
- **Creación de películas por IA** (función grande, pedida explícitamente por el usuario): botón "Crear película desde foto…" → el usuario sube una referencia → `api/analyze-film.ts` (único endpoint de servidor del proyecto, API key de Anthropic solo ahí) llama a Claude (`claude-sonnet-5`, tool-use forzado) → perfil nuevo (curva de 7 puntos + carácter de color/grano/halation) validado en dos niveles (`customFilm.ts`: rechazo estructural + clamping semántico) → se añade al desplegable y se persiste en `localStorage` (primera persistencia de todo el proyecto). Siempre `isCustom: true`, nunca al mismo nivel que las 5 reales — la IA es honesta al respecto en su propia nota de análisis, que se muestra al usuario. Eliminar/exportar/importar película, mismo patrón que los presets.
- Dos bugs reales encontrados y corregidos en esta misma sesión, verificando en producción: (1) el endpoint usaba la firma Web moderna `(req: Request) => Response` en vez de la clásica de Node `(req, res)` que este proyecto en Vercel espera — los `return` se ignoraban en silencio hasta el timeout de 60s; (2) la nota/botones de película custom no aparecían si el usuario creaba la película antes de cargar ninguna foto principal (dependía de `AppState`, inexistente hasta la primera carga).
- Verificado en producción real (no solo local): con una imagen sintética, Claude devolvió una curva coherente y una nota de análisis honesta ("emulación estilizada... no una medición de película real"). Ciclo completo probado: crear → aparece → persiste tras recargar → eliminar, dejando `localStorage` limpio.

## Próxima acción
1. El usuario puede empezar a crear películas reales con fotos suyas y evaluar si la calidad de lo que propone Claude es buena — el prompt y los rangos de clamping en `customFilm.ts` son el primer sitio a ajustar si no.
2. **Polaroid** (pendiente desde antes, sin datasheet real disponible).
3. Decidir el enfoque para el banding a 16 bits (dithering vs. mayor profundidad de salida).
4. Cuando el usuario quiera retomarlo: diagnosticar el renderizador de grano riguroso (roto, sin UI desde hace unas sesiones).
5. Documentado en `CLAUDE.md` (Capa de IA, 4º uso permitido) — pendiente decidir si el uso 4 (creación de películas) merece su propia fase separada en "Fases de desarrollo", ya que se adelantó fuera del orden original.

## Blockers
Ninguno. La API key de Anthropic ya está configurada en Vercel (Preview + Production) por el usuario.

## Para revisar
- El grano riguroso sigue sin UI (código intacto en `rigorousRender.ts`/`.worker.ts`, sin punto de entrada).
- Grano/halation/color por película son aproximación por consenso fotográfico + las 5 fotos de referencia — no mediciones de datasheet (documentado así en `registry.ts`).
- Las películas creadas por IA no tienen datos de sensitómetro reales detrás por diseño — son una emulación estilizada de la foto de referencia concreta, documentado honestamente en `source.chart` y en la propia `analysisNote` que genera Claude.
- `api/analyze-film.ts` no tiene tests automatizados de la llamada real a Anthropic (no es practicable sin gastar cuota en CI) — sí están testeadas las funciones puras de validación/clamping (`customFilm.test.ts`) con casos que simulan respuestas de IA buenas y corruptas.
- El límite de 60s (`maxDuration`) en el endpoint es una estimación — si Claude tarda más en fotos complejas, ajustar ahí primero.
- Vercel CLI quedó autenticado y el proyecto enlazado (`vercel link`) en el entorno de desarrollo usado en esta sesión — útil para depurar logs de producción (`vercel logs <url>`) sin tocar la API key real (que este entorno redacta deliberadamente).
- El slider de halation solo controla la intensidad, no su radio/tamaño.
- Banding en sombras/negros a 8 bits — pendiente decidir dithering vs. mayor profundidad de salida.
