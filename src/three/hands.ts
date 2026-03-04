import * as THREE from "three";
import type { WorldLandmark } from "../config.js";
import { mediaPipeToThree } from "./scene.js";

const SPHERE_RADIUS = 0.022;
const SPHERE_COLOR = 0xffaa00;
const SCALE = 2.5;

/** MediaPipe Pose の手首インデックス（Hand を共通座標に置くためのアンカー） */
export const POSE_LEFT_WRIST = 15;
export const POSE_RIGHT_WRIST = 16;

/** 手 1 本あたり 21 点の球体メッシュを作成する */
function createHandSpheres(): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const geo = new THREE.SphereGeometry(SPHERE_RADIUS, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: SPHERE_COLOR });
  for (let i = 0; i < 21; i++) {
    const mesh = new THREE.Mesh(geo.clone(), mat.clone());
    meshes.push(mesh);
  }
  return meshes;
}

/** 最大 2 手分の球体（42 個）を保持し、座標で更新する */
export class HandSpheres {
  private hands: THREE.Mesh[][] = [];
  private group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    for (let h = 0; h < 2; h++) {
      const spheres = createHandSpheres();
      spheres.forEach((m) => this.group.add(m));
      this.hands.push(spheres);
    }
    scene.add(this.group);
  }

  /**
   * Hand の world は「手ごとのローカル」なので重なる。
   * Pose の左手首(15)・右手首(16)をアンカーにし、手の形は「手首からの相対」で同じ座標系に乗せる。
   * Pose が無いときだけ handedness で小さくずらして重なりを避ける。
   */
  update(
    handsWorld: WorldLandmark[][],
    handednessLabels?: string[],
    poseWorld?: WorldLandmark[]
  ) {
    const poseOk =
      poseWorld &&
      poseWorld.length > POSE_RIGHT_WRIST &&
      poseWorld[POSE_LEFT_WRIST] != null &&
      poseWorld[POSE_RIGHT_WRIST] != null;

    for (let h = 0; h < 2; h++) {
      const hand = handsWorld[h];
      const spheres = this.hands[h];
      if (!hand || hand.length === 0) {
        spheres.forEach((s) => (s.visible = false));
        continue;
      }
      const isLeft = handednessLabels?.[h]?.toLowerCase() === "left";
      const wrist = hand[0]!;

      let anchor: THREE.Vector3;
      if (poseOk) {
        const poseWrist = isLeft ? poseWorld![POSE_LEFT_WRIST]! : poseWorld![POSE_RIGHT_WRIST]!;
        anchor = mediaPipeToThree(poseWrist, SCALE);
      } else {
        anchor = new THREE.Vector3(isLeft ? -0.2 : 0.2, 0, 0);
      }

      for (let i = 0; i < Math.min(21, hand.length); i++) {
        const mesh = spheres[i];
        mesh.visible = true;
        if (poseOk) {
          const rel = {
            x: hand[i]!.x - wrist.x,
            y: hand[i]!.y - wrist.y,
            z: hand[i]!.z - wrist.z,
          };
          const pos = mediaPipeToThree(rel, SCALE);
          pos.add(anchor);
          mesh.position.copy(pos);
        } else {
          const pos = mediaPipeToThree(hand[i]!, SCALE);
          pos.add(anchor);
          mesh.position.copy(pos);
        }
      }
    }
  }
}
