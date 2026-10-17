import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url).href);
export default defineConfig({
  root: "preview",
  resolve: {
    alias: [
      { find: "@getpaseo/plugin/client/react-native", replacement: local("./preview/host-ui.tsx") },
      { find: "@getpaseo/plugin/client", replacement: local("./preview/host-sdk.tsx") },
      { find: /^react-native$/, replacement: "react-native-web" },
    ],
  },
  server: { port: 5178, strictPort: true },
  define: { __DEV__: "true" },
});
