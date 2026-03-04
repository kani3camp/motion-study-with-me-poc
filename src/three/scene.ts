import * as THREE from "three";

const DESK_WIDTH = 1.2;
const DESK_DEPTH = 0.7;
const DESK_HEIGHT = 0.02;
const DESK_Y = -0.4; // 机の上面の高さ（カメラ視点で手が届く範囲）

/**
 * Three.js シーンを構築する。
 * - PerspectiveCamera
 * - 環境光 + 指向性ライト
 * - グレーの板（机）
 */
export function createScene(container: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 10);
  camera.position.set(0, 0, 1.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // ライト
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1, 1, 1);
  scene.add(dirLight);

  // 机（グレーの板）
  const deskGeo = new THREE.BoxGeometry(DESK_WIDTH, DESK_HEIGHT, DESK_DEPTH);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.position.y = DESK_Y;
  scene.add(desk);

  return { scene, camera, renderer };
}

/**
 * MediaPipe world 座標を Three.js 座標に変換する。
 * - MediaPipe: Y 上, Z がカメラ方向, メートル
 * - Three.js: Y 上, 右手系（カメラは -Z を向く）
 * 変換: threeX = mpX, threeY = mpY, threeZ = -mpZ
 */
export function mediaPipeToThree(
  mp: { x: number; y: number; z: number },
  scale = 1
): THREE.Vector3 {
  return new THREE.Vector3(
    mp.x * scale,
    mp.y * scale,
    -mp.z * scale
  );
}

export { DESK_Y };
