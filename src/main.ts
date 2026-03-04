/**
 * Phase 1 + Phase 2: MediaPipe で認識し、2D オーバーレイと 3D 空間（Three.js）に表示
 */

import {
  FilesetResolver,
  PoseLandmarker,
  HandLandmarker,
  DrawingUtils,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { createScene } from "./three/scene.js";
import { HandSpheres } from "./three/hands.js";

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

// モデル URL（POC では Pose は lite、負荷軽減）
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// フレーム間引き: 2 フレームに 1 回解析（約 15fps）で負荷軽減
const DETECT_INTERVAL = 2;

async function main() {
  const video = document.getElementById("video") as HTMLVideoElement;
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const statusEl = document.getElementById("status") as HTMLParagraphElement;
  const scene3dEl = document.getElementById("scene3d");

  if (!video || !canvas || !statusEl || !scene3dEl) {
    throw new Error("Required elements not found");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");
  const canvasCtx: CanvasRenderingContext2D = ctx;

  // カメラ起動
  statusEl.textContent = "カメラを起動しています…";
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();

  statusEl.textContent = "MediaPipe を読み込んでいます…";

  // WASM とモデル読み込み
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL_URL },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL },
    runningMode: "VIDEO",
    numHands: 2,
  });

  const drawingUtils = new DrawingUtils(canvasCtx);

  // Phase 2: Three.js シーンと手の球体
  const { scene, camera, renderer } = createScene(scene3dEl);
  const handSpheres = new HandSpheres(scene);

  window.addEventListener("resize", () => {
    const w = scene3dEl.clientWidth;
    const h = scene3dEl.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  statusEl.textContent = "認識中… 左: カメラ+骨格 / 右: 3D 空間（手の球体+机）";

  let frameCount = 0;
  let lastPoseWorld: { x: number; y: number; z: number }[] = [];
  let lastHandsWorld: { x: number; y: number; z: number }[][] = [];

  function detect() {
    if (video.readyState < 2) {
      requestAnimationFrame(detect);
      return;
    }

    frameCount += 1;
    const doDetect = frameCount % DETECT_INTERVAL === 0;
    const timestamp = performance.now();

    if (doDetect) {
      try {
        const poseResult = poseLandmarker.detectForVideo(video, timestamp);
        const handResult = handLandmarker.detectForVideo(video, timestamp);

        // 2D オーバーレイ用: 正規化ランドマークで描画
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        if (poseResult.landmarks.length > 0) {
          const poseLms = poseResult.landmarks[0] as NormalizedLandmark[];
          drawingUtils.drawConnectors(
            poseLms,
            PoseLandmarker.POSE_CONNECTIONS,
            { lineWidth: 2, color: "#00ff00" }
          );
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

        canvasCtx.restore();

        // worldLandmarks を保持（Three.js 用）・コンソール出力は控えめに
        if (poseResult.worldLandmarks.length > 0) {
          lastPoseWorld = poseResult.worldLandmarks[0].map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
          }));
        }
        lastHandsWorld = handResult.worldLandmarks.map((hand) =>
          hand.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
        );

        // Phase 2: 手の球体を 3D 空間で更新
        handSpheres.update(lastHandsWorld);

        // 5 秒に 1 回だけコンソールにサンプル出力（ノイズ防止）
        if (frameCount % (5 * 30) === DETECT_INTERVAL) {
          console.log("[worldLandmarks sample] pose[0]:", lastPoseWorld[0]);
          console.log("[worldLandmarks sample] hands:", lastHandsWorld.length);
        }
      } catch (e) {
        console.warn("Detection error:", e);
      }
    }

    // 毎フレーム 3D を描画（手の位置は間引いたフレームで更新、表示はスムーズに）
    renderer.render(scene, camera);
    requestAnimationFrame(detect);
  }

  detect();
}

main().catch((err) => {
  console.error(err);
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = `エラー: ${err.message}`;
});
