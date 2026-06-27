import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CONSULTATION_PRICE_INR:
      process.env.CONSULTATION_PRICE_INR ?? "151",
    NEXT_PUBLIC_CONSULTATION_DURATION_MINUTES:
      process.env.CONSULTATION_DURATION_MINUTES ?? "15",
  },
};

export default nextConfig;
