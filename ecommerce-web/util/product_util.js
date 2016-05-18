var config = require('../config'),
    http_util = require('./http_util'),
    cart_util = require('./cart_util'),
    image_util = require('./image_util');

var COOKIE_OPTIONS = config.cookie.track.options,
    RECENT_VIEWED_SKU_IDS_COOKIE_KEY = '_RECENT_VIEWED';

module.exports = {
  recentViewedSkuIdsFromCookie: recentViewedSkuIdsFromCookie,
  requestForRecommendSkuIds: requestForRecommendSkuIds,
  // ---- page rendering
  renderProductTag: renderProductTag,
  renderProductSaleStatus: renderProductSaleStatus,
  renderProductOriginLogo: renderProductOriginLogo,
  productCouldSell: productCouldSell,
  getPriceLabel: getPriceLabel,
  getOrderPromotionLabelShort: getOrderPromotionLabelShort,
  getPromotionActivityName: getPromotionActivityName,
  getOrderPromotionTypeName: getOrderPromotionTypeName,
  getProductPromotionTypeName: getProductPromotionTypeName,
  renderProductStock: renderProductStock,
  getProductRestrictStr: getProductRestrictStr,
  getPromotionCommissionFeeForUser: getPromotionCommissionFeeForUser,
  renderProductDetail: renderProductDetail,
  renderProductDetailMobile: renderProductDetailMobile,
  getFreightMethodNameWithBr: getFreightMethodNameWithBr,
  formatProductWeight: formatProductWeight
};


/**
 * 从cookie中读取最近浏览过的商品，并把指定的skuId加入cookie
 *
 * @param req
 * @param res  配合本次正在浏览的商品skuId；如果为空，仅返回cookie中最近浏览过的商品
 * @param skuId  传入的skuId必须是string (IMPORTANT)
 * @returns 返回的结果是之前浏览过的商品，不包含指定的skuId
 */
function recentViewedSkuIdsFromCookie(req, res, skuId) {
  var recentViewedSkuIds = req.cookies[RECENT_VIEWED_SKU_IDS_COOKIE_KEY];
  if (recentViewedSkuIds) {
    recentViewedSkuIds = recentViewedSkuIds.split(',');
  } else {
    recentViewedSkuIds = [];
  }
  if (res && skuId) {
    var idx = recentViewedSkuIds.indexOf(skuId);
    if (idx > -1) {
      recentViewedSkuIds.splice(idx, 1);  // 剔除掉相同的skuId
    } else if (recentViewedSkuIds.length >= 10) {
      recentViewedSkuIds.pop();  // 最多保留10个
    }
    var recentViewedSkuIdsNew = recentViewedSkuIds.slice();
    recentViewedSkuIdsNew.unshift(skuId);
    res.cookie(RECENT_VIEWED_SKU_IDS_COOKIE_KEY, recentViewedSkuIdsNew.join(','), COOKIE_OPTIONS);
  }
  return recentViewedSkuIds;
}

/**
 * 请求推荐的商品(SKU_ID)
 *
 * @param req
 * @param excludeSkuId
 * @param recentViewedSkuIds
 * @returns  request promise
 */
function requestForRecommendSkuIds(req, excludeSkuId, recentViewedSkuIds) {
  var data = {};
  if (req.user) data.userId = req.user.id;
  if (excludeSkuId) data.excludeSkuId = excludeSkuId;
  if (!recentViewedSkuIds) recentViewedSkuIds = recentViewedSkuIdsFromCookie(req);
  if (recentViewedSkuIds && recentViewedSkuIds.length) {
    data.recentViewedSkuIds = recentViewedSkuIds.join(',');
  }
  if (!req.user) {
    // 如果用户已经登录，后台可以从数据库表里获取购物车商品
    var recentCartSkuIds = cart_util.getCartSkuIdsFromCookie(req);
    if (recentCartSkuIds && recentCartSkuIds.length) {
      data.recentCartSkuIds = recentCartSkuIds.join(',');
    }
  }
  return http_util.request('facade', {
    method: 'POST',
    url: '/product/recommend',
    data: data
  });
}


// ------------------------------------------------------------------------
// The followings are used for page rendering
// ------------------------------------------------------------------------

/**
 * 渲染商品标签
 * @param aTag  表示一个附加标签
 */
function renderProductTag(productSummary, aTag) {
  /*var tagName;
  switch (productSummary.tag) {
  case 'PARTICULAR':
    tagName = '精品';
    break;
  case 'HOT_SALE':
    tagName = '热卖';
    break;
  case 'NEW':
    tagName = '新品';
    break;
  default:
    return '';
  }*/
  // LxC(2016-04-20): 
  var tagName = productSummary.tagName;
  if (!tagName) return '';
  if (aTag) {
    return '<span class="mark"><' + aTag + '>' + tagName + '</' + aTag + '></span>';
  } else {
    return '<span class="mark">' + tagName + '</span>';
  }
}

/**
 * 渲染商品销售状态，主要是“已抢光”和“已下架”两种
 * @param wapLarge  在wap下“已抢光”和“已下架”有2种图片，一种大，一种小
 */
function renderProductSaleStatus(productSummary, wapLarge) {
  if (productSummary.saleStatus !== 'ON_SALE') {
    if (wapLarge) {
      return '<span class="largeSold"></span>';
    } else {
      return '<span class="under-shelf"></span>';
    }
  }
  if (productSummary.stockStatus === 'OUT_OF_STOCK') {
    if (wapLarge) {
      return '<span class="largerobbed"></span>';
    } else {
      return '<span class="robbed-light"></span>';
    }
  }
  return '';
}

