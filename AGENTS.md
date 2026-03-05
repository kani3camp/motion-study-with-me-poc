# AGENTS.md

## Cursor Cloud specific instructions

This is a Vite + TypeScript frontend app using MediaPipe (hand/pose detection) and Three.js (3D rendering). There is no backend service.

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Vite dev server | `pnpm run dev` | 5173 | Only service; serves the frontend app |

### Key commands

- **Dev server**: `pnpm run dev` (Vite, port 5173)
- **Build**: `pnpm run build` (runs `tsc -b && vite build`)
- **Type check only**: `npx tsc -b --noEmit`
- No dedicated lint command or test framework is configured yet.

### Caveats

- **esbuild build scripts**: `pnpm.onlyBuiltDependencies` in `package.json` must include `"esbuild"` for Vite to work. Without it, pnpm skips the esbuild postinstall and the dev server will fail.
- **Camera access**: The app requires camera hardware (`navigator.mediaDevices.getUserMedia`). In headless/VM environments without a camera, the 3D scene and VRM avatar still load and render, but MediaPipe detection is skipped.
- **Debug agent logs**: If you see any `// #region agent log` blocks with `fetch('http://127.0.0.1:7242/ingest/...')` (or similar) calls in source files, they are leftover debug instrumentation from a previous agent session and **must be removed before merging**.
