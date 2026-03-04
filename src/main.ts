/**
 * Phase 1 + Phase 2: MediaPipe で認識し、2D オーバーレイと 3D 空間（Three.js）に表示
 */

import { DrawingUtils } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { CONFIG, type WorldLandmark } from "./config.js";
import { initCamera, loadLandmarkers } from "./init.js";
import { drawPoseAndHandsOverlay } from "./overlay.js";
import { createScene } from "./three/scene.js";
import { HandSpheres } from "./three/hands.js";
import { PoseSpheres } from "./three/pose.js";

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

  statusEl.textContent = status.startingCamera;
  await initCamera(video, vConf.width, vConf.height);

  statusEl.textContent = status.loadingMediaPipe;
  const { poseLandmarker, handLandmarker } = await loadLandmarkers(
    models.pose,
    models.hand
  );

  const drawingUtils = new DrawingUtils(ctx);
  const { scene, camera, renderer } = createScene(scene3dEl);
  const poseSpheres = new PoseSpheres(scene);
  const handSpheres = new HandSpheres(scene);

  setupResize(scene3dEl, renderer, camera);
  statusEl.textContent = status.ready;

  let frameCount = 0;
  let lastPoseWorld: WorldLandmark[] = [];
  let lastHandsWorld: WorldLandmark[][] = [];

  function detect() {
    if (video.readyState < 2) {
      requestAnimationFrame(detect);
      return;
    }

    frameCount += 1;
    const doDetect = frameCount % detectInterval === 0;
    const timestamp = performance.now();

    if (doDetect) {
      try {
        const poseResult = poseLandmarker.detectForVideo(video, timestamp);
        const handResult = handLandmarker.detectForVideo(video, timestamp);

        drawPoseAndHandsOverlay(
          ctx,
          canvas,
          poseResult,
          handResult,
          drawingUtils
        );

        if (poseResult.worldLandmarks.length > 0) {
          lastPoseWorld = toWorldLandmarks(poseResult.worldLandmarks[0]);
        }
        lastHandsWorld = handResult.worldLandmarks.map((hand) =>
          hand.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
        );
        const handednessLabels =
          handResult.handedness?.map((cats) => cats[0]?.categoryName ?? "") ?? [];

        poseSpheres.update(lastPoseWorld);
        handSpheres.update(lastHandsWorld, handednessLabels, lastPoseWorld);

        if (frameCount % (5 * 30) === detectInterval) {
          console.log("[worldLandmarks sample] pose[0]:", lastPoseWorld[0]);
          console.log("[worldLandmarks sample] hands:", lastHandsWorld.length);
        }
      } catch (e) {
        console.warn("Detection error:", e);
      }
    }

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
