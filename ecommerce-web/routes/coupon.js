var express = require('express'),
  auth = require('../auth'),
  logger = require('../logger'),
  common_util = require('../util/common_util'),
  http_util = require('../util/http_util'),
  image_util = require('../util/image_util'),
  order_util = require('../util/order_util'),
  needle = require('needle'),
  multiparty = require('multiparty'),
  common_data = require('../common_data'),
  extend = require('extend'),
  moment = require('moment');
var router = express.Router();


//通过兑换码获取
router.post('/obtain/redeem',
  auth.requireAuthAjax(),
  function (req, res, next) {

    var data = {
      userId: req.user.id,
      rcode : req.body.rcode,
      method: 'REDEEM_CODE'
    };

    http_util.pipe('facade', {
      method: 'POST',
      url: '/user/coupon/obtain',
      data: data
    }, res);
  }
);

//扫描二维码获取
router.post('/obtain/qrcode',
  function (req, res, next) {
    var data = {
      userId: req.user? req.user.id : "",
      mobile: req.body.mobile,
      rcode : req.body.rcode,
      method: 'QRCODE'
    };

    if(req.body.mobile) {
      req.flash('signup-mobile', req.body.mobile);
    }

    http_util.pipe('facade', {
      method: 'POST',
      url: '/user/coupon/obtain',
      data: data
    }, res);
  }
);

//商城点击获取
router.post('/obtain/shop',
  auth.requireAuthAjax(),
  function (req, res, next) {
    var data = {
      userId: req.user? req.user.id : "",
      rcode : req.body.rcode,
      method: 'SHOP_PAGE'
    };

    http_util.pipe('facade', {
      method: 'POST',
      url: '/user/coupon/obtain',
      data: data
    }, res);
  }
);

module.exports = router;
