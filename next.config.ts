import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://person-blog-sage.vercel.app",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://person-blog-sage.vercel.app http://localhost:*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
