import * as THREE from "three";
import { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { WorldLandmark } from "../config.js";
import { mediaPipeToThree } from "./scene.js";

const SPHERE_RADIUS = 0.018;
const POSE_COLOR = 0x00ff00;
const SCALE = 2.5;

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS as unknown as [number, number][];

/** 右側 3D に Pose（胴体・骨格）の 33 点を球と接続線で表示する */
export class PoseSpheres {
  private meshes: THREE.Mesh[] = [];
  private lines: THREE.LineSegments;
  private group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    const geo = new THREE.SphereGeometry(SPHERE_RADIUS, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: POSE_COLOR });
    for (let i = 0; i < 33; i++) {
      const mesh = new THREE.Mesh(geo.clone(), mat.clone());
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(POSE_CONNECTIONS.length * 2 * 3);
    const lineAttr = new THREE.BufferAttribute(linePositions, 3);
    lineAttr.setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute("position", lineAttr);
    lineGeo.setDrawRange(0, POSE_CONNECTIONS.length * 2);
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: POSE_COLOR, linewidth: 1 })
    );
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
    scene.add(this.group);
  }

  update(poseWorld: WorldLandmark[]) {
    if (!poseWorld || poseWorld.length < 33) {
      this.meshes.forEach((m) => (m.visible = false));
      this.lines.visible = false;
      return;
    }
    for (let i = 0; i < 33; i++) {
      const mesh = this.meshes[i];
      mesh.visible = true;
      const pos = mediaPipeToThree(poseWorld[i]!, SCALE);
      mesh.position.copy(pos);
    }
    const posAttr = this.lines.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let k = 0; k < POSE_CONNECTIONS.length; k++) {
      const [i, j] = POSE_CONNECTIONS[k];
      const a = mediaPipeToThree(poseWorld[i]!, SCALE);
      const b = mediaPipeToThree(poseWorld[j]!, SCALE);
      const o = k * 6;
      arr[o + 0] = a.x;
      arr[o + 1] = a.y;
      arr[o + 2] = a.z;
      arr[o + 3] = b.x;
      arr[o + 4] = b.y;
      arr[o + 5] = b.z;
    }
    posAttr.needsUpdate = true;
    this.lines.geometry.computeBoundingSphere();
    this.lines.visible = true;
  }
}
