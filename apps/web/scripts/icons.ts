// Renders the home-screen icons from public/icon.svg: pnpm --filter @ecoproof/web icons
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const pub = new URL('../public/', import.meta.url);
const svg = readFileSync(new URL('icon.svg', pub));

const sizes: [string, number][] = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of sizes) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(new URL(name, pub).pathname);
  console.log(`wrote public/${name} (${size}px)`);
}
