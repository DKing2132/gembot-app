/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, options) => {
    // set node __dirname to true
    config.node = { __dirname: true };

    return config;
  },
};

module.exports = nextConfig;
