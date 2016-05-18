var express = require('express'),
    config = require('../config'),
    auth = require('../auth'),
    logger = require('../logger'),
    web_const = require('../web_const'),
    common_util = require('../util/common_util'),
    http_util = require('../util/http_util'),
    product_util = require('../util/product_util'),
    cart_util = require('../util/cart_util'),
    order_util = require('../util/order_util');

var RECENT_VIEWED_MAX_COUNT = web_const.RECENT_VIEWED_MAX_COUNT,
    FLASH_KEY_OF_WECHAT_CODE_URL = web_const.FLASH_KEY_OF_WECHAT_CODE_URL,
    FAILURE_REDIRECT = 'cart.html';

var router = express.Router();

router.get('/', function(req, res, next) {
  // Multi-Requests#1
  var reqs = [], spreadOpts = [];
  // 1.获取购物车商品 -> cartList
  reqs.push(cart_util.listProducts(req));
  spreadOpts.push({
    name: 'cartList',
    ignoreError: true
  });
  // 2.猜你喜欢(获取skuId列表) -> suggestedSkuIds
  reqs.push(product_util.requestForRecommendSkuIds(req));
  spreadOpts.push({
    name: 'recommendSkuIds',
    ignoreError: true
  });

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      handleCartListMultiRequest.bind(null, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

router.post('/order',
  auth.requireAuth({
    failureRedirect: FAILURE_REDIRECT
  }),
  function(req, res, next) {
    var items = null;
    try {
      items = JSON.parse(req.body.items);
    } catch (ignore) {}
    if (!items || !items.length) {
      logger.error('[cart/order] Illegal request, ip: %s, user_id: %d, req.body.items: %s',
          common_util.getReqIP(req), req.user.id, req.body.items);
      res.redirect(FAILURE_REDIRECT);
      return;
    }
    var userId = req.user.id;
    // Multi-Requests
    var reqs = [], spreadOpts = [];
    // 1.获取已选择商品SUMMARY -> orderProducts
    reqs.push(http_util.request('queen', '/product/sku/summary/list/' + items.map(function(item) { return item.skuId; }).join(',')));
    spreadOpts.push('orderProducts');
    // 2.计算一下购物车费用(运费交由前台ajax计算) -> cartPreOrderInitResponse
    reqs.push(http_util.request('queen', {
        method: 'POST',
        url: '/cart/preorder/init',
        data: {
          json: JSON.stringify({
            seq: 1,
            items: items,
            userId: userId
          })
        }
      })
    );
    spreadOpts.push('cartPreOrderInitResponse');

    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(
        function(result) {
          var cartPreOrderInitResponse = result.cartPreOrderInitResponse;
          if (!cartPreOrderInitResponse || cartPreOrderInitResponse.hasError) {
            req.flash('preorderError', (cartPreOrderInitResponse && cartPreOrderInitResponse.errorMessage) || '购物车所选商品有误，请重新选择');
            res.redirect(FAILURE_REDIRECT);
            return;
          }
          var productQuantityMap = {};
          items.forEach(function(item) {
            productQuantityMap[item.skuId] = item.quantity;
          });
          common_util.renderEx(req, res, 'cart/order', {
            title: common_util.titlePostfix('提交订单'),
            itemsJSON: JSON.stringify(items),
            productQuantityMap: productQuantityMap,
            orderProducts: result.orderProducts,
            cartPreOrderInitResponse: cartPreOrderInitResponse,
            order_util: order_util,
            product_util: product_util
          });
        },
        http_util.errorHandler(req, res, next)
      );
  });

router.get('/checkout/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    // 获取订单数据
    cart_util.getOrderInfoByOrderNo(req, req.params.orderNo)
      .done(
        function(order) {
          handleOrderBeforeCheckout(req, res, next, order);
        },
        function(err) {
          logger.warn('cart_util.getOrderInfoByOrderNo: ' + err);
          handleOrderBeforeCheckout(req, res, next, null);
        }
      );
});

router.get('/pay/alipay/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    var orderNo = req.params.orderNo;
    cart_util.getTradeInfoByOrderNo(req, orderNo)
      .done(
        function(trade) {
          http_util.pipe('facade', {
            timeout: 60000 /* in ms */,
            method: 'POST',
            url: '/order/pay',
            data: {
              payNo: trade.payNo,
              //userId: req.user.id,
              payChannel: 'ALIPAY',
              tradeType:　'ALI_PC_DIRECT'
            }
          }, res);
        },
        http_util.errorHandler(req, res, next)
      );
});

router.get('/pay/done/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderEx(req, res, 'cart/checkout_done', {
      title: common_util.titlePostfix('支付完成'),
      orderNo: req.params.orderNo
    });
  });
