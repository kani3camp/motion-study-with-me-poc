/**
 * 2D キャンバスへのポーズ・手の骨格オーバーレイ描画
 */

import {
  PoseLandmarker,
  HandLandmarker,
  DrawingUtils,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

type PoseResult = {
  landmarks: NormalizedLandmark[][];
};

type HandResult = {
  landmarks: NormalizedLandmark[][];
};

export function drawPoseAndHandsOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  poseResult: PoseResult,
  handResult: HandResult,
  drawingUtils: DrawingUtils
): void {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (poseResult.landmarks.length > 0) {
    const poseLms = poseResult.landmarks[0] as NormalizedLandmark[];
    drawingUtils.drawConnectors(poseLms, PoseLandmarker.POSE_CONNECTIONS, {
      lineWidth: 2,
      color: "#00ff00",
    });
    drawingUtils.drawLandmarks(poseLms, { radius: 3, color: "#00ff00" });
  }

  for (const handLms of handResult.landmarks) {
    drawingUtils.drawConnectors(
      handLms as NormalizedLandmark[],
      HandLandmarker.HAND_CONNECTIONS,
      { lineWidth: 2, color: "#ffaa00" }
    );
    drawingUtils.drawLandmarks(handLms as NormalizedLandmark[], {
      radius: 3,
      color: "#ffaa00",
    });
  }

  ctx.restore();
}
