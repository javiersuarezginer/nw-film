/**
 * Único endpoint de servidor de todo el proyecto (que hasta esta feature
 * era 100% estático/cliente — ver docs/README.md). Recibe una foto de
 * referencia y pide a Claude que proponga un perfil de película nueva
 * (curva característica + carácter de color/grano/halation) en el mismo
 * formato que usan las 5 películas reales de `src/color-science/films/registry.ts`.
 *
 * La API key vive SOLO aquí (variable de entorno `ANTHROPIC_API_KEY`,
 * configurada en Vercel — ver .env.example), nunca llega al cliente.
 *
 * Importante: esto NO es una digitalización de datasheet real — es una
 * emulación estilizada de UNA foto, sin datos de sensitómetro detrás (ver
 * CLAUDE.md, sección "Capa de IA", y `customFilm.ts`). El prompt le pide
 * a Claude que sea honesto sobre esto en su propia `analysisNote`.
 *
 * Los límites numéricos (nº de puntos, rangos de densidad/carácter) NO se
 * pueden forzar de verdad en un tool schema hecho a mano (Anthropic no
 * valida minimum/maximum/minItems ahí) — van en la descripción del schema
 * y el prompt, y se EXIGEN de verdad en `validateAndClampFilmRecord`
 * (src/color-science/films/customFilm.ts), tanto aquí como en el cliente.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANTHROPIC_VERSION = "2023-06-01";
const MODEL_ID = "claude-sonnet-5";
const MAX_TOKENS = 4096;
/** Defensivo — el cliente ya redimensiona a ≤1024px antes de subir. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const config = {
  maxDuration: 60,
};

interface AnalyzeFilmRequestBody {
  imageBase64?: unknown;
  mediaType?: unknown;
  suggestedLabel?: unknown;
  referenceStats?: unknown;
}

interface ZoneColorStats {
  r: number;
  g: number;
  b: number;
  pixelFraction: number;
}

interface ReferenceImageStats {
  shadows: ZoneColorStats;
  midtones: ZoneColorStats;
  highlights: ZoneColorStats;
  lumaP5: number;
  lumaP95: number;
}

/**
 * `referenceStats` lo calcula el cliente con Canvas (getImageData) sobre
 * la misma foto que se sube — RGB medio real en sombras/medios/luces por
 * umbral de luminancia, más contraste aproximado (percentil 5/95). Sirve
 * para que la IA base `colorCharacter` en una medición real en vez de
 * adivinarla solo mirando la imagen (ver decisions.md, sesión de
 * "análisis superficial"). Si el cliente no lo manda o llega corrupto, se
 * degrada con gracia — se sigue llamando a la IA, solo que sin esta
 * sección del prompt (peor calibrado, no un fallo duro).
 */