//通联支付返回页面使用post请求
router.post('/pay/done/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderEx(req, res, 'cart/checkout_done', {
      title: common_util.titlePostfix('支付完成'),
      orderNo: req.params.orderNo
    });
  });

router.get('/pay/wechat/qrcode',
  function(req, res, next) {
    var attrArr = req.flash(FLASH_KEY_OF_WECHAT_CODE_URL);
    http_util.pipe('facade', {
      method: 'POST',
      url: '/qrcode/stream',
      data: {
        content: attrArr[0]
      }
    }, res);
  });

router.get('/pay/wechat/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    var orderNo = req.params.orderNo;
    // Multi-Requests#1
    var reqs = [], spreadOpts = [];
    // 1.获取订单数据 -> order
    reqs.push(cart_util.getOrderInfoByOrderNo(req, orderNo));
    spreadOpts.push({
      name: 'order',
      ignoreError: true
    });
    // 2.获取交易信息
    reqs.push(cart_util.getTradeInfoByOrderNo(req, orderNo));
    spreadOpts.push({
      name: 'trade',
      ignoreError: true
    });

    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(
        function(result) {
          handleOrderBeforeWeixinPay(req, res, next, result.order, result.trade);
        },
        http_util.errorHandler(req, res, next)
      );
  });

router.get('/pay/allinpay/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    var orderNo = req.params.orderNo;
    cart_util.getTradeInfoByOrderNo(req, orderNo)
      .done(
        function(trade) {
          http_util.pipe('facade', {
            timeout: 60000 /* in ms */ ,
            method: 'POST',
            url: '/order/pay',
            data: {
              payNo: trade.payNo,
              //userId: req.user.id,
              payChannel: 'ALLINPAY',
              tradeType: 'ALL_IN_PAY_WG'
            }
          }, res);
        },
        http_util.errorHandler(req, res, next)
      );
  });

function handleCartListMultiRequest(req, res, next, result) {
  var cartList = result.cartList,
      recommendSkuIds = result.recommendSkuIds;
  // Multi-Requests#2
  var reqs = [], spreadOpts = [];
  // 1.获取购物车商品SUMMARY -> cartProducts
  if (cartList && cartList.length) {
    reqs.push(http_util.request('queen', '/product/sku/summary/list/' + cartList.map(function(item) { return item.skuId; }).join(',')));
    spreadOpts.push({
      name: 'cartProducts',
      ignoreError: true
    });
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
        categorizeCartProducts(req, res, cartList, result.cartProducts, result.recentViewedProducts, result.recommendProducts);
      },
      http_util.errorHandler(req, res, next)
    );
}

