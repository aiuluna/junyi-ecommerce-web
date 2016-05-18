var express = require('express'),
    config = require('../../config'),
    logger = require('../../logger'),
    web_const = require('../../web_const'),
    common_data = require('../../common_data'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    product_util = require('../../util/product_util'),
    image_util = require('../../util/image_util');

var SITE_NOTICE_VIEWED_PREFIX = web_const.SITE_NOTICE_VIEWED_PREFIX;

var router = express.Router();

/* home page. */
router.get('/', common_util.userReferralHook, renderHomepage);
router.get('/index', common_util.userReferralHook, renderHomepage);

// 当前或下期“限时抢购”
router.get('/flash/:currentOrNext', common_util.userReferralHook, renderFlashCurrentOrNext);

function renderHomepage(req, res, next) {
  var homepageConfig = common_data.getSiteConfig().homepage,
      newProducts = homepageConfig.mobile.newProducts,
      currentFlashSaleList = homepageConfig.currentFlashSaleList,
      nextFlashSaleList = homepageConfig.nextFlashSaleList,
      topicCategories = homepageConfig.topicCategories,
      reqs = [], spreadOpts = [], idList;
  // Multi-Requests
  // 1.新品推荐 -> newProducts
  if (newProducts && newProducts.length) {
    idList = newProducts.map(function(p) { return p.skuId; });
    reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
    spreadOpts.push('newProducts');
  }
  // 2.当前限时抢购商品(选择第一个) -> flashSaleProducts
  //   如果没有当前限时抢购商品，则查询 下期限时抢购商品(选择第一个) -> flashSaleProducts
  if (currentFlashSaleList && currentFlashSaleList.length) {
    var currentFlashSale = currentFlashSaleList[0];
    idList = currentFlashSale.skuList.map(function(sku) { return sku.productSkuId; });
    reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
    spreadOpts.push('flashSaleProducts');
  } else if (nextFlashSaleList && nextFlashSaleList.length) {
    var nextFlashSale = nextFlashSaleList[0];
    idList = nextFlashSale.skuList.map(function(sku) { return sku.productSkuId; });
    reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
    spreadOpts.push('flashSaleProducts');
  }
  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        // 处理限时抢购商品
        var flashSaleProducts = null;
        if (currentFlashSaleList && currentFlashSaleList.length) {
          flashSaleProducts = processFlashSaleProducts(currentFlashSaleList[0], result.flashSaleProducts, true);
          result.currentOrNext = true;
          if (flashSaleProducts.length) {
            result.countdownTime = flashSaleProducts[0].activityEndTime;
          }
        } else if (nextFlashSaleList && nextFlashSaleList.length) {
          flashSaleProducts = processFlashSaleProducts(nextFlashSaleList[0], result.flashSaleProducts, false);
          result.currentOrNext = false;
          result.countdownTime = flashSaleProducts[0].activityStartTime;
        }
        result.flashSaleProducts = flashSaleProducts;
        // 渲染页面
        common_util.renderMobile(req, res, 'index', {
          _footerNav: 'index',
          _enableWxShare: true,
          title: config.web.name,
          homepageConfig: common_data.getSiteConfig().homepage,
          products: result,
          siteNotice: getSiteNoticeIfNotViewed(req, res),
          product_util: product_util
        });
      },
      http_util.errorHandler(req, res, next));
}

