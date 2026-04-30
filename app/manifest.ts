import type { MetadataRoute } from "next";

// PWA manifest — installed app/home-screen icon, name, theme.
// Used when a user "Add to Home Screen" on iOS/Android, or installs as a
// standalone PWA on desktop Chrome. The 192/512 PNGs live in public/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ControlTower",
    short_name: "ControlTower",
    description:
      "RedEye autonomous dev agent dashboard — monitor and manage AI coding sessions",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
