var express = require('express'),
    extend = require('extend'),
    logger = require('../../logger'),
    common_data = require('../../common_data'),
    web_const = require('../../web_const'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    product_util = require('../../util/product_util');
    Q = require('q');

var MAX_PRODUCTS_FOR_ONE_CLASS = 12,  // 产地专题页、活动专题页，每个品类下面最多显示12个商品
    MAX_PRODUCTS_FOR_TOPIC_BRAND = web_const.WAP_PAGINATION_SIZE,  // 品牌专题页，每页显示数量
    MAX_PRODUCTS_FOR_TOPIC_ACTIVITY = web_const.WAP_PAGINATION_SIZE; // 商品活动专题页，每页显示数量

var router = express.Router();

router.get('/origin', common_util.userReferralHook, function(req, res, next) {
  var homepageConfig = common_data.getSiteConfig().homepage,
      topicOrigins = homepageConfig.mobile.topicOrigins;
  common_util.renderMobile(req, res, 'topic/list', {
    _footerNav: 'index',
    _enableWxShare: true,
    headerNav: 'origin',
    title: common_util.titlePostfix('产地馆'),
    list: topicOrigins,
    generateLink: function(item) {
      return 'topic-origin-' + item.id + '.html';
    }
  });
});

router.get('/origin/:id', common_util.userReferralHook, function(req, res, next) {
  var id = req.params.id,
      siteConfig = common_data.getSiteConfig(),
      topicOrigin = siteConfig.mobile.topicOriginsMap[id],
      productClassList = siteConfig.homepage.productClassList || [];
  if (!topicOrigin) {
    error(next, 404, 'No topicOrigin with id: ' + id);
    return;
  }
  // Multi-Requests, 查询不同品类下面的商品
  var reqs = [], spreadOpts = [],
      productOriginIds = topicOrigin.productOriginIds;
  productClassList.forEach(function(productClass) {
    reqs.push(http_util.request('queen', {
        method: 'POST',
        url: '/product/search',
        data: {
          originId: productOriginIds.join(','),
          classId: productClass.id,
          size: MAX_PRODUCTS_FOR_ONE_CLASS
        }
      })
    );
    spreadOpts.push('class_' + productClass.id);
  });

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        common_util.renderMobile(req, res, 'topic/origin', {
          _enableWxShare: true,
          title: common_util.titlePostfix(topicOrigin.name),
          topicOrigin: topicOrigin,
          productClassList: productClassList,
          products: result,
          product_util: product_util
        });
      },
      http_util.errorHandler(req, res, next)
    );
});

router.get('/act/:typeAlias/:id', common_util.userReferralHook, function(req, res, next) {
  var typeAlias = req.params.typeAlias,
      id = req.params.id,
      siteConfig = common_data.getSiteConfig(),
      activityType;
  switch (typeAlias) {
  case 'p':
    activityType = 'PRODUCT_PROMOTION';
    break;
  case 'o':
    activityType = 'ORDER_PROMOTION';
    break;
  case 'flash':
    activityType = 'FLASH_SALE';
    break;
  }

  var activities = siteConfig.activityMap[activityType];
  var activity = activities[id];
  if (!activity) {
    http_util.request('facade', {
      method: 'POST',
      url: '/activity/topic/view/'+id,
      data: {activityType: activityType}
    }).done(
      http_util.resultMessageHandler(function(activity) {
        if (!activity) {
          error(next, 404, 'No activity with id: ' + id + ' for activity type ' + activityType);
          return;
        }
        var ended = activity.endTime < Date.now();
        var template = ended ? 'topic/activity_ended' : 'topic/activity_not_started';
        common_util.renderMobile(req, res, template, {
          title: common_util.titlePostfix(activity.name + '-' + product_util.getPromotionActivityName(activityType)),
          activity: activity,
          product_util: product_util
        });
      }, req, res, next),
      http_util.errorHandler(req, res, next)
    );
  } else {
    activity.typeAlias = typeAlias;
    searchActivityProduct(req, res, next, id, activityType, 0 , function(result) {
      common_util.renderMobile(req, res, 'topic/activity', {
        _enableWxShare: true,
        title: common_util.titlePostfix(activity.name + '-' + product_util.getPromotionActivityName(activityType)),
        activity: activity,
        page: result.data,
        product_util: product_util
      });
    });
  }

});

