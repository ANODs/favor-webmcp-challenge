import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  deploymentId: process.env.NEXT_DEPLOYMENT_ID?.trim() || undefined,
};

export default withNextIntl(nextConfig);
