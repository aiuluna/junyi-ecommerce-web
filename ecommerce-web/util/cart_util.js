var util = require('util'),
    Q = require('q'),
    config = require('../config'),
    logger = require('../logger'),
    web_const = require('../web_const'),
    http_util = require('./http_util'),
    common_util = require('./common_util'),
    order_util = require('../util/order_util');

var CART_COOKIE_KEY = web_const.CART_COOKIE_KEY,
    COOKIE_OPTIONS = config.cookie.track.options,
    FLASH_KEY_OF_WECHAT_CODE_URL = web_const.FLASH_KEY_OF_WECHAT_CODE_URL;

module.exports = {
  addProduct: addProduct,
  updateProduct: updateProduct,
  batchUpdateProducts: batchUpdateProducts,
  deleteProduct: deleteProduct,
  listProducts: listProducts,
  countProducts: countProducts,
  uploadProductsIfNeeded: uploadProductsIfNeeded,
  getCartSkuIdsFromCookie: getCartSkuIdsFromCookie,

  // 购物车下单页面：兑换优惠券并检查是否可用于本次订单
  redeemCouponAndCheckApplicable: redeemCouponAndCheckApplicable,

  /* checkout/pay */
  getTradeInfoByOrderNo: getTradeInfoByOrderNo,
  getOrderInfoByOrderNo: getOrderInfoByOrderNo,
  getPayInfoByPayNo: getPayInfoByPayNo
};

