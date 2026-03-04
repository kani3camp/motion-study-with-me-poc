/** MediaPipe world 座標の 1 点（x, y, z メートル） */
export type WorldLandmark = { x: number; y: number; z: number };

export const CONFIG = {
  video: {
    width: 640,
    height: 480,
  },
  models: {
    pose:
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    hand:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  },
  /** フレーム間引き: 2 フレームに 1 回解析（約 15fps）で負荷軽減 */
  detectInterval: 2,
  status: {
    startingCamera: "カメラを起動しています…",
    loadingMediaPipe: "MediaPipe を読み込んでいます…",
    ready:
      "認識中… 左: カメラ+骨格 / 右: 3D 空間（胴体+手+机）",
  },
} as const;
