/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Extra hosts allowed to load dev assets (comma separated). Set this when
  // previewing the dev server through a tunnel or a cloud preview hostname.
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS
    ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : undefined,
};

export default nextConfig;
