import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mppx has optional MCP imports; load it from node_modules at runtime instead of bundling.
  serverExternalPackages: ["pg", "mppx"],
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Link", value: '</openapi.json>; rel="service-desc", </llms.txt>; rel="describedby"' }],
      },
    ];
  },
};

export default nextConfig;
