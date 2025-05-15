import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3001/api/:path*', // Proxy to backend
            },
        ];
    },
};

export default nextConfig;
