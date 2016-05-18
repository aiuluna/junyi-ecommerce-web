var express = require('express'),
    extend = require('extend'),
    Q = require('q'),
    config = require('../config'),
    logger = require('../logger'),
    auth = require('../auth'),
    user_track = require('../user_track'),
    web_const = require('../web_const'),
    common_util = require('../util/common_util'),
    http_util = require('../util/http_util'),
    product_search_util = require('../util/product_search_util'),
    product_util = require('../util/product_util'),
    common_data = require('../common_data');

var REGIONS_JSON = null,  // <string> cache of regions data
    RECENT_VIEWED_MAX_COUNT = web_const.RECENT_VIEWED_MAX_COUNT,
    RECENT_VIEWED_MAX_COUNT_PRODUCT_PAGE = web_const.RECENT_VIEWED_MAX_COUNT_PRODUCT_PAGE,
    SEARCH_RESULT_PAGE_SIZE = web_const.SEARCH_RESULT_PAGE_SIZE;

var router = express.Router();

router.get('/search', function(req, res, next) {
  var q = req.query.q;
  if (q) q = q.trim();
  if (q) {
    // record search word
    user_track.recordSearchWord(req, res, q);
  }

  // Multi-Requests#1
  var reqs = [], spreadOpts = [];
  // 1.根据条件进行搜索 -> searchResult
  if (q || product_search_util.hasSearchParam(req)) {
    var filter = product_search_util.collectSearchParam(req),
        searchParam = extend(filter, {
          start: 0,
          size: SEARCH_RESULT_PAGE_SIZE,
          productName: q
        });
    reqs.push(product_search_util.initSearch(searchParam));
    spreadOpts.push('searchResult');
  }

  // 2.猜你喜欢(获取skuId列表) -> recommendSkuIds
  reqs.push(product_util.requestForRecommendSkuIds(req));
  spreadOpts.push({
    name: 'recommendSkuIds',
    ignoreError: true
  });

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      handleSearchMultiRequest.bind(null, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

router.get('/product/:skuId', common_util.userReferralHook, function(req, res, next) {
  var skuId = req.params.skuId;
  if (!skuId || isNaN(skuId)) {
    common_util.renderEx(req, res, '404');
    return;
  }

  // record view product
  user_track.recordViewProduct(req, res, skuId);

  // Multi-Requests#1
  var reqs = [], spreadOpts = [];
  // 1.商品详情 -> productDetail
  reqs.push(http_util.request('queen', '/product/detail/' + skuId));
  spreadOpts.push({
    name: 'productDetail',
    ignoreError: true  // 允许error，显示“没有该商品或商品已下架”
  });
  // 2.猜你喜欢(获取skuId列表) -> recommendSkuIds
  var recentViewedSkuIds = product_util.recentViewedSkuIdsFromCookie(req, res, skuId);
  recentViewedSkuIds.unshift(skuId);
  reqs.push(product_util.requestForRecommendSkuIds(req, skuId, recentViewedSkuIds));
  spreadOpts.push({
    name: 'recommendSkuIds',
    ignoreError: true
  });
  // 3.根据用户IP推算用户所在地 -> region
  if (req.user && req.user.defaultShippingRegionId) {
    reqs.push(Q.fcall(function() {
      return {
        success: true,
        data: common_data.getRegion(req.user.defaultShippingRegionId)
      };
    }));
  } else {
    reqs.push(http_util.request('facade', {
        method: 'POST',
        url: '/region/deduce',
        data: { ip: common_util.getReqIP(req) }
      })
    );
  }
  spreadOpts.push({
    name: 'region',
    ignoreError: true
  });

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      handleProductMultiRequest.bind(null, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

// ------------------------------------------------------------------------
// Ajax
// ------------------------------------------------------------------------

// 计算运费
router.post('/freight/fee', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'POST',
      url: '/freight/fee',
      data: req.body
    }, res);
});

// 获取地址列表
router.get('/region/list', function(req, res, next) {
  res.type('application/json').end(REGIONS_JSON);
});

// 添加收藏
router.post('/user/favorite/add',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var userId = req.user.id,
        skuId = req.body.skuId,
        salePrice = req.body.salePrice;
    if (!skuId || !salePrice) {
      res.json({
        result: false,
        error: {
          message: '参数需要包含skuId和salePrice'
        }
      });
      return;
    }
    http_util.pipe('facade', {
        method: 'POST',
        url: '/user/favorite/add/' + userId + '/' + skuId,
        data: {
          salePrice: salePrice
        }
      }, res);
  }
);

// 取消收藏
router.post('/user/favorite/delete',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var userId = req.user.id,
        favoriteId = req.body.favoriteId;
    if (!favoriteId) {
      res.json({
        result: false,
        error: {
          message: '参数需要包含favoriteId'
        }
      });
      return;
    }
    http_util.pipe('facade', {
        method: 'POST',
        url: '/user/favorite/delete/' + userId + '/' + favoriteId
      }, res);
  }
);

//获取查询结果
router.post('/product/search/result', function(req, res, next) {
  var data = req.body, size = SEARCH_RESULT_PAGE_SIZE;

  if (product_search_util.isEmptySearchParam(data)) {
    renderSearchResult(req, res, product_search_util.emptyPageInfo(size));
    return;
  }

  data.size  = size;
  data.start = product_search_util.calcSearchStart(data.start, size);

  http_util.request('queen', {
      method: 'POST',
      url: '/product/search',
      data: data
    })
    .done(
      http_util.resultMessageHandler(function(result){
        renderSearchResult(req, res, result);
      }, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

router.post('/product/recommend', function(req, res, next) {
  product_util.requestForRecommendSkuIds(req)
    .then(function(result) {
      if (result.success && result.data) {
        return http_util.request('queen', '/product/summary/list/' + result.data.join(','))
          .then(function(result) {
            if (result.success) {
              res.render('product_recommend', {
                recommendProducts: result.data,
                product_util: product_util
              });
            } else {
              res.end('');
            }
          });
      } else {
        res.end('');
      }
    })
    .catch(function(err) {
      logger.error(err);
      res.end('');
    });
});

// ------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------

function handleSearchMultiRequest(req, res, next, result) {
  var searchResult = result.searchResult ? result.searchResult.page : null,
      searchParam = result.searchResult ? result.searchResult.searchParam : null,
      recommendSkuIds = result.recommendSkuIds;
  // Multi-Requests#2
  var reqs = [], spreadOpts = [];
  // 1.构建搜索条件 -> searchFilter
  if (searchResult && searchResult.totalCount) {
    reqs.push(http_util.request('queen', {
        method: 'POST',
        url: '/product/aggregate',
        data: searchParam
      })
    );
    spreadOpts.push('searchFilter');
  }
  // 2.最近浏览(根据skuId列表获取SUMMARY) -> recentViewedProducts
  var recentViewedSkuIds = product_util.recentViewedSkuIdsFromCookie(req);
  if (recentViewedSkuIds.length) {
    if (recentViewedSkuIds.length > RECENT_VIEWED_MAX_COUNT) {
      recentViewedSkuIds = recentViewedSkuIds.slice(0, RECENT_VIEWED_MAX_COUNT);
    }
    reqs.push(http_util.request('queen', '/product/summary/list/' + recentViewedSkuIds.join(',')));
    spreadOpts.push({
      name: 'recentViewedProducts',
      ignoreError: true
    });
  }
  // 3.猜你喜欢(根据skuId列表获取SUMMARY) -> recommendProducts
  if (recommendSkuIds && recommendSkuIds.length) {
    reqs.push(http_util.request('queen', '/product/summary/list/' + recommendSkuIds.join(',')));
    spreadOpts.push({
      name: 'recommendProducts',
      ignoreError: true
    });
  }

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        renderSearchPage(req, res,
          searchResult, searchParam,
          result.searchFilter,
          result.recentViewedProducts,
          result.recommendProducts);
      },
      http_util.errorHandler(req, res, next)
    );
}

function renderSearchPage(req, res, searchResult, searchParam, searchFilter, recentViewedProducts, recommendProducts) {
  var searchQuery = req.query;
  common_util.renderEx(req, res, 'search', {
    title: common_util.titlePostfix(searchQuery.q || '搜索'),
    searchQuery: searchQuery,
    searchResult: searchResult,
    searchFilter: product_search_util.constructSearchFilter(searchFilter),
    fulltextWildcardSearch: searchParam ? searchParam.fulltextWildcardSearch : null,
    recentViewedProducts: recentViewedProducts,
    recommendProducts: recommendProducts,
    product_util: product_util
  });
}

function renderSearchResult(req, res, searchResult) {
  res.render('search_result', {
    searchResult: searchResult,
    searchQuery: req.body.productName,
    product_util: product_util
  });
}

function handleProductMultiRequest(req, res, next, result) {
  var productDetail = result.productDetail, productSummary,
      recommendSkuIds = result.recommendSkuIds,
      region = result.region;
  if (!shouldRenderProductPage(productDetail)) {
    // 没有该商品或商品已下架
    common_util.renderEx(req, res, 'product_error');
    return;
  }
  productSummary = productDetail.productSummary;

  // Multi-Requests#2
  var reqs = [], spreadOpts = [];

  // 1.相关产品-SUMMARY -> relatedProducts
  var relatedSkuList = productDetail.relatedSkuList;
  if (relatedSkuList && relatedSkuList.length) {
    reqs.push(http_util.request('queen', '/product/summary/list/' + relatedSkuList.join(',')));
    spreadOpts.push({
      name: 'relatedProducts',
      ignoreError: true
    });
  }
  // 2.最近浏览(根据skuId列表获取SUMMARY) -> recentViewedProducts
  var recentViewedSkuIds = product_util.recentViewedSkuIdsFromCookie(req);
  if (recentViewedSkuIds.length) {
    if (recentViewedSkuIds.length > RECENT_VIEWED_MAX_COUNT_PRODUCT_PAGE) {
      recentViewedSkuIds = recentViewedSkuIds.slice(0, RECENT_VIEWED_MAX_COUNT_PRODUCT_PAGE);
    }
    reqs.push(http_util.request('queen', '/product/summary/list/' + recentViewedSkuIds.join(',')));
    spreadOpts.push({
      name: 'recentViewedProducts',
      ignoreError: true
    });
  }
  // 3.猜你喜欢(根据skuId列表获取SUMMARY) -> recommendProducts
  if (recommendSkuIds && recommendSkuIds.length) {
    reqs.push(http_util.request('queen', '/product/summary/list/' + recommendSkuIds.join(',')));
    spreadOpts.push({
      name: 'recommendProducts',
      ignoreError: true
    });
  }
  // 4.根据用户所在地计算运费 -> shippingFee
  if (region && productSummary.isFreeShipping !== 'Y' && productSummary.warehouseId) {
    reqs.push(http_util.request('facade', {
        method: 'POST',
        url: '/freight/fee',
        data: {
          warehouseId: productSummary.warehouseId,
          shippingRegionId: region.id,
          weight: productDetail.weight
        }
      })
    );
    spreadOpts.push({
      name: 'shippingFee',
      ignoreError: true
    });
  }
  // 5.如果用户已经登录，并且商品处于上架状态，判断该商品是否已收藏 -> favorite
  if (req.user && productSummary.saleStatus === 'ON_SALE') {
    reqs.push(http_util.request('facade', '/user/favorite/check/' + req.user.id + '/' + productSummary.skuId));
    spreadOpts.push({
      name: 'favorite',
      ignoreError: true
    });
  }

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        renderProductPage(req, res, productDetail, region,
                          result.relatedProducts,
                          result.recentViewedProducts,
                          result.recommendProducts,
                          result.shippingFee,
                          result.favorite);
      },
      http_util.errorHandler(req, res, next)
    );
}

function shouldRenderProductPage(productDetail) {
  // 判断商品是否要渲染
  if (!productDetail) return false;
  var productSummary = productDetail.productSummary;
  return (productDetail.imageUrl1 && productDetail.description /*&& productSummary.shortDescription*/ &&
          productSummary.productOriginId && productSummary.warehouseId && typeof productSummary.salePrice === 'number');
}

function renderProductPage(req, res, productDetail, region, relatedProducts, recentViewedProducts, recommendProducts, shippingFee, favorite) {
  var skuName = productDetail.metaTitle ? productDetail.metaTitle : productDetail.productSummary.skuName;
  common_util.renderEx(req, res, 'product', {
    _seo: common_util.genSEO(productDetail.metaKeywords, productDetail.metaDescription || productDetail.productSummary.shortDescription),
    title: common_util.titlePostfix(skuName),
    productDetail: productDetail,
    region: region,
    relatedProducts: relatedProducts,
    recentViewedProducts: recentViewedProducts,
    recommendProducts: recommendProducts,
    shippingFee: shippingFee,
    favorite: favorite,
    product_util: product_util
  });
}


// ------------------------------------------------------------------------
// Initialize
// ------------------------------------------------------------------------

function loadRegionsJSON() {
  var regionsTree = common_data.getRegions(),
      regions = [];
  if (!regionsTree) return;  // not ready
  regionsTree.forEach(function(region) {
    var regionToRet = [region.id, region.name, []];
    var subRegions = region.subRegions;
    if (subRegions) {
      if (subRegions.length === 1) {  // 直辖市
        subRegions = subRegions[0].subRegions;
        if (!subRegions || !subRegions.length) {
          subRegions = region.subRegions;
        }
      }
      subRegions.forEach(function(subRegion) {
        regionToRet[2].push([subRegion.id, subRegion.name]);
      });
    }
    regions.push(regionToRet);
  });
  REGIONS_JSON = JSON.stringify(regions);
}
common_data.events.on('regions', loadRegionsJSON);
loadRegionsJSON();  // in case this script is loaded before the events is emitted

// ------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------

module.exports = router;
