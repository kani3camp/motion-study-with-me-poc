import * as THREE from "three";
import { mediaPipeToThree } from "./scene.js";

const SPHERE_RADIUS = 0.018;
const POSE_COLOR = 0x00ff00;
const SCALE = 2.5;

/** 右側 3D に Pose（胴体・骨格）の 33 点を球で表示する */
export class PoseSpheres {
  private meshes: THREE.Mesh[] = [];
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
    scene.add(this.group);
  }

  update(poseWorld: { x: number; y: number; z: number }[]) {
    if (!poseWorld || poseWorld.length < 33) {
      this.meshes.forEach((m) => (m.visible = false));
      return;
    }
    for (let i = 0; i < 33; i++) {
      const mesh = this.meshes[i];
      mesh.visible = true;
      const pos = mediaPipeToThree(poseWorld[i]!, SCALE);
      mesh.position.copy(pos);
    }
  }
}