function renderProductOriginLogo(productSummary, width, height, cls) {
  if (productSummary.productOriginLogoUrl) {
    return '<img src="' + image_util.getImageUrlPNG(productSummary.productOriginLogoUrl, width, height) + '"' + (cls ? (' class="' + cls + '"') : '') + '/>';
  }
  return '';
}

function productCouldSell(productSummary) {
  return productSummary.saleStatus === 'ON_SALE' && productSummary.stockStatus !== 'OUT_OF_STOCK';
}

function getPriceLabel(productSummary) {
  return productSummary.promotionPrice ? '促销价' : '售价';
}

function getOrderPromotionLabelShort(activityLabel) {
  var labelShort = '惠';
  if (activityLabel) {
    if (activityLabel.indexOf('减') > -1) {
      labelShort = '减';
    } else if (activityLabel.indexOf('折') > -1) {
      labelShort = '折';
    }
  }
  return labelShort;
}

function getPromotionActivityName(activityType) {
  switch (activityType) {
  case 'PRODUCT_PROMOTION':
    return '商品促销';
  case 'ORDER_PROMOTION':
    return '订单促销';
  case 'FLASH_SALE':
    return '限时抢购';
  default:
    return '';
  }
}

function getOrderPromotionTypeName(type) {
  switch (type) {
  case 'REDUCTION':
    return '满额立减';
  case 'DISCOUNT':
    return '满额打折';
  default:
    return '';
  }
}

function getProductPromotionTypeName(type) {
  switch (type) {
  case 'FIXED_PRICE':
    return '一口价';
  case 'REDUCTION':
    return '立减优惠';
  case 'DISCOUNT':
    return '打折优惠';
  default:
    return '';
  }
}

function renderProductStock(productDetail) {
  var productSummary = productDetail.productSummary,
      productUnit = productSummary.productUnit || '件',
      html, allNum;
  if (productSummary.restrictBy && productSummary.restrictNumber) {
    var restrictByStr = '';
    switch (productSummary.restrictBy) {
    case 'ORDER':
      restrictByStr = '每单限购';
      break;
    case 'USER_PER_ACTIVITY':
      restrictByStr = '本次活动限购';
      break;
    default:
      throw new TypeError('Unknown restrictBy enum: ' + restrictBy);
    }
    html = '<span class="light-grey">库存 ' + productDetail.stockForSale + ' ' + productUnit +
           ' (' + restrictByStr + ' ' + productSummary.restrictNumber + ' ' + productUnit + ')</span>';
    allNum = Math.min(productDetail.stockForSale, productSummary.restrictNumber);
  } else {
    html = '<span class="light-grey">库存 ' + productDetail.stockForSale + ' ' + productUnit + '</span>';
    allNum = productDetail.stockForSale;
  }
  html += '<input type="hidden" id="allNum" value="' + allNum + '"/>';
  return html;
}

function getProductRestrictStr(productSummary) {
  if (productSummary.restrictBy && productSummary.restrictNumber) {
    var restrictByStr = '';
    switch (productSummary.restrictBy) {
    case 'ORDER':
      restrictByStr = '每单限购';
      break;
    case 'USER_PER_DAY':
      restrictByStr = '每人每天限购';
      break;
    case 'USER_PER_ACTIVITY':
      restrictByStr = '本次活动限购';
      break;
    default:
      throw new TypeError('Unknown restrictBy enum: ' + restrictBy);
    }
    return restrictByStr + productSummary.restrictNumber + (productSummary.productUnit || '件');
  }
  return '';
}

function getPromotionCommissionFeeForUser(user, productSummary) {
  if (!user || !user.commissionRate || !productSummary.promotionCommissionFee) return null;
  return productSummary.promotionCommissionFee * user.commissionRate;
}

function renderProductDetail(description) {
  if (!description) return '该商品没有添加说明';
  return image_util.filterHtmlContent(description, 790, true);
}

var PIC_LAZY_MOBILE = 'class="lazy" src="' + image_util.getStaticImgWap('bg_logo_640x450.gif') + '" data-original="';
function renderProductDetailMobile(mobileDescription) {
  if (!mobileDescription) return '该商品没有添加说明';
  return image_util.filterHtmlContent(mobileDescription, 640, false)
            .replace(/style="[^"]*"/g, '')
            .replace(/src="/g, PIC_LAZY_MOBILE);
}

function getFreightMethodNameWithBr(freightMethodName) {
  if (!freightMethodName) return '';
  switch (freightMethodName.length) {
  case 1: case 2: case 3: break;
  case 4: freightMethodName = freightMethodName.substring(0,2) + '<br/>' + freightMethodName.substring(2); break;
  case 5: case 6: freightMethodName = freightMethodName.substring(0,3) + '<br/>' + freightMethodName.substring(3); break;
  default: freightMethodName = freightMethodName.substring(0,3) + '<br/>' + freightMethodName.substring(3, 6); break;
  }
  return freightMethodName;
}

function formatProductWeight(weight) {
  if (!weight) return '0g';
  if (weight < 1000) {
    return weight + 'g';
  }
  weight /= 1000;
  return weight + 'kg';
}

