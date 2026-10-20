import { defineConfig } from "vite";
// Retain the original Vite 5 browser baseline after upgrading the development server.
export default defineConfig({
  build: { target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"] },
});
