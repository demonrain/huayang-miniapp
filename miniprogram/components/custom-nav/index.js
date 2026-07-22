const { getNavMetrics } = require('../../utils/nav')

Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    credits: {
      type: null,
      value: null
    },
    showCredit: {
      type: Boolean,
      value: true
    },
    showBack: {
      type: Boolean,
      value: false
    }
  },

  data: {
    navBarHeight: 88,
    navRowTop: 48,
    navRowHeight: 32,
    navRowRight: 96
  },

  lifetimes: {
    attached() {
      this.setData(getNavMetrics())
    }
  },

  methods: {
    openWallet() {
      // Open credit redeem page (login required inside the page)
      wx.navigateTo({
        url: '/pages/redeem/index',
        fail: () => wx.switchTab({ url: '/pages/profile/index' })
      })
    },

    goBack() {
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/home/index' })
      })
    }
  }
})