function renderFlashCurrentOrNext(req, res, next) {
  var param = req.params.currentOrNext, currentOrNext;
  if (param === 'current') {
    currentOrNext = true;
  } else if (param === 'next') {
    currentOrNext = false;
  } else {
    var err = new Error('Unknown param: ' + param);
    err.status = 404;
    return next(err);
  }
  var homepageConfig = common_data.getSiteConfig().homepage, flashSaleList;
  if (currentOrNext) {
    flashSaleList = homepageConfig.currentFlashSaleList;
  } else {
    flashSaleList = homepageConfig.nextFlashSaleList;
  }
  var reqs = [], spreadOpts = [];
  if (flashSaleList && flashSaleList.length) {
    flashSaleList.forEach(function(flashSale) {
      var idList = flashSale.skuList.map(function(sku) { return sku.productSkuId; });
      reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
      spreadOpts.push('flashSaleProducts_' + flashSale.id);
    });
  } else {
    var err = new Error('There are no `' + param + '` flash sale activities!');
    err.status = 404;
    return next(err);
  }
  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        // 处理限时抢购商品
        var flashSaleProductsArr = [];
        flashSaleList.forEach(function(flashSale) {
          var flashSaleProducts = processFlashSaleProducts(flashSale, result['flashSaleProducts_' + flashSale.id], currentOrNext);
          if (flashSaleProducts.length) {
            var countdownTime = currentOrNext ? flashSaleProducts[0].activityEndTime : flashSaleProducts[0].activityStartTime;
            flashSaleProductsArr.push({
              flashSaleProducts: flashSaleProducts,
              countdownTime: countdownTime
            });
          }
        });
        if (!flashSaleProductsArr.length) {
          var err = new Error('There are no `' + param + '` flash sale products!');
          err.status = 404;
          return next(err);
        }
        common_util.renderMobile(req, res, 'flashsale', {
          _enableWxShare: true,
          title: common_util.titlePostfix(currentOrNext ? '本期限时抢购' : '下期限时抢购'),
          flashSaleProductsArr: flashSaleProductsArr,
          currentOrNext: currentOrNext,
          product_util: product_util
        });
      },
      http_util.errorHandler(req, res, next)
    );
}

function processFlashSaleProducts(flashSale, flashSaleProducts, currentOrNext) {
  if (!flashSaleProducts) return [];
  var flashSaleSkuMap = {};
  flashSale.skuList.forEach(function(flashSaleSku) {
    flashSaleSkuMap[flashSaleSku.productSkuId] = flashSaleSku;
  });
  var productList = [];
  flashSaleProducts.forEach(function(productSummary) {
    if (productSummary.saleStatus === 'ON_SALE') {
      if (currentOrNext && productSummary.activityType !== 'FLASH_SALE') {
        logger.warn('该商品没有参与限时抢购活动，SKU_ID: %d, ACTIVITY_ID: %d', productSummary.skuId, flashSale.id);
        return;  // 过滤非法数据
      }
      var flashSaleSku = flashSaleSkuMap[productSummary.skuId];
      if (!flashSaleSku) return;
      /*if (currentOrNext) {
        // 本期限时抢购，如果设置了特殊图片，代替原来的商品图片
        productSummary.imageUrl = flashSaleSku.imageUrl || productSummary.imageUrl;
      } else {*/
        // 补齐下期限时抢购的部分信息
        productSummary.activityId = flashSale.id;
        productSummary.activityType = 'FLASH_SALE';
        productSummary.activityName = flashSale.name;
        productSummary.activityStartTime = flashSale.startTime;
        productSummary.activityEndTime = flashSale.endTime;
        productSummary.promotionPrice = flashSaleSku.price;
      /*}*/
      productList.push(productSummary);
    }
  });
  return productList;
}

var SITE_NOTICE_VIEWED_COOKIE_OPTIONS = config.cookie.track.options;
function getSiteNoticeIfNotViewed(req, res) {
  var config = common_data.getSiteNoticeConfig(true);
  if (!config) return null;
  var nvName = SITE_NOTICE_VIEWED_PREFIX + config.id,
      viewed = req.cookies[nvName];
  if (viewed) return null;
  // 用户没有查看过当前的公告
  for (var name in req.cookies) {
    if (name.indexOf(SITE_NOTICE_VIEWED_PREFIX) === 0) {
      // 删除以`SITE_NOTICE_VIEWED_PREFIX`开头的cookie
      res.clearCookie(name);
    }
  }
  // LxC(2016-03-09): 下面如果用自定义的cookie options，在红米手机上无法把cookie设置上去，
  // 但是用config.cookie.track.options就没有问题，很奇怪 (TODO: 感觉是红米会把maxAge小于1天的cookie都给过滤了)
  res.cookie(nvName, '1', SITE_NOTICE_VIEWED_COOKIE_OPTIONS);
  return {
    title: config.title,
    content: image_util.filterHtmlContent(config.content)
  };
}

module.exports = router;
