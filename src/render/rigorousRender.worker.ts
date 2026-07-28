import { renderRigorous, type RigorousRenderParams } from "./rigorousRender";

export interface WorkerRequest {
  density: Float32Array;
  width: number;
  height: number;
  params: RigorousRenderParams;
}

export type WorkerResponse =
  | { type: "progress"; fraction: number }
  | { type: "done"; image: Uint8ClampedArray; width: number; height: number };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { density, width, height, params } = e.data;

  const image = renderRigorous(density, width, height, params, (fraction) => {
    (postMessage as (msg: WorkerResponse) => void)({ type: "progress", fraction });
  });

  (postMessage as (msg: WorkerResponse, transfer: Transferable[]) => void)(
    { type: "done", image, width, height },
    [image.buffer]
  );
};
