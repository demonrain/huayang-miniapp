function getNavMetrics() {
  const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const menuButton = wx.getMenuButtonBoundingClientRect()
  const gap = 8
  // Extra space left of the WeChat capsule (menu/close) so credit pill doesn't crowd it
  const capsuleGap = 14
  const navBarHeight = Math.round((menuButton.bottom || 0) + gap)
  const windowWidth = windowInfo.windowWidth || 375
  const navSpacer = Math.ceil(navBarHeight * 750 / windowWidth)
  const menuLeft = menuButton.left || windowWidth
  const navRowRight = Math.max(12, Math.round(windowWidth - menuLeft + gap + capsuleGap))

  return {
    navSpacer,
    navBarHeight,
    navRowTop: Math.round(menuButton.top || 0),
    navRowHeight: Math.round(menuButton.height || 32),
    navRowRight
  }
}

module.exports = {
  getNavMetrics
}
