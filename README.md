# motion-study-with-me-poc

カメラ ＋ MediaPipe で「自分の動き」を 3D 仮想空間に同期する POC（技術検証）リポジトリ。

## Phase 1: カメラ ＋ MediaPipe 2D オーバーレイ

- カメラ映像を Pose Landmarker（lite）と Hand Landmarker で解析
- 画面上にスケルトン・手のランドマークを 2D オーバーレイ表示
- `worldLandmarks` を内部で保持。コンソールにサンプル出力

## Phase 2: Three.js 3D 空間（手の球体 ＋ 机）

- **左**: カメラ映像 ＋ ポーズ・手の 2D スケルトン
- **右**: Three.js シーン（グレーの机 ＋ 手の 21 点をオレンジの球体で表示）
- MediaPipe の `worldLandmarks` を Three.js 座標（Y 上・Z 反転）に変換してリアルタイム更新

### 起動方法

```bash
pnpm install
pnpm run dev
```

ブラウザで `http://localhost:5173` を開き、カメラ許可後に動作を確認してください。