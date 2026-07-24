import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDir = path.join(process.cwd(), 'node_modules', 'lucide-static', 'icons')
const outputDir = path.join(process.cwd(), 'miniprogram', 'assets', 'icons')

const tabIcons = {
  create: 'wand-sparkles',
  works: 'images',
  gallery: 'flower',
  wallet: 'coins',
  profile: 'user-round'
}

const actionIcons = {
  download: 'download',
  'image-share': 'image-up',
  share: 'send',
  moments: 'aperture',
  'qr-code': 'qr-code',
  link: 'link',
  pencil: 'pencil'
}

// White icons for solid badges (avatar camera chip, etc.)
const solidWhiteIcons = {
  camera: 'camera'
}

// White variants used on coral primary buttons
const buttonIcons = {
  sparkles: 'sparkles',
  'wand-sparkles': 'wand-sparkles'
}

async function render(iconName, filename, color, size = 81, { fill = 'none' } = {}) {
  const source = await readFile(path.join(sourceDir, `${iconName}.svg`), 'utf8')
  let svg = source
    .replace('stroke="currentColor"', `stroke="${color}"`)
    .replace(/fill="none"/, `fill="${fill}"`)
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('viewBox="0 0 24 24"', 'viewBox="-4 -4 32 32"')
  await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, filename))
}

await mkdir(outputDir, { recursive: true })

for (const [name, icon] of Object.entries(tabIcons)) {
  await render(icon, `${name}.png`, '#9a929a')
  await render(icon, `${name}-active.png`, '#e76d82')
}

for (const [name, icon] of Object.entries(actionIcons)) {
  await render(icon, `${name}.png`, '#655f66', 72)
}

for (const [name, icon] of Object.entries(buttonIcons)) {
  await render(icon, `${name}.png`, '#ffffff', 72)
}

for (const [name, icon] of Object.entries(solidWhiteIcons)) {
  await render(icon, `${name}.png`, '#ffffff', 64)
}

// 花海「送花」：双花 / 单花（描边=未送，填充=已送）
await render('flower-2', 'like.png', '#c56f60', 72, { fill: 'none' })
await render('flower-2', 'like-active.png', '#e76d82', 72, { fill: '#f8a0ad' })
await render('flower-2', 'flower-gift.png', '#c56f60', 72, { fill: 'none' })
await render('flower-2', 'flower-gift-active.png', '#e76d82', 72, { fill: '#f8a0ad' })

console.log(`Generated ${Object.keys(tabIcons).length * 2 + Object.keys(actionIcons).length + Object.keys(buttonIcons).length + Object.keys(solidWhiteIcons).length + 4} Lucide PNG icons.`)
