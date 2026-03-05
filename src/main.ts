/**
 * Phase 1 + Phase 2 + Phase 3: MediaPipe で認識し、2D オーバーレイ・3D 空間・VRM アバターに表示
 */

import { DrawingUtils } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { CONFIG, type WorldLandmark } from "./config.js";
import { initCamera, loadLandmarkers } from "./init.js";
import { drawPoseAndHandsOverlay } from "./overlay.js";
import { createScene } from "./three/scene.js";
import { HandSpheres } from "./three/hands.js";
import { PoseSpheres } from "./three/pose.js";
import { loadVRM } from "./three/avatar.js";
import { applyPoseToVRM } from "./three/poseMapper.js";
import type { VRM } from "@pixiv/three-vrm";

function getRequiredElements() {
  const video = document.getElementById("video") as HTMLVideoElement | null;
  const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
  const statusEl = document.getElementById("status") as HTMLParagraphElement | null;
  const scene3dEl = document.getElementById("scene3d");
  if (!video || !canvas || !statusEl || !scene3dEl) {
    throw new Error("Required elements not found");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");
  return { video, canvas, ctx, statusEl, scene3dEl };
}

function setupResize(
  scene3dEl: HTMLElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera
) {
  const resize = () => {
    const w = scene3dEl.clientWidth;
    const h = scene3dEl.clientHeight;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  };
  window.addEventListener("resize", resize);
  requestAnimationFrame(resize);
}

function toWorldLandmarks(
  poseWorld: { x: number; y: number; z: number }[] | undefined
): WorldLandmark[] {
  if (!poseWorld?.length) return [];
  return poseWorld.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }));
}

async function main() {
  const { video, canvas, ctx, statusEl, scene3dEl } = getRequiredElements();
  const { video: vConf, models, detectInterval, status } = CONFIG;

  // 3D シーンは常に初期化（カメラ有無にかかわらず）
  const { scene, camera: cam3d, renderer } = createScene(scene3dEl);
  const poseSpheres = new PoseSpheres(scene);
  const handSpheres = new HandSpheres(scene);
  const clock = new THREE.Clock();
  setupResize(scene3dEl, renderer, cam3d);

  // VRM アバターの読み込み
  let currentVrm: VRM | null = null;
  statusEl.textContent = "VRM アバターを読み込み中…";
  loadVRM(scene)
    .then((vrm) => {
      currentVrm = vrm;
      console.log("[VRM] Avatar loaded", vrm);
      statusEl.textContent = cameraReady
        ? status.ready
        : "VRM 読み込み完了（カメラなし）";
    })
    .catch((err) => console.warn("[VRM] Failed to load avatar:", err));

  // カメラ・MediaPipe の初期化（失敗しても 3D シーンは続行）
  let cameraReady = false;
  let poseLandmarker: Awaited<ReturnType<typeof loadLandmarkers>>["poseLandmarker"] | null = null;
  let handLandmarker: Awaited<ReturnType<typeof loadLandmarkers>>["handLandmarker"] | null = null;
  let drawingUtils: DrawingUtils | null = null;

  try {
    statusEl.textContent = status.startingCamera;
    await initCamera(video, vConf.width, vConf.height);
    cameraReady = true;

    statusEl.textContent = status.loadingMediaPipe;
    const landmarkers = await loadLandmarkers(models.pose, models.hand);
    poseLandmarker = landmarkers.poseLandmarker;
    handLandmarker = landmarkers.handLandmarker;
    drawingUtils = new DrawingUtils(ctx);

    statusEl.textContent = status.ready;
  } catch (err) {
    console.warn("[Camera] Initialization failed:", err);
    statusEl.textContent = currentVrm
      ? "VRM 読み込み完了（カメラなし）"
      : "VRM 読み込み中…（カメラなし）";
  }

  let frameCount = 0;
  let lastPoseWorld: WorldLandmark[] = [];
  let lastHandsWorld: WorldLandmark[][] = [];

  function detect() {
    frameCount += 1;

    if (cameraReady && poseLandmarker && handLandmarker && video.readyState >= 2) {
      const doDetect = frameCount % detectInterval === 0;
      const timestamp = performance.now();

      if (doDetect) {
        try {
          const poseResult = poseLandmarker.detectForVideo(video, timestamp);
          const handResult = handLandmarker.detectForVideo(video, timestamp);

          if (drawingUtils) {
            drawPoseAndHandsOverlay(ctx, canvas, poseResult, handResult, drawingUtils);
          }

          if (poseResult.worldLandmarks.length > 0) {
            lastPoseWorld = toWorldLandmarks(poseResult.worldLandmarks[0]);
          }
          lastHandsWorld = handResult.worldLandmarks.map((hand) =>
            hand.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
          );
          const handednessLabels =
            handResult.handedness?.map((cats) => cats[0]?.categoryName ?? "") ?? [];

          // #region agent log
          if (frameCount % 90 === 0) {
            const wl = handResult.worldLandmarks;
            fetch('http://127.0.0.1:7242/ingest/4d367f3e-86eb-4b41-903e-6f4561f424f0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'13700b'},body:JSON.stringify({sessionId:'13700b',location:'main.ts:handResult',message:'hand_result',data:{worldLandmarksLen:wl?.length??-1,lastHandsWorldLen:lastHandsWorld.length,hand0Len:lastHandsWorld[0]?.length??0,hand1Len:lastHandsWorld[1]?.length??0},timestamp:Date.now(),hypothesisId:'H1_H2'})}).catch(()=>{});
          }
          // #endregion

          poseSpheres.update(lastPoseWorld);
          handSpheres.update(lastHandsWorld, handednessLabels, lastPoseWorld);

          if (currentVrm && lastPoseWorld.length > 0) {
            applyPoseToVRM(currentVrm, lastPoseWorld);
          }

          if (frameCount % (5 * 30) === detectInterval) {
            console.log("[worldLandmarks sample] pose[0]:", lastPoseWorld[0]);
            console.log("[worldLandmarks sample] hands:", lastHandsWorld.length);
          }
        } catch (e) {
          console.warn("Detection error:", e);
        }
      }
    }

    if (currentVrm) {
      currentVrm.update(clock.getDelta());
    }

    renderer.render(scene, cam3d);
    requestAnimationFrame(detect);
  }

  detect();
}

main().catch((err) => {
  console.error(err);
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = `エラー: ${err.message}`;
});
