import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CONVERTILABS_LOCAL_APP === "1" ? ".next-local" : ".next",
  async redirects() {
    return ["/", "/about", "/api", "/contact", "/pricing", "/product", "/signup"].map(
      (source) => ({
        source,
        destination: "/login",
        permanent: false,
      }),
    );
  },
};

export default nextConfig;
