import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Jigri",
        short_name: "Jigri",
        description: "Jigri is a social media app for staying connected, sharing moments, and enjoying a smoother app-like experience.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#09090b",
        theme_color: "#7c3aed",
        categories: ["social", "lifestyle", "communication"],
        lang: "en-IN",
        icons: [
            {
                src: "/assets/images/App%20icon%20share.png",
                sizes: "2000x2000",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/assets/images/App%20Icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "maskable",
            },
        ],
        screenshots: [
            {
                src: "/assets/images/side-img.svg",
                sizes: "1248x2208",
                type: "image/svg+xml",
                form_factor: "wide",
            },
        ],
    };
}