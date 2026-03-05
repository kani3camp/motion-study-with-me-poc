/**
 * MediaPipe Pose ランドマーク → VRM ヒューマノイドボーン回転のマッピング
 *
 * MediaPipe worldLandmarks 座標系:
 *   X: 被写体の左方向が正（カメラ視点で右）
 *   Y: 下方向が正
 *   Z: カメラに向かう方向が正
 *
 * VRM / Three.js 座標系:
 *   X: 右, Y: 上, Z: カメラ方向（手前）
 *   T-pose: 両腕水平、Y 軸上向き
 */

import type { VRM } from "@pixiv/three-vrm";
import * as THREE from "three";
import type { WorldLandmark } from "../config.js";

const MP_LEFT_SHOULDER = 11;
const MP_RIGHT_SHOULDER = 12;
const MP_LEFT_ELBOW = 13;
const MP_RIGHT_ELBOW = 14;
const MP_LEFT_WRIST = 15;
const MP_RIGHT_WRIST = 16;
const MP_LEFT_HIP = 23;
const MP_RIGHT_HIP = 24;

/** MediaPipe → Three.js 座標変換 */
function mp(lm: WorldLandmark): THREE.Vector3 {
  return new THREE.Vector3(-lm.x, -lm.y, lm.z);
}

/** 2点間の 2D 角度（atan2） */
function angle2D(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/** ラジアンを -PI..PI に正規化 */
function normalizeRad(r: number): number {
  r = r % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 2 点間のオイラー回転を計算する（kalidokit 方式）
 * XZ 平面→X回転, ZY 平面→Y回転, XY 平面→Z回転
 */
function findRotation(
  a: THREE.Vector3,
  b: THREE.Vector3
): { x: number; y: number; z: number } {
  return {
    x: normalizeRad(angle2D(a.z, a.x, b.z, b.x)),
    y: normalizeRad(angle2D(a.z, a.y, b.z, b.y)),
    z: normalizeRad(angle2D(a.x, a.y, b.x, b.y)),
  };
}

/** 3 点間の角度（ラジアン） */
function angleBetween3Points(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): number {
  const ba = a.clone().sub(b);
  const bc = c.clone().sub(b);
  const dot = ba.dot(bc);
  const cross = ba.length() * bc.length();
  if (cross === 0) return 0;
  return Math.acos(clamp(dot / cross, -1, 1));
}

/**
 * 上半身のポーズを VRM ボーンに適用する
 */
export function applyPoseToVRM(vrm: VRM, pose: WorldLandmark[]): void {
  if (!pose || pose.length < 25) return;

  const humanoid = vrm.humanoid;

  const p = pose.map((lm) => mp(lm));

  // --- Spine / Chest ---
  const hipCenter = p[MP_LEFT_HIP]
    .clone()
    .add(p[MP_RIGHT_HIP])
    .multiplyScalar(0.5);
  const shoulderCenter = p[MP_LEFT_SHOULDER]
    .clone()
    .add(p[MP_RIGHT_SHOULDER])
    .multiplyScalar(0.5);

  const shoulderRot = findRotation(p[MP_LEFT_SHOULDER], p[MP_RIGHT_SHOULDER]);

  const spineRotY = normalizeRad(shoulderRot.y);
  const spineRotZ = (() => {
    let z = shoulderRot.z;
    if (z > 0) z = 1 - z;
    if (z < 0) z = -1 - z;
    return z;
  })();

  const spineForward = shoulderCenter.clone().sub(hipCenter).normalize();
  const spineRotX = Math.asin(clamp(-spineForward.z, -1, 1)) * 0.5;

  const spineNode = humanoid.getNormalizedBoneNode("spine");
  if (spineNode) {
    spineNode.rotation.set(spineRotX, spineRotY * 0.3, spineRotZ * 0.3);
  }

  const chestNode = humanoid.getNormalizedBoneNode("chest");
  if (chestNode) {
    chestNode.rotation.set(0, spineRotY * 0.3, spineRotZ * 0.3);
  }

  // --- Arms ---
  applyArm(humanoid, p, "left");
  applyArm(humanoid, p, "right");
}

function applyArm(
  humanoid: VRM["humanoid"],
  p: THREE.Vector3[],
  side: "left" | "right"
): void {
  const isLeft = side === "left";
  const inv = isLeft ? 1 : -1;

  const shoulderIdx = isLeft ? MP_LEFT_SHOULDER : MP_RIGHT_SHOULDER;
  const elbowIdx = isLeft ? MP_LEFT_ELBOW : MP_RIGHT_ELBOW;
  const wristIdx = isLeft ? MP_LEFT_WRIST : MP_RIGHT_WRIST;
  const otherShoulderIdx = isLeft ? MP_RIGHT_SHOULDER : MP_LEFT_SHOULDER;

  const upperArmRot = findRotation(p[shoulderIdx], p[elbowIdx]);
  upperArmRot.y = angleBetween3Points(
    p[otherShoulderIdx],
    p[shoulderIdx],
    p[elbowIdx]
  );

  const lowerArmRot = findRotation(p[elbowIdx], p[wristIdx]);
  lowerArmRot.y = angleBetween3Points(
    p[shoulderIdx],
    p[elbowIdx],
    p[wristIdx]
  );
  lowerArmRot.z = clamp(lowerArmRot.z, -2.14, 0);

  // Scale & adjust (kalidokit-inspired empirical values)
  const uaZ = upperArmRot.z * -2.3 * inv;
  let uaY = upperArmRot.y * Math.PI * inv;
  uaY -= Math.max(lowerArmRot.x, 0);
  uaY -= -inv * Math.max(lowerArmRot.z, 0);
  const uaX = upperArmRot.x - 0.3 * inv;

  const laZ = lowerArmRot.z * -2.14 * inv;
  const laY = lowerArmRot.y * 2.14 * inv;
  const laX = clamp(lowerArmRot.x * 2.14 * inv, -0.3, 0.3);

  const upperBoneName = isLeft ? "leftUpperArm" : "rightUpperArm";
  const lowerBoneName = isLeft ? "leftLowerArm" : "rightLowerArm";
  const handBoneName = isLeft ? "leftHand" : "rightHand";

  const upperNode = humanoid.getNormalizedBoneNode(upperBoneName);
  if (upperNode) {
    upperNode.rotation.set(
      clamp(uaX, -0.5, Math.PI),
      clamp(uaY, -Math.PI, Math.PI),
      clamp(uaZ, isLeft ? -Math.PI : -0.5, isLeft ? 0.5 : Math.PI)
    );
  }

  const lowerNode = humanoid.getNormalizedBoneNode(lowerBoneName);
  if (lowerNode) {
    lowerNode.rotation.set(laX, laY, laZ);
  }

  const wristRot = findRotation(
    p[wristIdx],
    p[wristIdx].clone().lerp(p[elbowIdx], -0.3)
  );
  const handNode = humanoid.getNormalizedBoneNode(handBoneName);
  if (handNode) {
    handNode.rotation.set(0, clamp(wristRot.z * 2, -0.6, 0.6), 0);
  }
}
