import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 서로ON 브랜드 색상
        primary: '#F97316',   // orange-500 — 메인 CTA
        background: '#FFF8F0', // 따뜻한 크림 배경
      },
    },
  },
  plugins: [],
};

export default config;
