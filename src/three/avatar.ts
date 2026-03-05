/**
 * VRM アバターの読み込みと管理
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";

const DEFAULT_VRM_URL =
  "https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

export async function loadVRM(
  scene: THREE.Scene,
  url: string = DEFAULT_VRM_URL
): Promise<VRM> {
  const loader = new GLTFLoader();
  loader.crossOrigin = "anonymous";
  loader.register((parser) => new VRMLoaderPlugin(parser));

  return new Promise<VRM>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM | undefined;

        if (!vrm) {
          reject(new Error("Loaded GLTF does not contain a valid VRM avatar."));
          return;
        }

        try {
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
          VRMUtils.combineMorphs(vrm);

          vrm.scene.traverse((obj) => {
            obj.frustumCulled = false;
          });

          scene.add(vrm.scene);
          resolve(vrm);
        } catch (error) {
          reject(error);
        }
      },
      (progress) => {
        if (progress.total > 0) {
          console.log(
            `[VRM] Loading... ${((100 * progress.loaded) / progress.total).toFixed(0)}%`
          );
        }
      },
      (error) => reject(error)
    );
  });
}
