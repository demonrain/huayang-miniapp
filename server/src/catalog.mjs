export const templates = [
  {
    id: 'film-diary',
    name: '复古胶片日记',
    shortName: '胶片',
    category: 'life',
    description: '暖色颗粒与自然光感',
    cost: 2,
    badge: '人气',
    palette: 'linear-gradient(145deg, #f7b69f 0%, #f2d49a 52%, #9fd5c4 100%)',
    prompt: 'Transform the photo into an understated 1990s film diary photograph with warm natural light, organic grain, realistic skin texture, muted greens and amber highlights. Preserve identity, pose and composition. No text, no watermark.'
  },
  {
    id: 'editorial-portrait',
    name: '杂志感肖像',
    shortName: '肖像',
    category: 'portrait',
    description: '克制布光与高级质感',
    cost: 4,
    badge: '精选',
    palette: 'linear-gradient(160deg, #e9a8b5 0%, #f7c9c1 54%, #b9a9dc 100%)',
    prompt: 'Create a refined contemporary editorial portrait with directional studio lighting, a restrained neutral set, natural skin texture and premium magazine color grading. Preserve the person identity and facial structure. No text, no watermark.'
  },
  {
    id: 'watercolor-memory',
    name: '水彩记忆',
    shortName: '水彩',
    category: 'art',
    description: '轻盈晕染与纸张肌理',
    cost: 3,
    badge: '',
    palette: 'linear-gradient(140deg, #a9d9d0 0%, #c7dced 48%, #f6c4cb 100%)',
    prompt: 'Reinterpret the photo as an elegant hand-painted watercolor on textured cotton paper, with translucent washes, controlled edges and subtle pigment blooms. Preserve recognizable subjects and composition. No text, no watermark.'
  },
  {
    id: 'pet-studio',
    name: '宠物小画报',
    shortName: '萌宠',
    category: 'pet',
    description: '明快背景与棚拍光线',
    cost: 3,
    badge: '新上架',
    palette: 'linear-gradient(155deg, #80ccb7 0%, #bde5d5 51%, #f9d87d 52%, #f39aa7 100%)',
    prompt: 'Turn the pet photo into a joyful premium studio portrait with a clean colorful paper backdrop, softbox lighting, crisp fur detail and playful editorial framing. Preserve the pet markings and expression. No text, no watermark.'
  },
  {
    id: 'chinese-painting',
    name: '东方工笔',
    shortName: '工笔',
    category: 'art',
    description: '细腻线描与典雅设色',
    cost: 5,
    badge: '',
    palette: 'linear-gradient(135deg, #91c9b7 0%, #d8eadf 46%, #e99c9d 47%, #f4d9ba 100%)',
    prompt: 'Reinterpret the photo as refined Chinese gongbi painting on aged silk, using precise fine-line brushwork, elegant mineral colors and generous negative space. Preserve identity and important subject details. No calligraphy, no seals, no watermark.'
  },
  {
    id: 'city-cinema',
    name: '城市电影感',
    shortName: '电影',
    category: 'portrait',
    description: '宽银幕氛围与戏剧光影',
    cost: 4,
    badge: '',
    palette: 'linear-gradient(150deg, #8ab8c4 0%, #b8d9dd 54%, #f09991 55%, #f7c56f 100%)',
    prompt: 'Transform the photo into a cinematic urban still with realistic lighting, subtle teal shadows, warm practical highlights, controlled contrast and authentic film texture. Preserve identity, clothing and scene geometry. No text, no watermark.'
  }
]

export const creditPackages = [
  { id: 'starter', credits: 30, bonus: 0, priceFen: 600, badge: '' },
  { id: 'popular', credits: 80, bonus: 10, priceFen: 1500, badge: '推荐' },
  { id: 'creator', credits: 180, bonus: 30, priceFen: 3000, badge: '多送 30' },
  { id: 'studio', credits: 400, bonus: 80, priceFen: 6000, badge: '最划算' }
]

export function publicTemplates() {
  return templates.map(({ prompt, ...template }) => template)
}

export function publicPackages() {
  return creditPackages.map(item => ({ ...item, priceYuan: (item.priceFen / 100).toFixed(2) }))
}
