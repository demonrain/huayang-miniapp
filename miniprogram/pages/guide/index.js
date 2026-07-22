const { getNavMetrics } = require('../../utils/nav')

const DEMO_STYLES = [
  {
    id: 'demo-portrait',
    name: '暖阳人像',
    shortName: '暖阳',
    description: '柔和光感，保留五官神态',
    cost: 4,
    palette: 'linear-gradient(145deg, #ffd4c8 0%, #f7a9b8 55%, #e88a9a 100%)',
    badge: '人像'
  },
  {
    id: 'demo-life',
    name: '胶片生活',
    shortName: '胶片',
    description: '复古色调，生活感瞬间',
    cost: 4,
    palette: 'linear-gradient(145deg, #d4e8e2 0%, #a8cfc4 50%, #7eb5a8 100%)',
    badge: '生活'
  },
  {
    id: 'demo-art',
    name: '水墨意境',
    shortName: '水墨',
    description: '国风渲染，诗意氛围',
    cost: 5,
    palette: 'linear-gradient(145deg, #e8e4f0 0%, #c4b8dc 50%, #9a8bc4 100%)',
    badge: '艺术'
  }
]

const DEMO_PHOTOS = [
  {
    id: 'photo-portrait',
    label: '人像样例',
    hint: '适合暖阳人像',
    emoji: '🙂',
    tone: '#ffe8ec'
  },
  {
    id: 'photo-pet',
    label: '宠物样例',
    hint: '毛孩子也行',
    emoji: '🐱',
    tone: '#e9f7f2'
  },
  {
    id: 'photo-life',
    label: '生活样例',
    hint: '日常随拍',
    emoji: '📷',
    tone: '#fff6e8'
  }
]

const GEN_TIPS = [
  '正在理解你的照片构图…',
  '把风格滤镜轻轻铺上去…',
  '调整光影与色彩平衡…',
  '最后精修细节，马上完成'
]

Page({
  data: {
    navSpacer: 176,
    step: 0,
    // 0 welcome, 1 style, 2 photo, 3 confirm, 4 generating, 5 result
    totalSteps: 4,
    stepLabels: ['选风格', '选照片', '确认生成', '看结果'],
    styles: DEMO_STYLES,
    selectedStyleId: '',
    selectedStyle: null,
    demoPhotos: DEMO_PHOTOS,
    selectedPhotoId: '',
    photoPath: '',
    photoIsDemo: true,
    photoLabel: '',
    totalCost: 0,
    genTip: GEN_TIPS[0],
    genProgress: 0,
    welcomeCredits: 20,
    visualIndex: 0,
    photoEmoji: '',
    photoTone: '#f4eaec'
  },

  onLoad(query) {
    this.setData({
      ...getNavMetrics(),
      welcomeCredits: Number(query.credits) || 20
    })
    this._timers = []
  },

  onUnload() {
    this.clearTimers()
  },

  clearTimers() {
    if (!this._timers) return
    this._timers.forEach(id => {
      clearTimeout(id)
      clearInterval(id)
    })
    this._timers = []
  },

  markDone() {
    wx.setStorageSync('huayang_onboarding_done', '1')
  },

  /** Progress pill: map internal step → 1–4 visual */
  visualStep(step) {
    if (step <= 0) return 0
    if (step === 1) return 1
    if (step === 2) return 2
    if (step === 3 || step === 4) return 3
    return 4
  },

  goStep(step) {
    this.setData({ step, visualIndex: this.visualStep(step) })
  },

  startGuide() {
    this.goStep(1)
  },

  skipAll() {
    this.markDone()
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/index' })
    })
  },

  selectStyle(event) {
    const id = event.currentTarget.dataset.id
    const selectedStyle = this.data.styles.find(item => item.id === id)
    if (!selectedStyle) return
    this.setData({
      selectedStyleId: id,
      selectedStyle,
      totalCost: selectedStyle.cost
    })
  },

  nextFromStyle() {
    if (!this.data.selectedStyle) {
      wx.showToast({ title: '先点选一个风格', icon: 'none' })
      return
    }
    this.goStep(2)
  },

  selectDemoPhoto(event) {
    const id = event.currentTarget.dataset.id
    const photo = this.data.demoPhotos.find(item => item.id === id)
    if (!photo) return
    this.setData({
      selectedPhotoId: id,
      photoPath: '',
      photoIsDemo: true,
      photoLabel: photo.label,
      photoEmoji: photo.emoji,
      photoTone: photo.tone
    })
  },

  chooseRealPhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        const file = tempFiles && tempFiles[0]
        if (!file) return
        this.setData({
          selectedPhotoId: 'real',
          photoPath: file.tempFilePath,
          photoIsDemo: false,
          photoLabel: '我的照片',
          photoEmoji: '',
          photoTone: '#f0e3e5'
        })
      }
    })
  },

  nextFromPhoto() {
    if (!this.data.selectedPhotoId) {
      wx.showToast({ title: '请选一张示例或相册照片', icon: 'none' })
      return
    }
    this.goStep(3)
  },

  backStep() {
    const step = this.data.step
    if (step <= 1) {
      this.goStep(0)
      return
    }
    if (step === 4) return
    this.goStep(step - 1)
  },

  confirmGenerate() {
    if (!this.data.selectedStyle || !this.data.selectedPhotoId) return
    this.goStep(4)
    this.runFakeGenerate()
  },

  runFakeGenerate() {
    this.clearTimers()
    this.setData({ genTip: GEN_TIPS[0], genProgress: 8 })
    let tipIndex = 0
    let progress = 8

    const tipTimer = setInterval(() => {
      tipIndex = Math.min(tipIndex + 1, GEN_TIPS.length - 1)
      this.setData({ genTip: GEN_TIPS[tipIndex] })
    }, 900)
    this._timers.push(tipTimer)

    const progressTimer = setInterval(() => {
      progress = Math.min(progress + 12 + Math.floor(Math.random() * 10), 96)
      this.setData({ genProgress: progress })
    }, 450)
    this._timers.push(progressTimer)

    const doneTimer = setTimeout(() => {
      this.clearTimers()
      this.setData({ genProgress: 100, genTip: '完成啦！' })
      const finish = setTimeout(() => {
        this.goStep(5)
        this.markDone()
      }, 480)
      this._timers.push(finish)
    }, 3600)
    this._timers.push(doneTimer)
  },

  goRealCreate() {
    this.markDone()
    // Prefer home so user picks a real template like production flow
    wx.switchTab({ url: '/pages/home/index' })
    wx.showToast({ title: '点首页风格卡片开始', icon: 'none', duration: 2500 })
  },

  replay() {
    this.clearTimers()
    this.setData({
      step: 1,
      visualIndex: 1,
      selectedStyleId: '',
      selectedStyle: null,
      selectedPhotoId: '',
      photoPath: '',
      photoIsDemo: true,
      photoLabel: '',
      totalCost: 0,
      genProgress: 0
    })
  }
})