// 添加商品到购物车，返回当前购物车商品数量
function addProduct(req, res, skuId, quantity) {
  var deferred = Q.defer();
  if (!quantity) quantity = 1;  // 默认添加1件商品
  if (!_isNum(skuId) || !_isNum(quantity)) {
    deferred.reject(new TypeError('Invalid parameter: skuId=' + skuId + ', quantity=' + quantity));
  } else {
    if (req.user) {
      // 用户已登录，保存购物车数据到后台
      http_util.request('facade', {
          method: 'POST',
          url: '/user/cart/add',
          data: {
            userId: req.user.id,
            skuId: skuId,
            quantity: quantity
          }
        }).done(
          function(result) {
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
    } else {
      // 用户尚未登录，保存到cookie
      var cartProducts = _addProductToCookie(req, res, skuId, quantity);
      deferred.resolve(_countCartProductsQuantity(cartProducts));
    }
  }
  return deferred.promise;
}

// 更新购物车某商品数量，返回当前购物车商品数量
function updateProduct(req, res, skuId, quantity) {
  var deferred = Q.defer();
  if (!quantity) quantity = 1;  // 默认至少1件商品
  if (!_isNum(skuId) || !_isNum(quantity)) {
    deferred.reject(new TypeError('Invalid parameter: skuId=' + skuId + ', quantity=' + quantity));
  } else {
    if (req.user) {
      // 用户已登录，保存购物车数据到后台
      http_util.request('facade', {
          method: 'POST',
          url: '/user/cart/update',
          data: {
            userId: req.user.id,
            skuId: skuId,
            quantity: quantity
          }
        }).done(
          function(result) {
            if (result.success) {
              deferred.resolve(result.data);  // 返回当前购物车商品数量
            } else {
              deferred.reject(result.error.message);
            }
          },
          function(err) {
            deferred.reject(err);
          }
        );
    } else {
      // 用户尚未登录，保存到cookie
      var cartProducts = _updateProductInCookie(req, res, skuId, quantity);
      deferred.resolve(_countCartProductsQuantity(cartProducts));
    }
  }
  return deferred.promise;
}

function batchUpdateProducts(req, res, productsJSON) {
  var deferred = Q.defer();
  if (req.user) {
    // 用户已登录，保存购物车数据到后台
    http_util.request('facade', {
        method: 'POST',
        url: '/user/cart/updateBatch',
        data: {
          userId: req.user.id,
          products: productsJSON
        }
      }).done(
        function(result) {
          if (result.success) {
            deferred.resolve();
          } else {
            deferred.reject(result.error.message);
          }
        },
        function(err) {
          deferred.reject(err);
        }
      );
  } else {
    // 用户尚未登录，保存到cookie
    var products;
    try {
      products = JSON.parse(productsJSON);
    } catch (err) {
      deferred.reject(err);
      return;
    }
    if (products) {
      products.forEach(function(o) {
        _updateProductInCookie(req, res, o.skuId, o.quantity);
      });
    }
    deferred.resolve();
  }
  return deferred.promise;
}

// 删除购物车商品，返回当前购物车商品数量
function deleteProduct(req, res, skuId) {
  var deferred = Q.defer();
  if (!_isNum(skuId)) {
    deferred.reject(new TypeError('Invalid parameter: skuId=' + skuId));
  } else {
    if (req.user) {
      // 用户已经登录，从数据库删除记录
      http_util.request('facade', {
          method: 'POST',
          url: '/user/cart/delete',
          data: {
            userId: req.user.id,
            skuId: skuId
          }
        }).done(
          function(result) {
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
    } else {
      // 用户尚未登录，从cookie中删除记录
      var cartProducts = _deleteProductFromCookie(req, res, skuId);
      deferred.resolve(_countCartProductsQuantity(cartProducts));
    }
  }
  return deferred.promise;
}

function listProducts(req) {
  var deferred = Q.defer();
  if (req.user) {
    // 用户已经登录，从后台取购物车数据
    http_util.request('facade', {
        method: 'GET',
        url: '/user/cart/list/' + req.user.id
      }).done(
        function(result) {
          if (result.success) {
            deferred.resolve(result.data || []);
          } else {
            deferred.reject(result.error.message);
          }
        },
        function(err) {
          deferred.reject(err);
        }
      );
  } else {
    // 用户尚未登录，从cookie去购物车数据
    var cartProducts = _getCartProductsFromCookie(req);
    deferred.resolve(_map(cartProducts));
  }
  return deferred.promise;
}

function countProducts(req) {
  var deferred = Q.defer();
  if (req.user) {
    // 用户已经登录，从后台取购物车数据
    http_util.request('facade', {
        method: 'GET',
        url: '/user/cart/count/' + req.user.id
      }).done(
        function(result) {
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
  } else {
    // 用户尚未登录，从cookie去购物车数据
    var cartProducts = _getCartProductsFromCookie(req);
    deferred.resolve(_countCartProductsQuantity(cartProducts));
  }
  return deferred.promise;
}

// 用户登录的时候，如果之前有保存过购物车，将购物车内容放到服务器保存
function uploadProductsIfNeeded(req, res) {
  var deferred = Q.defer();
  if (!req.user) {
    deferred.reject(new Error('InvalidState: user is not logged in'));
  } else {
    var cartProducts = _getCartProductsFromCookie(req);
    if (cartProducts.length) {
      http_util.request('facade', {
          method: 'POST',
          url: '/user/cart/addBatch',
          data: {
            userId: req.user.id,
            products: JSON.stringify(_map(cartProducts))
          }
        })
        .done(
          function(result) {
            if (result.success) {
              _clearCartCookie(res);
              deferred.resolve();
            } else {
              logger.error('[cart_util] uploadProductsIfNeeded failed: ' + result.error.message);
              deferred.reject(result.error.message);
            }
          },
          function(err) {
            logger.error('[cart_util] uploadProductsIfNeeded error', err);
            deferred.reject(err);
          }
        );
    } else {
      _clearCartCookie(res);
      deferred.resolve();
    }
  }
  return deferred.promise;
}

function getCartSkuIdsFromCookie(req) {
  var cartProducts = _getCartProductsFromCookie(req);
  return cartProducts.map(function(item) {
    return item[0];
  });
}


function _getCartProductsFromCookie(req) {
  var cookieVal = req.cookies[CART_COOKIE_KEY], cartProducts = null;
  if (cookieVal) {
    try {
      cartProducts = JSON.parse(cookieVal);
    } catch(e) {
      logger.warn('Could not parse _CART cookie value: %s', cookieVal);
    }
  }
  if (!cartProducts || !util.isArray(cartProducts)) {
    cartProducts = [];
  } else {
    // 检查cartProducts是否合法
    var valid = true, i, item;
    for (i = 0; i < cartProducts.length; ++i) {
      item = cartProducts[i];
      if (!(util.isArray(item) && item.length === 3 && _isNum(item[0] /* skuId */) && _isNum(item[1] /* quantity */) && _isNum(item[2] /* addTime */))) {
        valid = false;
        break;
      }
    }
    if (!valid) {
      logger.warn('Invalid _CART cookie value: %s', cookieVal);
      cartProducts = [];
    }
  }
  return cartProducts;
}

function _saveCartProductsToCookie(res, cartProducts) {
  res.cookie(CART_COOKIE_KEY, JSON.stringify(cartProducts), COOKIE_OPTIONS);
}

function _addProductToCookie(req, res, skuId, quantity) {
  var cartProducts = _getCartProductsFromCookie(req);
  if (cartProducts.length) {
    // 查看skuId是否被添加过
    var idx = -1, i, item;
    for (i = 0; i < cartProducts.length; ++i) {
      item = cartProducts[i];
      if (item[0] == skuId) {
        idx = i;
        break;
      }
    }
    if (idx > -1) {
      item = cartProducts.splice(idx, 1)[0];
      quantity = Number(quantity) + item[1];  // 加上之前的quantity
    }
  }
  cartProducts.unshift([skuId, Number(quantity), Date.now()]);
  _saveCartProductsToCookie(res, cartProducts);
  return cartProducts;
}

function _updateProductInCookie(req, res, skuId, quantity) {
  var cartProducts = _getCartProductsFromCookie(req);
  if (cartProducts.length) {
    // 查看skuId是否被添加过
    var idx = -1, i, item;
    for (i = 0; i < cartProducts.length; ++i) {
      item = cartProducts[i];
      if (item[0] == skuId) {
        idx = i;
        break;
      }
    }
    if (idx > -1) {
      cartProducts.splice(idx, 1);  // 删除即可
    }
  }
  cartProducts.unshift([skuId, Number(quantity), Date.now()]);
  _saveCartProductsToCookie(res, cartProducts);
  return cartProducts;
}

function _deleteProductFromCookie(req, res, skuId) {
  var cartProducts = _getCartProductsFromCookie(req);
  if (cartProducts.length) {
    var idx = -1, i, item;
    for (i = 0; i < cartProducts.length; ++i) {
      item = cartProducts[i];
      if (item[0] == skuId) {
        idx = i;
        break;
      }
    }
    if (idx > -1) {
      cartProducts.splice(idx, 1);
      _saveCartProductsToCookie(res, cartProducts);
    }
  }
  return cartProducts;
}

function _clearCartCookie(res) {
  res.clearCookie(CART_COOKIE_KEY);
}

function _countCartProductsQuantity(cartProducts) {
  var count = 0;
  if (cartProducts) {
    cartProducts.forEach(function(item) {
      count += item[1];
    });
  }
  return count;
}

function _map(cartProducts) {
  return cartProducts.map(function(item) {
    return {
      skuId: item[0],
      quantity: item[1],
      addTime: item[2]
    };
  });
}

function _isNum(val) {
  if (typeof val === 'number') return true;
  if (typeof val === 'string') {
    val = Number(val);
    return !isNaN(val);
  }
  return false;
}


function redeemCouponAndCheckApplicable(userId, redeemCode, items, res) {
  http_util.request('facade', {
      method: 'POST',
      url: '/user/coupon/obtain',
      data: {
        userId: userId,
        rcode: redeemCode,
        method: 'REDEEM_CODE'
      }
    })
    .done(
      function(result) {
        if (result.success) {
          var coupon = result.data;
          _checkCouponApplicable(items, coupon, res);
        } else {
          res.json(result);
        }
      },
      function(err) {
        _errorHandler(res, '服务器错误，请稍后重试');
      }
    );
}

function _checkCouponApplicable(items, coupon, res) {
  http_util.request('queen', {
      method: 'POST',
      url: '/cart/coupon/applicable',
      data: {
        json: JSON.stringify({
          items: items,
          couponId: coupon.id
        })
      }
    })
    .done(
      function(result) {
        if (result.success) {
          var data = result.data;
          if (data.applicable) {
            res.json({
              success: true,
              data: coupon
            });
          } else {
            _errorHandler(res, '优惠券兑换成功，但不适用于本订单');
          }
        } else {
          res.json(result);
        }
      },
      function(err) {
        _errorHandler(res, '服务器错误，请稍后重试');
      }
    );
}

function _errorHandler(res, err) {
  res.json({
    success: false,
    error: {
      message: '' + err
    }
  });
}


function getTradeInfoByOrderNo(req, orderNo, returnUrl, openId) {
  var deferred = Q.defer(),
      params = {
        //userId: req.user.id,
        orderNo: orderNo,
        clientIp: common_util.getReqIP(req)
      };
  if (returnUrl) params.returnUrl = returnUrl;
  if (openId) params.openId = openId;
  http_util.request('facade', {
    method: 'POST',
    url: '/order/pay/init',
    timeout: 60000 /* in ms */,
    data: params
  }).done(
    function(result) {
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

function getPayInfoByPayNo(req, payNo, payChannel, tradeType) {
  var deferred = Q.defer();
  // 用户已经登录
  http_util.request('facade', {
    method: 'POST',
    url: '/order/pay',
    timeout: 60000 /* in ms */,
    data: {
      //userId: req.user.id,
      payNo: payNo,
      payChannel: payChannel,
      tradeType: tradeType
    }
  }).done(
    function(result) {
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

function getOrderInfoByOrderNo(req, orderNo) {
  var deferred = Q.defer();
  // 用户已经登录
  http_util.request('facade', {
    method: 'GET',
    data: {
      userId: req.user.id
    },
    url: '/order/view/' + orderNo
  }).done(
    function(result) {
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
