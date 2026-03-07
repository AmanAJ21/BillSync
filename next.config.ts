import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['mongodb', 'bcryptjs', 'jsonwebtoken', 'nodemailer', 'pdfkit'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle pdfkit and its dependencies
      config.externals = config.externals || [];
      config.externals.push({
        'pdfkit': 'commonjs pdfkit',
        'canvas': 'commonjs canvas',
      });
    }
    return config;
  },
};

export default nextConfig;