function parseZoneStats(raw: unknown): ZoneColorStats | null {
  if (!isRecord(raw)) return null;
  const { r, g, b, pixelFraction } = raw;
  if (![r, g, b, pixelFraction].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  return { r: r as number, g: g as number, b: b as number, pixelFraction: pixelFraction as number };
}

function parseReferenceStats(raw: unknown): ReferenceImageStats | null {
  if (!isRecord(raw)) return null;
  const shadows = parseZoneStats(raw.shadows);
  const midtones = parseZoneStats(raw.midtones);
  const highlights = parseZoneStats(raw.highlights);
  const { lumaP5, lumaP95 } = raw;
  if (!shadows || !midtones || !highlights) return null;
  if (typeof lumaP5 !== "number" || typeof lumaP95 !== "number" || !Number.isFinite(lumaP5) || !Number.isFinite(lumaP95)) {
    return null;
  }
  return { shadows, midtones, highlights, lumaP5, lumaP95 };
}

function formatZone(label: string, zone: ZoneColorStats): string {
  const pct = (zone.pixelFraction * 100).toFixed(0);
  return `- ${label} (${pct}% de los píxeles): RGB medio ≈ (${zone.r.toFixed(0)}, ${zone.g.toFixed(0)}, ${zone.b.toFixed(0)})${
    zone.pixelFraction < 0.03 ? " — pocos píxeles, medición poco fiable, pondérala menos" : ""
  }`;
}

function buildMeasurementsSection(stats: ReferenceImageStats | null): string {
  if (!stats) {
    return "No hay mediciones reales de píxeles disponibles para esta foto — basa colorCharacter en tu propia inspección visual, con cautela.";
  }
  return `Mediciones REALES de esta foto (calculadas por código, no por ti) — básate en estos números para colorCharacter, no lo adivines solo mirando:
${formatZone("Sombras", stats.shadows)}
${formatZone("Medios tonos", stats.midtones)}
${formatZone("Luces", stats.highlights)}
- Contraste real de la escena: percentil 5 de luminancia ≈ ${stats.lumaP5}/255, percentil 95 ≈ ${stats.lumaP95}/255.

Cómo usarlas: compara cada zona frente a un gris neutro (R=G=B). Si en sombras R > G, hay sesgo cálido → shadowWarmth positivo; si R < G, sesgo frío → negativo. Si G domina sobre el promedio de (R+B)/2, hay sesgo verde → shadowTint negativo (convención de este proyecto); si R y B dominan sobre G, sesgo magenta → positivo. Mismo razonamiento para highlightWarmth/highlightTint con los datos de luces. LA MAGNITUD debe ser proporcional a cuánto se desvía la medición de un gris neutro — no inventes una magnitud que no se corresponda con estos números. Un percentil 5-95 de luminancia muy amplio indica una escena de alto contraste real (curva con más pendiente en la zona lineal); un rango estrecho indica poco contraste real (curva más suave).`;
}

const PROPOSE_FILM_TOOL = {
  name: "propose_film",
  description:
    "Propón un perfil de emulación de película fotográfica a partir de la foto de referencia, en el mismo formato/unidades que los perfiles reales de este proyecto.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "analysisNote", "curvePoints", "colorCharacter", "grainCharacter", "halationMultiplier"],
    properties: {
      label: {
        type: "string",
        description: "Nombre corto y evocador en español, 2-4 palabras (p.ej. 'Ámbar de Tarde'). Si el usuario ya sugirió uno, úsalo tal cual.",
      },
      analysisNote: {
        type: "string",
        description:
          "1-2 frases HONESTAS en español describiendo lo que ves: contraste tonal, carácter de color por zona, grano, halation. Deja claro que es una emulación estilizada de esta foto, no una película real digitalizada — se muestra tal cual al usuario.",
      },
      curvePoints: {
        type: "array",
        description:
          "EXACTAMENTE 7 puntos {logE, r, g, b}, con logE estrictamente creciente, abarcando aproximadamente de -3.4 a 0.6 a 0.9 (mismo rango numérico que las películas reales de este proyecto). La densidad (r, g, b) debe ser no decreciente al aumentar logE en cada canal, en un rango aproximado de 0.2 a 3.2, y en cada punto b >= g >= r (como en un negativo color real).",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["logE", "r", "g", "b"],
          properties: {
            logE: { type: "number" },
            r: { type: "number" },
            g: { type: "number" },
            b: { type: "number" },
          },
        },
      },
      colorCharacter: {
        type: "object",
        additionalProperties: false,
        required: ["shadowWarmth", "shadowTint", "highlightWarmth", "highlightTint", "saturationBias", "vibranceBias"],
        properties: {
          shadowWarmth: { type: "number", description: "-100..100, sesgo cálido(+)/frío(-) en sombras" },
          shadowTint: { type: "number", description: "-100..100, sesgo magenta(+)/verde(-) en sombras" },
          highlightWarmth: { type: "number", description: "-100..100, sesgo cálido/frío en luces" },
          highlightTint: { type: "number", description: "-100..100, sesgo magenta/verde en luces" },
          saturationBias: { type: "number", description: "-100..100" },
          vibranceBias: { type: "number", description: "-100..100" },
        },
      },
      grainCharacter: {
        type: "object",
        additionalProperties: false,
        required: ["sizeMultiplier", "intensityMultiplier"],
        properties: {
          sizeMultiplier: { type: "number", description: "relativo a Portra 400 = 1.0, rango típico 0.4-1.5" },
          intensityMultiplier: { type: "number", description: "relativo a Portra 400 = 1.0, rango típico 0.4-1.5" },
        },
      },
      halationMultiplier: {
        type: "number",
        description: "relativo a Portra 400 = 1.0, rango típico 0.6-1.3",
      },
    },
  },
};

