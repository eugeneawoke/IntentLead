import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Three.js + R3F need to be transpiled for Next.js App Router
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei", "maath"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
