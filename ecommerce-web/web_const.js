// 常亮
module.exports = {
  // 搜索页、购物车等页面，最近浏览商品显示数量
  RECENT_VIEWED_MAX_COUNT: 8,
  // 商品详情页，最近浏览商品显示数量
  RECENT_VIEWED_MAX_COUNT_PRODUCT_PAGE: 4,
  // 搜索页，如果分页，每页显示的结果
  SEARCH_RESULT_PAGE_SIZE: 20,
  // WAP分页，每页显示数量
  WAP_PAGINATION_SIZE: 10,
  // 微信支付url(用来生成二维码)
  FLASH_KEY_OF_WECHAT_CODE_URL: 'FLASH_KEY_OF_WECHAT_CODE_URL',
  // 用户未登录，添加商品到购物车的时候，暂时保存到cookie中
  CART_COOKIE_KEY: '_CART',
  // 保存推广用户id
  USER_REFERRAL_COOKIE_KEY: '_REFERRAL',
  // 重要公告cookie前缀
  SITE_NOTICE_VIEWED_PREFIX: '_NV_',
  // 微信OAuth跳转url，@see routes/wap/weixin.js
  WEIXIN_OAUTH_REDIRECT_URI: '/wap/weixin-oauth.html'
};