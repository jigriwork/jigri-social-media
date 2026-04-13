/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent local dev/build cache collisions on Windows when both commands are run close together.
  // Dev writes to .next-dev, production build/start keep using .next.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Force no-cache for HTML & SW to prevent stale versions on CDN/browser
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Jigri-Version', value: Date.now().toString() },
        ],
      },
    ]
  },
}

module.exports = nextConfig
