import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Ordblikk",
        short_name: "Ordblikk",
        description: "Leseøving for barn: ordbilder, korte setninger og lynrunde.",
        lang: "nb",
        start_url: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#e6eef5",
        theme_color: "#e6eef5",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Norwegian only needs the basic latin font subset offline.
        globIgnores: ["**/*-{latin-ext,cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*"],
      },
    }),
  ],
});
