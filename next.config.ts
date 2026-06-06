import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Three.js + R3F need to be transpiled for Next.js App Router
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei", "maath"],
};

export default nextConfig;
