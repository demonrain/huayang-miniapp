/** Per-image generation time estimate: 2–5 minutes each. */

function estimateRange(count) {
  const n = Math.max(1, Number(count) || 1)
  return {
    count: n,
    minMinutes: n * 2,
    maxMinutes: n * 5
  }
}

function formatEtaRange(count) {
  const { minMinutes, maxMinutes } = estimateRange(count)
  if (minMinutes === maxMinutes) return `${minMinutes} 分钟`
  return `${minMinutes}–${maxMinutes} 分钟`
}

function etaStatusText(count) {
  return `预计 ${formatEtaRange(count)}`
}

function etaNoteText(count) {
  const { count: n } = estimateRange(count)
  if (n <= 1) {
    return `每张大约需要 2–5 分钟。你可以先去做别的事情；完成后会通过微信消息提醒你，也可随时在「作品」里查看进度。`
  }
  return `共 ${n} 张，按每张 2–5 分钟估算约需 ${formatEtaRange(n)}。你可以先去做别的事情；完成后会通过微信消息提醒你，也可随时在「作品」里查看进度。`
}

function waitingTipsForCount(count) {
  const range = formatEtaRange(count)
  return [
    `大约 ${range} 就好，先去刷会儿手机也行`,
    '画笔正在热身，颜料也在排队喝咖啡…',
    '完成后会发微信提醒，你先忙别的也没关系',
    'AI 在认真数你的睫毛，请再给它一点点耐心',
    '光影调色中：少一点滤镜感，多一点心动感',
    '正在给照片浇水施肥，马上就开花',
    '像素们正在手拉手换装，场面有点热闹',
    '大师在琢磨构图，灵感还在路上堵车',
    '好作品值得等待，就像花期总在不经意间到来',
    '后台小精灵加班中，结果出来会喊你一声',
    '正在把平凡瞬间酿成一点点魔法',
    'AI 说：再等我五秒…好吧可能是五十秒'
  ]
}

module.exports = {
  estimateRange,
  formatEtaRange,
  etaStatusText,
  etaNoteText,
  waitingTipsForCount
}
