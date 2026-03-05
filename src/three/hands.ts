import * as THREE from "three";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import type { WorldLandmark } from "../config.js";
import { mediaPipeToThree } from "./scene.js";

const SPHERE_RADIUS = 0.022;
const SPHERE_COLOR = 0xffaa00;
const SCALE = 2.5;

const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS as unknown as [number, number][];

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

function createHandLines(): THREE.LineSegments {
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
  const lineAttr = new THREE.BufferAttribute(linePositions, 3);
  lineAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("position", lineAttr);
  lineGeo.setDrawRange(0, HAND_CONNECTIONS.length * 2);
  const line = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: SPHERE_COLOR })
  );
  line.frustumCulled = false;
  return line;
}

/** 最大 2 手分の球体と接続線を保持し、座標で更新する */
export class HandSpheres {
  private hands: THREE.Mesh[][] = [];
  private handLines: THREE.LineSegments[] = [];
  private group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    for (let h = 0; h < 2; h++) {
      const spheres = createHandSpheres();
      spheres.forEach((m) => this.group.add(m));
      this.hands.push(spheres);
      const lines = createHandLines();
      this.group.add(lines);
      this.handLines.push(lines);
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d367f3e-86eb-4b41-903e-6f4561f424f0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'13700b'},body:JSON.stringify({sessionId:'13700b',location:'hands.ts:update',message:'hands_update_input',data:{handsWorldLen:handsWorld?.length??-1,h0Len:handsWorld?.[0]?.length??-1,h1Len:handsWorld?.[1]?.length??-1},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    const poseOk =
      poseWorld &&
      poseWorld.length > POSE_RIGHT_WRIST &&
      poseWorld[POSE_LEFT_WRIST] != null &&
      poseWorld[POSE_RIGHT_WRIST] != null;

    for (let h = 0; h < 2; h++) {
      const hand = handsWorld[h];
      const spheres = this.hands[h];
      const lineSegments = this.handLines[h]!;
      if (!hand || hand.length === 0) {
        spheres.forEach((s) => (s.visible = false));
        lineSegments.visible = false;
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

      const positions: THREE.Vector3[] = [];
      for (let i = 0; i < Math.min(21, hand.length); i++) {
        const mesh = spheres[i];
        mesh.visible = true;
        let pos: THREE.Vector3;
        if (poseOk) {
          const rel = {
            x: hand[i]!.x - wrist.x,
            y: hand[i]!.y - wrist.y,
            z: hand[i]!.z - wrist.z,
          };
          pos = mediaPipeToThree(rel, SCALE);
          pos.add(anchor);
        } else {
          pos = mediaPipeToThree(hand[i]!, SCALE);
          pos.add(anchor);
        }
        mesh.position.copy(pos);
        positions.push(pos.clone());
      }
      const posAttr = lineSegments.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let k = 0; k < HAND_CONNECTIONS.length; k++) {
        const [i, j] = HAND_CONNECTIONS[k];
        const a = positions[i];
        const b = positions[j];
        if (a == null || b == null) continue;
        const o = k * 6;
        arr[o + 0] = a.x;
        arr[o + 1] = a.y;
        arr[o + 2] = a.z;
        arr[o + 3] = b.x;
        arr[o + 4] = b.y;
        arr[o + 5] = b.z;
      }
      posAttr.needsUpdate = true;
      lineSegments.geometry.computeBoundingSphere();
      lineSegments.visible = true;
      // #region agent log
      if (spheres[0]) {
        const p = spheres[0].position;
        fetch('http://127.0.0.1:7242/ingest/4d367f3e-86eb-4b41-903e-6f4561f424f0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'13700b'},body:JSON.stringify({sessionId:'13700b',location:'hands.ts:visible',message:'hand_sphere_visible',data:{handIndex:h,visible:spheres[0].visible,x:p.x,y:p.y,z:p.z,poseOk,groupVisible:this.group.visible,hasParent:!!this.group.parent},timestamp:Date.now(),hypothesisId:'H4_H5'})}).catch(()=>{});
      }
      // #endregion
    }
  }
}
