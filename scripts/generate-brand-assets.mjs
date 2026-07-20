import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outputDir = path.resolve('miniprogram/assets/branding')
await mkdir(outputDir, { recursive: true })

const avatar = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="#fff9f8"/>
  <rect x="224" y="238" width="492" height="548" rx="54" fill="#dff3ec" transform="rotate(-8 470 512)"/>
  <rect x="305" y="214" width="492" height="548" rx="54" fill="#ffffff" stroke="#f2dfe3" stroke-width="18" transform="rotate(7 551 488)"/>
  <rect x="365" y="300" width="372" height="344" rx="30" fill="#bfe4d8" transform="rotate(7 551 472)"/>
  <circle cx="612" cy="410" r="58" fill="#ffd978"/>
  <path d="M371 610 C453 490 544 545 604 480 C653 427 718 479 754 544 L754 660 L360 660 Z" fill="#72bca8" transform="rotate(7 557 570)"/>
  <g transform="translate(252 582) rotate(-10)">
    <ellipse cx="150" cy="58" rx="72" ry="112" fill="#f28fa0"/>
    <ellipse cx="242" cy="150" rx="112" ry="72" fill="#ee7e92"/>
    <ellipse cx="150" cy="242" rx="72" ry="112" fill="#f6a2af"/>
    <ellipse cx="58" cy="150" rx="112" ry="72" fill="#e76d82"/>
    <circle cx="150" cy="150" r="62" fill="#ffd978" stroke="#fff9f8" stroke-width="18"/>
  </g>
  <path d="M332 808 C400 792 446 820 467 876 C405 895 356 869 332 808 Z" fill="#58ad99"/>
</svg>`

await sharp(Buffer.from(avatar))
  .png({ compressionLevel: 9, palette: true })
  .toFile(path.join(outputDir, 'app-avatar.png'))

console.log(`Generated ${path.join(outputDir, 'app-avatar.png')}`)
