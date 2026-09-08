import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // sherpa-onnx-node는 네이티브 애드온이라 번들링하면 안 된다.
  serverExternalPackages: ["sherpa-onnx-node"],
  // 트레이싱은 .node 파일만 잡고 동반 공유 라이브러리(.so/.dylib)를 놓친다.
  // 플랫폼 패키지를 통째로 포함시켜야 standalone 빌드에서 로드된다.
  outputFileTracingIncludes: {
    "/api/diarize": ["./node_modules/sherpa-onnx-*/**"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