function categorizeCartProducts(req, res, cartList, cartProducts, recentViewedProducts, recommendProducts) {
  var categorizedCartProducts = [],
      categorizedCartProductsMap = {},
      productQuantityMap = {};
  // 对购物车商品进行分类
  if (cartProducts && cartProducts.length) {
    cartProducts.forEach(function(product) {
      var warehouseId = product.warehouseId;
      if (!product.warehouseId) {
        logger.warn('[cart] Product does not have stock info, remove it from shopping cart (skuId: %d)', product.skuId);
        cart_util.deleteProduct(req, res, product.skuId);
        return;
      }
      var cat = categorizedCartProductsMap[warehouseId];
      if (!cat) {
        cat = categorizedCartProductsMap[warehouseId] = {
          warehouseId: warehouseId,
          warehouseName: product.warehouseName,
          freightMethodId: product.freightMethodId,
          freightMethodName: product.freightMethodName,
          products: [],
          outOfStocks: [],
          orderActs: []
        };
        categorizedCartProducts.push(cat);
      }
      if (product.saleStatus === 'ON_SALE') {
        if (product.stockForSale > 0) {
          if (product.activityType === 'ORDER_PROMOTION') {
            cat.orderActs.push(product);
          } else {
            cat.products.push(product);
          }
        } else {
          cat.outOfStocks.push(product);
        }
      } else {
        // Product is off-shelf, add to cat.outOfStocks for the time being
        cat.outOfStocks.push(product);
      }
    });
    categorizedCartProducts.forEach(function(cat) {
      if (cat.orderActs.length) {
        cat.orderActs.sort(function(a, b) {
          return a.activityId - b.activityId;
        });
      }
    });
  }
  // skuId -> quantity
  cartList.forEach(function(item) {
    productQuantityMap[item.skuId] = item.quantity;
  });

  // 看看order页面是否有flash数据过来
  var arr = req.flash('preorderError'),
      preorderError = null;
  if (arr && arr.length) preorderError = arr.pop();  // use the last

  // at last render
  common_util.disableBrowserCache(res);  // LxC(2016-03-04): 该页面禁用浏览器端缓存，解决回退问题
  common_util.renderEx(req, res, 'cart/list', {
    title: common_util.titlePostfix('我的购物车'),
    categorizedCartProducts: categorizedCartProducts,
    productQuantityMap: productQuantityMap,
    recentViewedProducts: recentViewedProducts,
    recommendProducts: recommendProducts,
    preorderError: preorderError,
    product_util: product_util
  });
}

function handleOrderBeforeCheckout(req, res, next, order) {
  // failed to load order info
  if (!order) {
    logger.error('handleOrderBeforeCheckout -> order is null');
    res.redirect('member-orders.html');
    return;
  }

  if (order.orderStatus === 'PENDING_PAY') {
    // 跳转到预支付界面
    common_util.disableBrowserCache(res);  // 禁用浏览器端缓存，back的时候要求刷新页面
    common_util.renderEx(req, res, 'cart/checkout', {
      title: common_util.titlePostfix('完成支付'),
      order: order,
      order_util: order_util
    });
  } else {
    // 非待支付状态跳转到订单查看页面
    logger.error('handleOrderBeforeCheckout -> ORDER_STATUS: %s, not PENDING_PAY', order.orderStatus);
    res.redirect('member-orders-view-' + order.orderNo + '.html');
  }
}

function handleOrderBeforeWeixinPay(req, res, next, order, trade, options) {
  // failed to load order info
  if (!order) {
    res.redirect('member-orders.html');
    return;
  }

  if (order.orderStatus === 'PENDING_PAY') {
    if (!trade) {
      // failed to load trade info
      res.redirect('cart-checkout-' + order.orderNo + '.html');
      return;
    }

    // 获取预支付信息
    cart_util.getPayInfoByPayNo(req, trade.payNo, 'WX', 'WX_NATIVE')
      .done(
        function(payInfo) {
          // 缓存微信支付链接
          req.flash(FLASH_KEY_OF_WECHAT_CODE_URL, payInfo.payParams.codeUrl);
          // 跳转到WX支付界面
          common_util.renderEx(req, res, 'cart/checkout_wechat', {
            title: common_util.titlePostfix('购物车-微信支付'),
            order: order,
            order_util: order_util
          });
        },
        function(err) {
          // failed to load pay info
          res.redirect('cart-checkout-' + order.orderNo + '.html');
        }
      );
  } else {
    // 非待支付状态跳转到订单查看页面
    res.redirect('member-orders-view-' + order.orderNo + '.html');
  }
}

// ------------------------------------------------------------------------
// Ajax
// ------------------------------------------------------------------------

// 购物车添加商品
router.post('/product/add', function(req, res, next) {
  var body = req.body;
  cart_util.addProduct(req, res, body.skuId, body.quantity)
    .done(
      function(cartProductsCount) {
        res.json({
          success: true,
          data: cartProductsCount
        });
      },
      _errorHandler.bind(null, res)
    );
});

