import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",  // Allow external connections
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://172.16.3.171:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://172.16.3.171:3001',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
