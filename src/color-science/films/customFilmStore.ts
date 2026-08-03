/**
 * Persistencia y lista combinada (5 películas reales + las creadas por el
 * usuario) de películas. Es el ÚNICO sitio de todo el proyecto que usa
 * almacenamiento del navegador (localStorage) — hasta ahora el único
 * mecanismo de "guardado" de la app era descarga de archivo (ver
 * `saveBlob` en main.ts).
 *
 * `loadCustomFilmRecords`/`saveCustomFilmRecords` reciben el storage como
 * parámetro (en vez de usar `window.localStorage` directamente) para poder
 * testear con un storage falso en memoria, sin añadir jsdom como
 * dependencia nueva del proyecto.
 */

import { FILMS, getFilm, type FilmProfile } from "./registry";
import { recordToFilmProfile, validateAndClampFilmRecord, type CustomFilmRecord } from "./customFilm";

const STORAGE_KEY = "nwfilm.customFilms";

export type ReadableStorage = Pick<Storage, "getItem">;
export type WritableStorage = Pick<Storage, "setItem">;
export type CustomFilmStorage = ReadableStorage & WritableStorage;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lee y valida los registros guardados. Una entrada individual corrupta
 * se SALTA (no descarta el array entero) — mismo criterio defensivo que
 * el resto de parseo de datos externos del proyecto.
 */
export function loadCustomFilmRecords(storage: ReadableStorage): CustomFilmRecord[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const valid: CustomFilmRecord[] = [];
  for (const item of parsed) {
    if (!isPlainObject(item)) continue;
    const result = validateAndClampFilmRecord(item, {
      id: typeof item.id === "string" && item.id.length > 0 ? item.id : `custom-${crypto.randomUUID()}`,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
      modelId: typeof item.modelId === "string" ? item.modelId : "desconocido",
      sourceImageName: typeof item.sourceImageName === "string" ? item.sourceImageName : undefined,
    });
    if (result.ok) valid.push(result.record);
  }
  return valid;
}

/** Devuelve false si falló el guardado (p.ej. almacenamiento lleno) — el llamador decide si avisar al usuario. */
export function saveCustomFilmRecords(records: CustomFilmRecord[], storage: WritableStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

// --- Estado del store activo de la página (una sola instancia) ---
let activeStorage: CustomFilmStorage | null = null;
let records: CustomFilmRecord[] = [];
let profiles: FilmProfile[] = [];

function rebuildProfiles(): void {
  profiles = records.map(recordToFilmProfile);
}

function requireStorage(): CustomFilmStorage {
  if (!activeStorage) {
    throw new Error("customFilmStore: llama a initCustomFilmStore() antes de usar el store.");
  }
  return activeStorage;
}

/** Carga las películas guardadas y arranca el store. Llamar una vez al iniciar la app. */
export function initCustomFilmStore(storage: CustomFilmStorage = window.localStorage): CustomFilmRecord[] {
  activeStorage = storage;
  records = loadCustomFilmRecords(storage);
  rebuildProfiles();
  return records;
}

/** Las 5 películas reales + las creadas por el usuario, en ese orden. */
export function getAllFilms(): FilmProfile[] {
  return [...FILMS, ...profiles];
}

/** Busca primero entre las películas del usuario y si no, cae a las 5 reales (lanza igual que `getFilm` si no existe en ninguna). */
export function getAnyFilm(id: string): FilmProfile {
  const custom = profiles.find((film) => film.id === id);
  return custom ?? getFilm(id);
}

export function getCustomFilmRecords(): CustomFilmRecord[] {
  return records;
}

/** Añade una película ya validada. Devuelve false si no se pudo persistir (la película queda añadida en memoria para la sesión actual de todos modos). */
export function addCustomFilm(record: CustomFilmRecord): boolean {
  records = [...records, record];
  rebuildProfiles();
  return saveCustomFilmRecords(records, requireStorage());
}

export function removeCustomFilm(id: string): boolean {
  records = records.filter((record) => record.id !== id);
  rebuildProfiles();
  return saveCustomFilmRecords(records, requireStorage());
}

/**
 * Reconstruye las <option>/<optgroup> del desplegable de película: las 5
 * reales agrupadas como "Películas", y (solo si hay alguna) las del
 * usuario agrupadas como "Mis películas (IA)" — para que el desplegable
 * se vea exactamente igual que antes mientras no exista ninguna custom.
 */
export function renderFilmSelectOptions(selectEl: HTMLSelectElement, selectedId: string): void {
  selectEl.innerHTML = "";

  const builtInGroup = document.createElement("optgroup");
  builtInGroup.label = "Películas";
  for (const film of FILMS) {
    const option = document.createElement("option");
    option.value = film.id;
    option.textContent = film.label;
    if (film.id === selectedId) option.selected = true;
    builtInGroup.appendChild(option);
  }
  selectEl.appendChild(builtInGroup);

  if (profiles.length > 0) {
    const customGroup = document.createElement("optgroup");
    customGroup.label = "Mis películas (IA)";
    for (const film of profiles) {
      const option = document.createElement("option");
      option.value = film.id;
      option.textContent = film.label;
      if (film.id === selectedId) option.selected = true;
      customGroup.appendChild(option);
    }
    selectEl.appendChild(customGroup);
  }
}
