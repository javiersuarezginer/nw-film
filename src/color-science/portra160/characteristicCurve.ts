import { createCurveModel, type Channel, type CurveLUT } from "../curveModel";
import { portra160CharacteristicCurve, PORTRA_160_SOURCE } from "./characteristicCurveData";

export type { Channel, CurveLUT };
export { PORTRA_160_SOURCE };

const model = createCurveModel(portra160CharacteristicCurve);

export const MEASURED_LOG_E_MIN = model.measuredLogEMin;
export const MEASURED_LOG_E_MAX = model.measuredLogEMax;
export const sampleDensity = model.sampleDensity;
export const buildCurveLUT = model.buildCurveLUT;
