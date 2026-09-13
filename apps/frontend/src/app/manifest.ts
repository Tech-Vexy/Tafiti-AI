// @ts-nocheck
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tafiti AI",
    short_name: "Tafiti",
    description: "AI synthesis, gap analysis, and systematic review tools for academic researchers across Africa.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#030305",
    theme_color: "#030305",
    categories: ["productivity", "education", "research", "ai"],
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
    ]
  };
}
