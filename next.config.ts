import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    localPatterns: [
      {
        pathname: "/api/projects/*/slides/*/image",
        search: "",
      },
      {
        pathname: "/api/projects/*/slides/*/image",
        search: "?variant=thumbnail",
      },
      {
        pathname: "/brand/**",
        search: "",
      },
      {
        pathname: "/states/**",
        search: "",
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
