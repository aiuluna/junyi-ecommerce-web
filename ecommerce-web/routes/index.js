var express = require('express'),
    config = require('../config'),
    logger = require('../logger'),
    web_const = require('../web_const'),
    common_data = require('../common_data'),
    common_util = require('../util/common_util'),
    http_util = require('../util/http_util'),
    product_util = require('../util/product_util'),
    image_util = require('../util/image_util');

var SITE_NOTICE_VIEWED_PREFIX = web_const.SITE_NOTICE_VIEWED_PREFIX;

var router = express.Router();

/* home page. */
router.get('/', common_util.userReferralHook, renderHomepage);
router.get('/index', common_util.userReferralHook, renderHomepage);

function renderHomepage(req, res, next) {
  var homepageConfig = common_data.getSiteConfig().homepage,
      newProducts = homepageConfig.newProducts,
      currentFlashSaleList = homepageConfig.currentFlashSaleList,
      nextFlashSaleList = homepageConfig.nextFlashSaleList,
      topicCategories = homepageConfig.topicCategories,
      homeSetting = homepageConfig.homeSetting,
      reqs = [], spreadOpts = [], idList;
  // Multi-Requests
  // 1.新品推荐 -> newProducts
  if (newProducts && newProducts.length) {
    idList = newProducts.map(function(p) { return p.skuId; });
    reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
    spreadOpts.push('newProducts');
  }
  // 2.当前限时抢购商品 -> currentFlashSaleProducts_<activityId>
  if (currentFlashSaleList && currentFlashSaleList.length) {
    currentFlashSaleList.forEach(function(flashSale) {
      var idList = flashSale.skuList.map(function(sku) { return sku.productSkuId; });
      reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
      spreadOpts.push('currentFlashSaleProducts_' + flashSale.id);
    });
  }
  // 3.下期限时抢购商品 -> nextFlashSaleProducts
  if (nextFlashSaleList && nextFlashSaleList.length) {
    var nextFlashSale = nextFlashSaleList[0];
    idList = nextFlashSale.skuList.map(function(sku) { return sku.productSkuId; });
    reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
    spreadOpts.push('nextFlashSaleProducts');
  }
  // 4.分类活动 -> topicCategory_<topicCategoryId>
  if (topicCategories && topicCategories.length) {
    topicCategories.forEach(function(topicCat) {
      if (topicCat.items && topicCat.items.length) {
        var idList = topicCat.items.map(function(item) { return item.skuId; });
        reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
        spreadOpts.push('topicCategory_' + topicCat.id);
      }
    });
  }
  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        // 处理限时抢购商品
        if (currentFlashSaleList && currentFlashSaleList.length) {
          var currentFlashSaleProducts = [];
          currentFlashSaleList.forEach(function(flashSale) {
            currentFlashSaleProducts = currentFlashSaleProducts.concat(
              processFlashSaleProducts(flashSale, result[' ' + flashSale.id], true));
            result['currentFlashSaleProducts_' + flashSale.id] = null;
          });
          result.currentFlashSaleProducts = currentFlashSaleProducts;
        }
        if (nextFlashSaleList && nextFlashSaleList.length) {
          var nextFlashSaleProducts = processFlashSaleProducts(nextFlashSaleList[0], result.nextFlashSaleProducts, false);
          if (nextFlashSaleProducts.length) {
            result.nextFlashSaleProducts = nextFlashSaleProducts;
            result.nextFlashSaleStartTime = new Date(nextFlashSaleList[0].startTime);
          }
        }
        common_util.renderEx(req, res, 'index', {
          _headerNav: 'index',
          title: config.web.homeTitle,
          homepageConfig: common_data.getSiteConfig().homepage,
          products: result,
          homeSetting: homeSetting || {},
          siteNotice: getSiteNoticeIfNotViewed(req, res),
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
      if (currentOrNext) {
        // 本期限时抢购，如果设置了特殊图片，代替原来的商品图片
        productSummary.imageUrl = flashSaleSku.imageUrl || productSummary.imageUrl;
      } else {
        // 补齐下期限时抢购的部分信息
        productSummary.activityId = flashSale.id;
        productSummary.activityType = 'FLASH_SALE';
        productSummary.activityName = flashSale.name;
        productSummary.activityStartTime = flashSale.startTime;
        productSummary.activityEndTime = flashSale.endTime;
        productSummary.promotionPrice = flashSaleSku.price;
      }
      productList.push(productSummary);
    }
  });
  return productList;
}

function getSiteNoticeIfNotViewed(req, res) {
  var config = common_data.getSiteNoticeConfig();
  if (!config) return null;
  var viewed = req.cookies[SITE_NOTICE_VIEWED_PREFIX + config.id];
  if (viewed) return null;
  // 用户没有查看过当前的公告
  res.cookie(SITE_NOTICE_VIEWED_PREFIX + config.id, 1, {
      'path': '/',
      'httpOnly': true,
      'secure': false,
      'maxAge': Math.max(0, config.endTime - Date.now()) + 60 * 60 * 1000 // 额外增加1个小时
    });
  return {
    title: config.title,
    content: image_util.filterHtmlContent(config.content)
  };
}

module.exports = router;
