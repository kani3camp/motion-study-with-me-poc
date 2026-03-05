import { defineConfig } from "vite";

export default defineConfig({
  // カメラ利用のため HTTPS または localhost で動作させる
  server: {
    port: 5173,
  },
});
