import { beforeEach, describe, expect, it } from "vitest";
import { FILMS } from "./registry";
import type { CustomFilmRecord } from "./customFilm";
import {
  addCustomFilm,
  getAllFilms,
  getAnyFilm,
  initCustomFilmStore,
  loadCustomFilmRecords,
  removeCustomFilm,
  saveCustomFilmRecords,
  type CustomFilmStorage,
} from "./customFilmStore";

function createFakeStorage(): CustomFilmStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function makeRecord(overrides: Partial<CustomFilmRecord> = {}): CustomFilmRecord {
  return {
    id: overrides.id ?? "custom-1",
    label: overrides.label ?? "Ámbar de Tarde",
    createdAt: overrides.createdAt ?? "2026-08-04T00:00:00.000Z",
    points: overrides.points ?? [
      { logE: -3.4, r: 0.25, g: 0.65, b: 0.9 },
      { logE: -1.5, r: 0.9, g: 1.4, b: 1.9 },
      { logE: 0.0, r: 1.7, g: 2.1, b: 2.7 },
      { logE: 0.9, r: 2.05, g: 2.45, b: 3.05 },
      { logE: 1.5, r: 2.15, g: 2.55, b: 3.15 },
    ],
    colorCharacter: overrides.colorCharacter ?? {
      shadowWarmth: 12,
      shadowTint: -4,
      highlightWarmth: 8,
      highlightTint: 0,
      saturationBias: 5,
      vibranceBias: 10,
    },
    grainCharacter: overrides.grainCharacter ?? { sizeMultiplier: 1.1, intensityMultiplier: 1.2 },
    halationMultiplier: overrides.halationMultiplier ?? 0.95,
    analysisNote: overrides.analysisNote ?? "Sombras cálidas, grano visible.",
    modelId: overrides.modelId ?? "claude-sonnet-5",
    sourceImageName: overrides.sourceImageName,
  };
}

describe("loadCustomFilmRecords / saveCustomFilmRecords — round trip con storage falso", () => {
  it("devuelve [] si no hay nada guardado", () => {
    expect(loadCustomFilmRecords(createFakeStorage())).toEqual([]);
  });

  it("devuelve [] si el JSON guardado está corrupto", () => {
    const storage = createFakeStorage();
    storage.setItem("nwfilm.customFilms", "{esto no es json válido");
    expect(loadCustomFilmRecords(storage)).toEqual([]);
  });

  it("guarda y vuelve a leer un registro válido sin perder datos", () => {
    const storage = createFakeStorage();
    const record = makeRecord();
    saveCustomFilmRecords([record], storage);
    const loaded = loadCustomFilmRecords(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(record.id);
    expect(loaded[0].label).toBe(record.label);
    expect(loaded[0].points).toHaveLength(record.points.length);
  });

  it("salta una entrada corrupta del array sin descartar las demás", () => {
    const storage = createFakeStorage();
    const good = makeRecord({ id: "custom-good" });
    const corrupt = { id: "custom-bad", label: "Rota" }; // sin curvePoints/colorCharacter/etc.
    storage.setItem("nwfilm.customFilms", JSON.stringify([good, corrupt]));
    const loaded = loadCustomFilmRecords(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("custom-good");
  });
});

describe("store con estado (initCustomFilmStore/getAllFilms/addCustomFilm/removeCustomFilm)", () => {
  let storage: CustomFilmStorage;

  beforeEach(() => {
    storage = createFakeStorage();
    initCustomFilmStore(storage);
  });

  it("getAllFilms devuelve solo las 5 reales si no hay ninguna custom guardada", () => {
    expect(getAllFilms()).toHaveLength(FILMS.length);
  });

  it("addCustomFilm añade la película a la lista combinada y la persiste", () => {
    const record = makeRecord({ id: "custom-nueva" });
    const saved = addCustomFilm(record);
    expect(saved).toBe(true);
    expect(getAllFilms()).toHaveLength(FILMS.length + 1);
    expect(getAnyFilm("custom-nueva").isCustom).toBe(true);

    // Re-inicializar desde el mismo storage confirma que sobrevivió el "guardado".
    initCustomFilmStore(storage);
    expect(getAllFilms()).toHaveLength(FILMS.length + 1);
  });

  it("getAnyFilm resuelve tanto películas custom como las 5 reales, y lanza si no existe ninguna", () => {
    addCustomFilm(makeRecord({ id: "custom-x" }));
    expect(getAnyFilm("custom-x").isCustom).toBe(true);
    expect(getAnyFilm("portra400").isCustom).toBeUndefined();
    expect(() => getAnyFilm("no-existe")).toThrow();
  });

  it("removeCustomFilm la quita de la lista combinada y de la persistencia", () => {
    addCustomFilm(makeRecord({ id: "custom-borrar" }));
    expect(getAllFilms()).toHaveLength(FILMS.length + 1);

    removeCustomFilm("custom-borrar");
    expect(getAllFilms()).toHaveLength(FILMS.length);

    initCustomFilmStore(storage);
    expect(getAllFilms()).toHaveLength(FILMS.length);
  });
});
