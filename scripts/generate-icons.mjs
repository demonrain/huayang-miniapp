import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDir = path.join(process.cwd(), 'node_modules', 'lucide-static', 'icons')
const outputDir = path.join(process.cwd(), 'miniprogram', 'assets', 'icons')

const tabIcons = {
  create: 'wand-sparkles',
  works: 'images',
  wallet: 'coins',
  profile: 'user-round'
}

const actionIcons = {
  download: 'download',
  'image-share': 'image-up',
  share: 'send',
  moments: 'aperture',
  'qr-code': 'qr-code',
  link: 'link'
}

async function render(iconName, filename, color, size = 81) {
  const source = await readFile(path.join(sourceDir, `${iconName}.svg`), 'utf8')
  const svg = source
    .replace('stroke="currentColor"', `stroke="${color}"`)
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

console.log(`Generated ${Object.keys(tabIcons).length * 2 + Object.keys(actionIcons).length} Lucide PNG icons.`)
