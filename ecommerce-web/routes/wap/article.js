var express = require('express'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    product_util = require('../../util/product_util');

var router = express.Router();

router.get('/:id', function(req, res, next) {
  var id = req.params.id,
      config = articleConfigs['article_' + id];
  if (!config) {
    // 如果找不到对应的id，往下走
    return next();
  }
  http_util.request('queen', '/product/summary/list/' + config.skuIds.join(','))
    .done(
      http_util.resultMessageHandler(function(products) {
        common_util.renderMobile(req, res, 'article/temporary', {
          title: common_util.titlePostfix(config.title),
          titleNoPostfix: config.title,
          bannerImageUrl: config.bannerImageUrl,
          products: products,
          product_util: product_util
        });
      }, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

var articleConfigs = {
  'article_1': {
    'title': '冬季肌肤大改造',
    'bannerImageUrl': '201603/0illps9glb4h2_640x240.jpg',
    'skuIds': [410, 375, 604, 184, 180, 15, 53, 7, 78, 141, 142]
  },
  'article_2': {
    'title': '限量特卖',
    'bannerImageUrl': '201603/0illps9uca23w_640x240.jpg',
    'skuIds': [664, 843, 669, 175, 691, 37, 652, 137, 25, 687, 184, 271, 268, 278]
  },
  'article_3': {
    'title': '免税专场',
    'bannerImageUrl': '201604/0imvdasq0qwpp_640x240.jpg',
    'skuIds': [10, 16, 21, 29, 47, 72, 77, 81, 105, 107, 152, 155, 159, 181, 186, 192, 196, 519, 520, 582]
  },
  'article_4': {
    'title': '奶粉免税专场',
    'bannerImageUrl': '201604/0imwu2bm6im6e_640x240.jpg',
    'skuIds': [206, 222, 217, 205, 211, 210, 201, 223, 213, 212, 209, 208, 204, 202, 203, 47, 456]
  }
};

module.exports = router;
