import * as THREE from "three";
import { mediaPipeToThree } from "./scene.js";

const SPHERE_RADIUS = 0.012;
const SPHERE_COLOR = 0xffaa00;

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
   * worldLandmarks（手ごとの 21 点）で球体の位置を更新する。
   * 座標は MediaPipe → Three.js に変換し、スケール 1 でそのままメートル扱い。
   */
  update(handsWorld: { x: number; y: number; z: number }[][]) {
    for (let h = 0; h < 2; h++) {
      const hand = handsWorld[h];
      const spheres = this.hands[h];
      if (!hand || hand.length === 0) {
        spheres.forEach((s) => (s.visible = false));
        continue;
      }
      for (let i = 0; i < Math.min(21, hand.length); i++) {
        const mesh = spheres[i];
        mesh.visible = true;
        const pos = mediaPipeToThree(hand[i]!);
        mesh.position.copy(pos);
      }
    }
  }
}
