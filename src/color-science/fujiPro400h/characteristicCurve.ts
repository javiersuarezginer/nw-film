import { createCurveModel, type Channel, type CurveLUT } from "../curveModel";
import { fujiPro400hCharacteristicCurve, FUJI_PRO_400H_SOURCE } from "./characteristicCurveData";

export type { Channel, CurveLUT };
export { FUJI_PRO_400H_SOURCE };

const model = createCurveModel(fujiPro400hCharacteristicCurve);

export const MEASURED_LOG_E_MIN = model.measuredLogEMin;
export const MEASURED_LOG_E_MAX = model.measuredLogEMax;
export const sampleDensity = model.sampleDensity;
export const buildCurveLUT = model.buildCurveLUT;
