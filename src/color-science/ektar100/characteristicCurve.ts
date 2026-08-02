import { createCurveModel, type Channel, type CurveLUT } from "../curveModel";
import { ektar100CharacteristicCurve, EKTAR_100_SOURCE } from "./characteristicCurveData";

export type { Channel, CurveLUT };
export { EKTAR_100_SOURCE };

const model = createCurveModel(ektar100CharacteristicCurve);

export const MEASURED_LOG_E_MIN = model.measuredLogEMin;
export const MEASURED_LOG_E_MAX = model.measuredLogEMax;
export const sampleDensity = model.sampleDensity;
export const buildCurveLUT = model.buildCurveLUT;