// 购物车批量更新商品
router.post('/product/updateBatch', function(req, res, next) {
  cart_util.batchUpdateProducts(req, res, req.body.products)
    .done(
      function() {
        res.json({
          success: true
        });
      },
      _errorHandler.bind(null, res)
    );
});

// 购物车删除商品
router.post('/product/delete', function(req, res, next) {
  cart_util.deleteProduct(req, res, req.body.skuId)
    .done(
      function(cartProductsCount) {
        res.json({
          success: true,
          data: cartProductsCount
        });
      },
      _errorHandler.bind(null, res)
    );
});

// 获取购物车列表，返回html
router.get('/product/list', function(req, res, next) {
  cart_util.listProducts(req)
    .done(
      function(cartList) {
        // 如果收藏的商品超过5个，取最新的5个商品，然后去获取商品详情
        var cartProductsCount = 0;
        if (cartList.length) {
          cartList.forEach(function(item) {
            cartProductsCount += item.quantity;
          });
          if (cartList.length > 5) {
            cartList = cartList.slice(0, 5);
          }
          http_util.request('queen', '/product/summary/list/' + cartList.map(function(item) { return item.skuId; }).join(','))
            .done(
              function(result) {
                if (result.success) {
                  _renderPopoverList(res, result.data, cartProductsCount, cartList);
                } else {
                  logger.error('[cart] GET /product/list failed: ' + result.error.message);
                  _renderPopoverList(res);
                }
              },
              function(err) {
                logger.error('[cart] GET /product/list error', err);
                _renderPopoverList(res);
              }
            );
        } else {
          _renderPopoverList(res);
        }
      },
      function(err) {
        logger.error('[cart] GET /product/list error', err);
        _renderPopoverList(res);
      }
    );
});

// 计算购物车商品个数
router.get('/product/count', _getCartProductsCount);

// 购物车选择商品进行计算
router.post('/select', function(req, res, next) {
  http_util.pipe('queen', {
      method: 'POST',
      url: '/cart/select',
      data: req.body
    }, res);
});

// 购物车下单进行计算
router.post('/preorder', function(req, res, next) {
  http_util.pipe('queen', {
      method: 'POST',
      url: '/cart/preorder',
      data: req.body
    }, res);
});

// 购物车订单页面，兑换优惠券并检查是否适用于本次订单
router.post('/coupon/redeem',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var userId = req.user.id,
        body = req.body,
        items = null;
    try {
      items = JSON.parse(body.items);
    } catch (ignore) {}
    if (!items || !items.length) {
      logger.error('[cart/coupon/redeem] Illegal request, ip: %s, user_id: %d, req.body.items: %s',
          common_util.getReqIP(req), userId, body.items);
      _errorHandler(res, '非法的请求');
      return;
    }
    cart_util.redeemCouponAndCheckApplicable(userId, body.rcode, items, res);
  });

// 创建订单
router.post('/checkout',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var body = req.body;
    http_util.pipe('facade', {
      method: 'POST',
      url: '/order/create',
      data: {
        userId: req.user.id,
        items: body.items,
        shipAddrId: body.shipAddrId,
        buyerMemo: body.buyerMemo,
        couponId: body.couponId,
        fromMobile: body.fromMobile
      }
    }, res);
  });


// ------------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------------

function _getCartProductsCount(req, res) {
  cart_util.countProducts(req)
    .done(
      function(count) {
        res.json({
          success: true,
          data: count
        });
      },
      _errorHandler.bind(null, res)
    );
}

function _renderPopoverList(res, cartProducts, cartProductsCount, cartList)  {
  var productQuantityMap = {};
  if (cartList && cartList.length) {
    cartList.forEach(function(item) {
      productQuantityMap[item.skuId] = item.quantity;
    });
  }
  res.render('cart/popover_list', {
    cartProducts: cartProducts,
    cartProductsCount: cartProductsCount,
    productQuantityMap: productQuantityMap
  });
}

function _errorHandler(res, err) {
  res.json({
    success: false,
    error: {
      message: '' + err
    }
  });
}

module.exports = router;
