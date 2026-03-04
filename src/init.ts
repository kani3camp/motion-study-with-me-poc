/**
 * カメラと MediaPipe ランドマーカーの初期化
 */

import {
  FilesetResolver,
  PoseLandmarker,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export async function initCamera(
  video: HTMLVideoElement,
  width: number,
  height: number
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width, height, facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export async function loadLandmarkers(poseModelUrl: string, handModelUrl: string) {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: poseModelUrl },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: handModelUrl },
    runningMode: "VIDEO",
    numHands: 2,
  });

  return { poseLandmarker, handLandmarker };
}
