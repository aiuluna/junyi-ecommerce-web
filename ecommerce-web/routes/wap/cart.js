var express = require('express'),
    config = require('../../config'),
    auth = require('../../auth'),
    logger = require('../../logger'),
    web_const = require('../../web_const'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    product_util = require('../../util/product_util'),
    cart_util = require('../../util/cart_util'),
    order_util = require('../../util/order_util'),
    weixin_oauth = require('../../util/weixin_oauth');

var FLASH_KEY_OF_WECHAT_CODE_URL = web_const.FLASH_KEY_OF_WECHAT_CODE_URL,
    WEB_ROOT_URL = config.web.rootUrl,
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
    var userId = req.user.id,
        items = null;
    try {
      items = JSON.parse(req.body.items);
    } catch (ignore) {}
    if (!items || !items.length) {
      logger.error('[wap/cart/order] Illegal request, ip: %s, user_id: %d, req.body.items: %s',
          common_util.getReqIP(req), userId, req.body.items);
      res.redirect(FAILURE_REDIRECT);
      return;
    }
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
          common_util.renderMobile(req, res, 'cart/order', {
            title: common_util.titlePostfix('提交订单'),
            itemsJSON: JSON.stringify(items),
            applicableCouponsJSON: JSON.stringify(cartPreOrderInitResponse.applicableCoupons || []),
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
    // Multi-Requests
    var isWeixinBrowser = common_util.isWeixinBrowser(req),
        openId = isWeixinBrowser ? req.query.openId : null,
        reqs = [], spreadOpts = [];
    // 1.获取订单数据
    var orderNo = req.params.orderNo;
    reqs.push(cart_util.getOrderInfoByOrderNo(req, orderNo));
    spreadOpts.push({
      name: 'order',
      ignoreError: true
    });
    // 2.获取微信的OPENID
    if (isWeixinBrowser && !openId) {
      reqs.push(http_util.request('facade', '/user/weixin/' + req.user.id));
      spreadOpts.push({
        name: 'weixinOpenid',
        ignoreError: true
      });
    }

    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(
        function(result) {
          if (isWeixinBrowser && !weixin_oauth.skipOAuth()) {
            openId = openId || result.weixinOpenid;
            if (!openId) {
              // 获取openId
              if (!weixin_oauth.authReley(req, res)) {
                weixin_oauth.getRedirectUrl(req.originalUrl)
                  .done(
                    function(redirectUrl) {
                      res.redirect(redirectUrl);
                    },
                    function(err) {
                      next(err);
                    }
                  );
              }
              return;
            }
          }
          handleOrderBeforeCheckout(req, res, next, result.order, openId);
        },
        http_util.errorHandler(req, res, next)
      );
});

router.get('/pay/alipay/:orderNo',
  function(req, res, next) {
    if (common_util.isWeixinBrowser(req)) {
      // 微信里面没法访问支付宝wap支付页面，跳出提出“在浏览器中打开”
      common_util.renderMobile(req, res, 'cart/checkout_alipay', {
        _bodyClass: 'bg_white',
        _enableWxShare: true,
        title: '支付宝支付',
        orderNo: req.params.orderNo
      });
      return;
    }
    var orderNo = req.params.orderNo,
        returnUrl = '';
    if (WEB_ROOT_URL) {
      returnUrl = WEB_ROOT_URL + '/wap/cart-pay-done-' + orderNo + '.html';
    }
    cart_util.getTradeInfoByOrderNo(req, orderNo, returnUrl)
      .done(
        function(trade) {
          http_util.pipe('facade', {
            timeout: 60000 /* in ms */,
            method: 'POST',
            url: '/order/pay',
            data: {
              payNo: trade.payNo,
              payChannel: 'ALIPAY',
              tradeType:　'ALI_WAP_DIRECT'
            }
          }, res);
        },
        http_util.errorHandler(req, res, next)
      );
});


router.get('/pay/allinpay/:orderNo',
  function(req, res, next) {
    var orderNo = req.params.orderNo,
        returnUrl = '';
    if (WEB_ROOT_URL) {
      returnUrl = WEB_ROOT_URL + '/wap/cart-pay-done-' + orderNo + '.html';
    }
    cart_util.getTradeInfoByOrderNo(req, orderNo, returnUrl)
      .done(
        function(trade) {
          http_util.pipe('facade', {
            timeout: 60000 /* in ms */,
            method: 'POST',
            url: '/order/pay',
            data: {
              payNo: trade.payNo,
              payChannel: 'ALLINPAY',
              tradeType:　'ALL_IN_PAY_WAP'
            }
          }, res);
        },
        http_util.errorHandler(req, res, next)
      );
});
router.get('/pay/offline/:orderNo',
  function(req, res, next) {
    var orderNo = req.params.orderNo;
    // Multi-Requests
    var reqs = [], spreadOpts = [];
    // 1.获取条形码 -> barcodeBase64
    reqs.push(http_util.request('facade', {
        method: 'post',
        url: '/barcode/base64',
        data: {
          content: orderNo
        }
      })
    );
    spreadOpts.push('barcodeBase64');
    // 2.获取二维码 -> qrcodeBase64
    reqs.push(http_util.request('facade', {
        method: 'post',
        url: '/qrcode/base64',
        data: {
          content: orderNo
        }
      })
    );
    spreadOpts.push('qrcodeBase64');

    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(
        function(result) {
          common_util.renderMobile(req, res, 'cart/checkout_offline', {
            _bodyClass: 'bg_white',
            title: '线下支付',
            orderNo: orderNo,
            barcodeBase64: result.barcodeBase64,
            qrcodeBase64: result.qrcodeBase64
          });
        },
        http_util.errorHandler(req, res, next)
      );
  });

router.get('/pay/done/:orderNo',
  function(req, res, next) {
    common_util.renderMobile(req, res, 'cart/checkout_done', {
      title: common_util.titlePostfix('付款成功'),
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
// ajax

router.post('/pay/wechat',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var orderNo = req.body.orderNo,
        openId = req.body.openId;
    if (!orderNo || !openId) {
      handleErr(res, 'Parameter required: orderNo or openId');
      return;
    }
    // Multi-Requests#1
    var reqs = [], spreadOpts = [];
    // 1.获取订单数据 -> order
    reqs.push(cart_util.getOrderInfoByOrderNo(req, orderNo));
    spreadOpts.push({
      name: 'order',
      ignoreError: true
    });
    // 2.获取交易信息
    var returnUrl = '';
    if (WEB_ROOT_URL) {
      returnUrl = WEB_ROOT_URL + '/wap/cart-pay-done-' + orderNo + '.html';
    }
    reqs.push(cart_util.getTradeInfoByOrderNo(req, orderNo, returnUrl, openId));
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

router.post('/pay/error',
  auth.requireAuthAjax(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'POST',
      url: '/order/pay/error',
      data: req.body
    }, res);
  });

function handleCartListMultiRequest(req, res, next, result) {
  var cartList = result.cartList;
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

  http_util.multiRequest(reqs)
    .spread(http_util.spreadMap(spreadOpts))
    .done(
      function(result) {
        categorizeCartProducts(req, res, cartList, result.cartProducts);
      },
      http_util.errorHandler(req, res, next)
    );
}

function categorizeCartProducts(req, res, cartList, cartProducts) {
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
  common_util.renderMobile(req, res, 'cart/list', {
    _footerNav: 'cart',
    title: common_util.titlePostfix('购物车'),
    categorizedCartProducts: categorizedCartProducts,
    productQuantityMap: productQuantityMap,
    preorderError: preorderError,
    product_util: product_util
  });
}

function handleOrderBeforeCheckout(req, res, next, order, openId) {
  // failed to load order info
  if (!order) {
    logger.error('handleOrderBeforeCheckout -> order is null');
    res.redirect('member-orders-list.html?status=PENDING_PAY');
    return;
  }

  if (order.orderStatus === 'PENDING_PAY') {
    // 跳转到预支付界面
    common_util.disableBrowserCache(res);  // 禁用浏览器端缓存，back的时候要求刷新页面
    common_util.renderMobile(req, res, 'cart/checkout', {
      title: common_util.titlePostfix('完成支付'),
      order: order,
      openId: openId,
      order_util: order_util
    });
  } else {
    // 非待支付状态跳转到订单查看页面
    logger.error('handleOrderBeforeCheckout -> ORDER_STATUS: %s, not PENDING_PAY', order.orderStatus);
    // 防止反复跳转
    var referer = req.get('referer');
    if (referer && referer.indexOf('member-orders-view-') !== -1) {
      // 跳转回订单列表页
      res.redirect('member-orders-list.html');
    } else {
      res.redirect('member-orders-view-' + order.orderNo + '.html');
    }
  }
}

function handleOrderBeforeWeixinPay(req, res, next, order, trade) {
  if (!order) {
    handleErr(res, '服务器错误：无法加载订单信息');
    return;
  }

  if (order.orderStatus === 'PENDING_PAY') {
    if (!trade) {
      handleErr(res, '服务器错误：无法生成交易信息');
      return;
    }

    // 获取预支付信息
    http_util.pipe('facade', {
        method: 'POST',
        url: '/order/pay',
        timeout: 60000 /* in ms */,
        data: {
          payNo: trade.payNo,
          payChannel: 'WX',
          tradeType: 'WX_JSAPI'
        }
      }, res);
  } else {
    handleErr(res, '订单已支付或者已过期');
  }
}

function handleErr(res, err) {
  res.json({
    success: false,
    error: {
      message: err
    }
  });
}

module.exports = router;
