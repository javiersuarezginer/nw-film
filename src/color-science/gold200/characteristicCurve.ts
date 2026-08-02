import { createCurveModel, type Channel, type CurveLUT } from "../curveModel";
import { gold200CharacteristicCurve, GOLD_200_SOURCE } from "./characteristicCurveData";

export type { Channel, CurveLUT };
export { GOLD_200_SOURCE };

const model = createCurveModel(gold200CharacteristicCurve);

export const MEASURED_LOG_E_MIN = model.measuredLogEMin;
export const MEASURED_LOG_E_MAX = model.measuredLogEMax;
export const sampleDensity = model.sampleDensity;
export const buildCurveLUT = model.buildCurveLUT;
