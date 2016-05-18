var express = require('express'),
    extend = require('extend'),
    Q = require('q'),
    config = require('../../config'),
    logger = require('../../logger'),
    auth = require('../../auth'),
    user_track = require('../../user_track'),
    web_const = require('../../web_const'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    product_search_util = require('../../util/product_search_util'),
    product_util = require('../../util/product_util'),
    cart_util = require('../../util/cart_util'),
    common_data = require('../../common_data');

var SEARCH_RESULT_PAGE_SIZE = web_const.WAP_PAGINATION_SIZE;

var router = express.Router();

router.get('/search', function(req, res, next) {
  var q = req.query.q;
  if (q) q = q.trim();
  if (q) {
    // record search word
    user_track.recordSearchWord(req, res, q);
  } else if (!product_search_util.hasSearchParam(req)) {
    // 渲染默认的搜索页
    common_util.renderMobile(req, res, 'search_default', {
      _footerNav: 'search',
      title: common_util.titlePostfix('搜索'),
      homepageConfig: common_data.getSiteConfig().homepage
    });
    return;
  }

  // Multi-Requests#1
  var reqs = [], spreadOpts = [];
  // 1.根据条件进行搜索 -> searchResult
  var filter = product_search_util.collectSearchParam(req),
      searchParam = extend(filter, {
        start: 0,
        size: SEARCH_RESULT_PAGE_SIZE,
        productName: q
      });
  reqs.push(product_search_util.initSearch(searchParam));
  spreadOpts.push('searchResult');

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
    common_util.renderMobile(req, res, '404');
    return;
  }

  // record view product
  user_track.recordViewProduct(req, res, skuId);

  // Multi-Requests#1
  var reqs = [], spreadOpts = [];
  // 1.商品详情 -> productDetail
  reqs.push(http_util.request('queen', '/product/detail/mobile/' + skuId));
  spreadOpts.push({
    name: 'productDetail',
    ignoreError: true  // 允许error，显示“没有该商品或商品已下架”
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

//获取查询结果
router.post('/search', function(req, res, next) {
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

// ------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------

function handleSearchMultiRequest(req, res, next, result) {
  if (!result.searchResult) {
    renderSearchPage(req, res, null, null, null);
    return;
  }

  var searchResult = result.searchResult.page,
      searchParam = result.searchResult.searchParam;
  // Multi-Requests#2
  var reqs = [], spreadOpts = [];
  // 1.构建搜索条件 -> searchFilter
  reqs.push(http_util.request('queen', {
      method: 'POST',
      url: '/product/aggregate',
      data: searchParam
    })
  );
  spreadOpts.push('searchFilter');

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        renderSearchPage(req, res, searchResult, searchParam, result.searchFilter);
      },
      http_util.errorHandler(req, res, next)
    );
}

function renderSearchPage(req, res, searchResult, searchParam, searchFilter) {
  var searchQuery = req.query;
  common_util.renderMobile(req, res, 'search', {
    _footerNav: 'search',
    title: common_util.titlePostfix(searchQuery.q || '搜索'),
    homepageConfig: common_data.getSiteConfig().homepage,
    searchQuery: searchQuery,
    searchParamJsonStr: JSON.stringify(searchParam),
    searchResult: searchResult,
    searchFilter: product_search_util.constructSearchFilter(searchFilter),
    product_util: product_util
  });
}

function handleProductMultiRequest(req, res, next, result) {
  var productDetail = result.productDetail, productSummary,
      recommendSkuIds = result.recommendSkuIds,
      region = result.region;
  if (!shouldRenderProductPage(productDetail)) {
    // 没有该商品或商品已下架
    common_util.renderMobile(req, res, 'product_error', {
      _bodyClass: 'bg_white',
      title: common_util.titlePostfix('商品详情')
    });
    return;
  }
  productSummary = productDetail.productSummary;

  // Multi-Requests#2
  var reqs = [], spreadOpts = [];

  // 1.相关产品-SUMMARY -> relatedProducts
  var relatedSkuList = productDetail.relatedSkuList;
  if (relatedSkuList && relatedSkuList.length) {
    if (relatedSkuList.length > 4) {
      // 暂时只显示最多4个相关商品
      relatedSkuList = relatedSkuList.slice(0, 4);
    }
    reqs.push(http_util.request('queen', '/product/summary/list/' + relatedSkuList.join(',')));
    spreadOpts.push({
      name: 'relatedProducts',
      ignoreError: true
    });
  }
  // 2.如果用户已经登录，并且商品处于上架状态，判断该商品是否已收藏 -> favorite
  if (req.user && productSummary.saleStatus === 'ON_SALE') {
    reqs.push(http_util.request('facade', '/user/favorite/check/' + req.user.id + '/' + productSummary.skuId));
    spreadOpts.push({
      name: 'favorite',
      ignoreError: true
    });
  }
  // 3.用户的购物车商品数量 -> cartCount
  reqs.push(cart_util.countProducts(req));
  spreadOpts.push({
    name: 'cartCount',
    ignoreError: true
  });

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        renderProductPage(req, res, productDetail, result.relatedProducts, result.favorite, result.cartCount);
      },
      http_util.errorHandler(req, res, next)
    );
}

function shouldRenderProductPage(productDetail) {
  // 判断商品是否要渲染
  if (!productDetail) return false;
  var productSummary = productDetail.productSummary;
  return (productDetail.imageUrl1 && productDetail.mobileDescription /*&& productSummary.shortDescription*/ &&
          productSummary.productOriginId && productSummary.warehouseId && typeof productSummary.salePrice === 'number');
}

function renderProductPage(req, res, productDetail, relatedProducts, favorite, cartCount) {
  var skuName = productDetail.metaTitle ? productDetail.metaTitle : productDetail.productSummary.skuName;
  common_util.renderMobile(req, res, 'product', {
    _seo: common_util.genSEO(productDetail.metaKeywords, productDetail.metaDescription),
    _enableWxShare: true,
    title: common_util.titlePostfix(skuName),
    productDetail: productDetail,
    relatedProducts: relatedProducts,
    favorite: favorite,
    cartCount: cartCount,
    product_util: product_util
  });
}

/**
 * 渲染搜索结果
 * @param result
 */
function renderSearchResult(req, res, result) {
  res.render('wap/search_result', {
    searchQuery: req.body,
    searchResult: result,
    product_util: product_util
  });
}

// ------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------

module.exports = router;