router.get('/brand', common_util.userReferralHook, function(req, res, next) {
  var homepageConfig = common_data.getSiteConfig().homepage,
      brands = homepageConfig.mobile.brands;
  common_util.renderMobile(req, res, 'topic/list', {
    _footerNav: 'index',
    _enableWxShare: true,
    headerNav: 'brand',
    title: common_util.titlePostfix('大牌馆'),
    list: brands,
    generateLink: function(item) {
      return 'topic-brand-' + item.id + '.html';
    }
  });
});

router.get('/brand/:id', common_util.userReferralHook, function(req, res, next) {
  var id = req.params.id,
    siteConfig = common_data.getSiteConfig(),
    topicBrand = siteConfig.mobile.brandsMap[id];
  if (!topicBrand) {
    error(next, 404, 'No topicBrand with id: ' + id);
    return;
  }
  var productBrand = topicBrand.productBrand;
  if (!productBrand) {
    error(next, 404, 'No productBrand for topicBrand with id: ' + id);
    return;
  }
  requestBrandProduct(req, res, next, productBrand.id, 0, function(result) {
    common_util.renderMobile(req, res, 'topic/brand', {
      _enableWxShare: true,
      title: common_util.titlePostfix(productBrand.name),
      topicBrand: topicBrand,
      productBrand: productBrand,
      productOrigin: productBrand.productOrigin,
      page: result.data,
      product_util: product_util
    });
  });
});

router.get('/article/:id', function(req, res, next) {
  var topicPageId = req.params.id;
  if (!topicPageId || isNaN(topicPageId)) {
    common_util.renderEx(req, res, '404');
    return;
  }
  var handler = function(data) {
    requestTopicProductInfo(req, res, next, data, function(result) {
      if (result.cmsStatus == "DRAFT") {
        common_util.renderMobile(req, res, 'topic/prepare', {
          title: common_util.titlePostfix(result.title),
          article_title: result.title,
          _bodyClass: 'bg_white'
        });
        return;
      }
      common_util.renderMobile(req, res, 'topic/article', {
        title: common_util.titlePostfix(result.title),
        _enableWxShare: true,
        topicContentList: result.config,
        article_title: result.title,
        bgImgUrl: result.previewImageUrl,
        bgColor: result.backgroundColor,
        product_util: product_util
      });
    });
  };
  http_util.request('facade', {
    method: 'GET',
    url: '/topic/article/' + topicPageId
  }).done(
    http_util.resultMessageHandler(handler, req, res, next),
    http_util.errorHandlerJSON(req, res, next)
  );
});

router.get('/cat', common_util.userReferralHook, function(req, res, next) {
  var homepageConfig = common_data.getSiteConfig().homepage,
      topicCategories = homepageConfig.mobile.topicCategories;
  common_util.renderMobile(req, res, 'topic/list', {
    _footerNav: 'index',
    _enableWxShare: true,
    headerNav: 'cat',
    title: common_util.titlePostfix('分类专题'),
    list: topicCategories,
    generateLink: function(item) {
      return 'topic-cat-' + item.id + '.html';
    }
  });
});

router.get('/cat/:id', common_util.userReferralHook, function(req, res, next) {
  var id = req.params.id,
      siteConfig = common_data.getSiteConfig(),
      topicCat = siteConfig.mobile.topicCategoriesMap[id],
      productClassList = siteConfig.homepage.productClassList || [];
  if (!topicCat) {
    error(next, 404, 'No topicCategory with id: ' + id);
    return;
  }
  // Multi-Requests, 查询不同品类下面的商品
  var reqs = [], spreadOpts = [];
  // 1.分类热门商品
  if (topicCat.items && topicCat.items.length) {
    var idList = topicCat.items.map(function(item) { return item.skuId; });
    reqs.push(http_util.request('queen', '/product/summary/list/' + idList.join(',')));
    spreadOpts.push('topicProducts');
  }
  // 2.该分类下的商品，按品类进行归类
  var productCategoryId = topicCat.productCategoryId;
  productClassList.forEach(function(productClass) {
    reqs.push(http_util.request('queen', {
        method: 'POST',
        url: '/product/search',
        data: {
          categoryIdLevel1: productCategoryId,
          classId: productClass.id,
          size: MAX_PRODUCTS_FOR_ONE_CLASS
        }
      })
    );
    spreadOpts.push('class_' + productClass.id);
  });

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        common_util.renderMobile(req, res, 'topic/category', {
          _enableWxShare: true,
          title: common_util.titlePostfix(topicCat.productCategoryName + '-分类专题'),
          topicCat: topicCat,
          productClassList: productClassList,
          products: result,
          product_util: product_util
        });
      },
      http_util.errorHandler(req, res, next)
    );
});

