import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { functionDecoratorPlugin } from "ts-fun-decorator/vite";

export default defineConfig({
  resolve: {
    preserveSymlinks: true
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /PURE_FUNC_DERECTORE/]
    }
  },
  plugins: [functionDecoratorPlugin(), react()]
});