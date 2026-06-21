import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Country Day Camp Swim Portal",
    short_name: "Swim Portal",
    description: "Swim lesson schedules for Rolling Hills Country Day School Summer Camp.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfaf5",
    theme_color: "#407a5b",
    icons: [
      { src: "/camp-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/camp-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