// ------------------------------------------------------------------------
// Ajax
// ------------------------------------------------------------------------

router.post('/act/:typeAlias/:id', function(req, res, next) {
  var typeAlias = req.params.typeAlias,
      id = req.params.id,
      activityType;
  switch (typeAlias) {
    case 'p':
      activityType = 'PRODUCT_PROMOTION';
      break;
    case 'o':
      activityType = 'ORDER_PROMOTION';
      break;
    case 'flash':
      activityType = 'FLASH_SALE';
      break;
  }
  var pageNumber = req.body.pageNumber;
  searchActivityProduct(req, res, next, id, activityType, pageNumber , function(result) {
    common_util.renderMobile(req, res, 'topic/activity_list', {
      page: result.data,
      product_util: product_util
    });
  });
});

router.post('/brand/:id', function(req, res, next) {
  var brandId = req.params.id;
  var pageNumber = req.body.pageNumber;

  requestBrandProduct(req, res, next, brandId, pageNumber, function(result) {
    common_util.renderMobile(req, res, 'topic/brand_list', {
      page: result.data,
      product_util: product_util
    });
  });
});

// ------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------

function requestTopicProductInfo(req, res, next, data, cb) {
  var contentLines = data.config;
  var skuIds = [];
  for(var i = 0 ; i < contentLines.length ; i ++) {
    var contentLine = contentLines[i];
    var products = contentLine.products;
    for(var j = 0 ; j < products.length ; j++) {
      var product = products[j];
      skuIds.push(product.skuId);
    }
  }
  searchProduct(skuIds)
    .done(
      function(result) {
        var skuMap = {}, i;
        for (i = 0; i < result.length; i++) {
          var product = result[i];
          skuMap[product.skuId] = product;
        }
        for (i = 0; i < contentLines.length; i++) {
          var contentLine = contentLines[i];
          var products = contentLine.products;
          for (var j = 0; j < products.length; j++) {
            var product = products[j];
            if (skuMap[product.skuId]) {
              delete skuMap[product.skuId].imageUrl;
              extend(product, skuMap[product.skuId]);
              var activityType = skuMap[product.skuId].activityType;
              if (activityType === 'FLASH_SALE' || activityType === 'PRODUCT_PROMOTION') {
                product.salePrice = skuMap[product.skuId].promotionPrice ? skuMap[product.skuId].promotionPrice : skuMap[product.skuId].salePrice;
              } else {
                product.salePrice = skuMap[product.skuId].salePrice ? skuMap[product.skuId].salePrice : " ";
              }
            }
          }
        }
        if (cb && typeof cb === 'function') {
          cb(data);
        }
      },
      http_util.errorHandler(req, res, next)
    );
}

function searchProduct(skuIds) {
  var deferred = Q.defer();
  http_util.request('queen', {
    method: 'GET',
    url: '/product/summary/list/' + skuIds.join(",")
  })
  .done(
    function (result) {
      if (result.success) {
        deferred.resolve(result.data);
      } else {
        deferred.reject(result.error.message);
      }
    },
    function(err) {
      deferred.reject(err);
    }
  );
  return deferred.promise;
}

function searchActivityProduct(req, res, next, activityId, activityType, pageNumber, cb) {
  var data = {}, size = MAX_PRODUCTS_FOR_TOPIC_ACTIVITY;

  data.size = size;
  data.start = calcSearchStart(pageNumber, size);
  data.activityType = activityType;
  data.activityId = activityId;
  http_util.request('queen', {
      method: 'POST',
      url: '/product/search',
      data: data
    })
    .done(
      function (result) {
        if (cb && typeof cb === 'function') {
          cb(result);
        }
      },
      http_util.errorHandler(req, res, next)
    );
}

function calcSearchStart(pageNumber, size) {
  if (isNaN(pageNumber) || pageNumber <= 0) {
    return 0;
  }
  return (pageNumber - 1 ) * size;
}

function requestBrandProduct(req, res, next, brandId, pageNumber, cb) {
  http_util.request('queen', {
    method: 'POST',
    url: '/product/search',
    data: {
      brandId: brandId,
      start: calcSearchStart(pageNumber, MAX_PRODUCTS_FOR_TOPIC_BRAND),
      size: MAX_PRODUCTS_FOR_TOPIC_BRAND
    }
  })
  .done(
    function(result) {
      if (typeof cb === 'function') {
        cb(result);
      }
    },
    http_util.errorHandler(req, res, next)
  );
}

function error(next, status, message) {
  var err = new Error(message);
  err.status = status;
  next(err);
}

module.exports = router;