function buildPrompt(suggestedLabel: string, stats: ReferenceImageStats | null): string {
  return `Eres un analista de emulación de película fotográfica para NW-FILM, un simulador de fotografía analógica cuyo motor de revelado es 100% físico y determinista (curva característica + halation + grano + papel). Tu trabajo NO es generar una imagen ni tocar el pipeline de render — es proponer, UNA SOLA VEZ, los parámetros de una "película" nueva a partir de esta foto de referencia, para que el motor determinista la renderice después con cualquier otra foto.

IMPORTANTE — esto no es una digitalización de datasheet real. Las 5 películas reales del proyecto (Kodak Portra 400/160, Ektar 100, Fuji Pro 400H, Gold 200) se calibraron con curvas digitalizadas de datasheets oficiales de Kodak/Fuji. Esta foto de referencia es una imagen ya revelada/escaneada, sin datos de sensitómetro detrás — así que tu curva es una EMULACIÓN ESTILIZADA de esta foto en concreto, no una medición real. Sé honesto sobre esto en tu "analysisNote".

${buildMeasurementsSection(stats)}

Rango numérico de referencia (para que tu curva sea físicamente plausible dentro del motor ya existente):
- Kodak Portra 400: logE de -3.41 a 0.56, densidad r 0.22-2.01 / g 0.64-2.46 / b 0.86-3.05 (orden b>g>r siempre).
- Kodak Gold 200: logE de -2.97 a 0.86.

Dos ejemplos reales del registro de películas de este proyecto, con su razonamiento (mismo formato que debes usar tú para colorCharacter/grainCharacter/halationMultiplier):

1. Kodak Ektar 100 — Kodak la vende como la más saturada y contrastada de su catálogo. Rojos/naranjas cálidos y punchy en luces; sombras algo más frías por contraste.
   colorCharacter: { shadowWarmth: -10, shadowTint: 0, highlightWarmth: 14, highlightTint: 0, saturationBias: 32, vibranceBias: 20 }
   grainCharacter: { sizeMultiplier: 0.55, intensityMultiplier: 0.6 } (grano muy fino, "the world's finest grain")
   halationMultiplier: 0.85

2. Fujicolor Pro 400H — verdes pastel en sombras/medios tonos, reproducción más fría y desaturada que las Kodak.
   colorCharacter: { shadowWarmth: -9, shadowTint: -28, highlightWarmth: -11, highlightTint: -8, saturationBias: -26, vibranceBias: -14 }
   grainCharacter: { sizeMultiplier: 1.05, intensityMultiplier: 1.1 }
   halationMultiplier: 0.8

Para colorCharacter usa las mediciones reales de arriba, no tu impresión visual. Para el resto sí usa la vista: contraste tonal general (curva suave o dura, hombro en luces — apóyate también en el percentil 5/95 de arriba), grano aparente (fino/grueso, visible/discreto) y halation aparente (bloom cálido en altas luces quemadas, si se aprecia).

${suggestedLabel ? `El usuario sugiere el nombre "${suggestedLabel}" — úsalo tal cual como label.` : "Inventa un nombre corto y evocador en español (2-4 palabras)."}

Usa la herramienta "propose_film" para responder — exactamente 7 puntos de curva, todo en español.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Servidor sin API key configurada (ANTHROPIC_API_KEY)." });
    return;
  }

  // Vercel ya parsea el body como JSON cuando content-type es application/json.
  const body: AnalyzeFilmRequestBody = isRecord(req.body) ? req.body : {};
  const { imageBase64, mediaType, suggestedLabel, referenceStats } = body;
  const stats = parseReferenceStats(referenceStats);

  if (typeof mediaType !== "string" || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
    res.status(400).json({ error: "Tipo de imagen no soportado (usa JPEG, PNG o WebP)." });
    return;
  }
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    res.status(400).json({ error: "Falta la imagen." });
    return;
  }
  // Tamaño decodificado aproximado (base64 ocupa ~4/3 del tamaño real).
  if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: "La imagen es demasiado grande." });
    return;
  }

  const label = typeof suggestedLabel === "string" ? suggestedLabel.slice(0, 60) : "";

  const anthropicRequestBody = {
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    tools: [PROPOSE_FILM_TOOL],
    tool_choice: { type: "tool", name: "propose_film" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: buildPrompt(label, stats) },
        ],
      },
    ],
  };

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicRequestBody),
    });
  } catch (err) {
    console.error("analyze-film: fallo de red llamando a Anthropic", err);
    res.status(502).json({ error: "No se pudo contactar con la IA." });
    return;
  }

  if (!anthropicResponse.ok) {
    const detail = await anthropicResponse.text().catch(() => "");
    console.error("analyze-film: Anthropic devolvió error", anthropicResponse.status, detail);
    res.status(502).json({ error: "La IA no pudo procesar la foto." });
    return;
  }

  let data: unknown;
  try {
    data = await anthropicResponse.json();
  } catch {
    res.status(502).json({ error: "Respuesta de IA inválida." });
    return;
  }

  if (!isRecord(data)) {
    res.status(502).json({ error: "Respuesta de IA inesperada." });
    return;
  }

  if (data.stop_reason === "refusal") {
    res.status(502).json({ error: "La IA rechazó analizar esta imagen." });
    return;
  }

  const content = Array.isArray(data.content) ? data.content : [];
  const toolUseBlock = content.find(
    (block): block is { type: "tool_use"; name: string; input: unknown } =>
      isRecord(block) && block.type === "tool_use" && block.name === "propose_film"
  );

  if (!toolUseBlock || !isRecord(toolUseBlock.input)) {
    console.error("analyze-film: sin bloque tool_use en la respuesta", JSON.stringify(data).slice(0, 500));
    res.status(502).json({ error: "Respuesta de IA inesperada (sin propuesta de película)." });
    return;
  }

  res.status(200).json({ ...toolUseBlock.input, modelId: MODEL_ID });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
