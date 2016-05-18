var express = require('express'),
    auth = require('../../auth'),
    logger = require('../../logger'),
    config = require('../../config'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    image_util = require('../../util/image_util'),
    order_util = require('../../util/order_util'),
    needle = require('needle'),
    multiparty = require('multiparty'),
    web_const = require('../../web_const'),
    common_data = require('../../common_data'),
    user_track = require('../../user_track'),
    cart_util = require('../../util/cart_util'),
    extend = require('extend'),
    moment = require('moment'),
    Q = require('q');

var router = express.Router(),
    USER_REFERRAL_COOKIE_KEY = web_const.USER_REFERRAL_COOKIE_KEY;

//优惠券扫码
router.get('/obtain',
  common_util.userReferralHook,
  function (req, res, next) {
    var rcode = req.query.rcode;
    function handler(json) {
      var batch, mobile;
      if(json.success) {
        batch = json.data;
        if(req.user) {
          mobile = req.user.mobile || req.user.login;
          http_util.request('facade', {
            url: '/user/coupon/obtain',
            method: 'post',
            data: {
              userId: req.user.id,
              rcode: rcode,
              method: 'QRCODE'
            }
          }).done(function(result) {
            common_util.renderMobile(req, res, 'coupon/coupon_obtain', {
              title: '领取优惠券',
              mobile: mobile,
              result: result,
              batch: batch,
              _enableWxShare: true
            });
          }, http_util.errorHandlerJSON(req, res, next))
        } else {
          common_util.renderMobile(req, res, 'coupon/coupon_obtain', {
            title: '领取优惠券',
            batch: batch,
            _enableWxShare: true
          });
        }
      } else {
        common_util.renderMobile(req, res, 'coupon/coupon_obtain', {
          title: '领取优惠券',
          _enableWxShare: true
        });
      }
    }
    http_util.request('facade', {
      url: '/user/coupon/view/' + rcode,
      method: 'get'
    }).done( handler,
      http_util.errorHandler(req, res, next)
    );
  }
);

router.get('/signup', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 登出当前用户
    req.logout();
    // 清除rememberMe cookie
    res.clearCookie(config.cookie.rememberMe.key);
  }
  auth.rememberReferer(req);
  var mobile = req.flash('signup-mobile');
  if (mobile.length) {
    mobile = mobile[mobile.length - 1];  // use the last
  } else {
    mobile = '';
  }
  common_util.renderMobile(req, res, 'coupon/signup', {
    _bodyClass: 'bg_white',
    mobile: mobile,
    title: common_util.titlePostfix('注册领取')
  });
});
// ------------------------------------------------------------------------
// APIs
// ------------------------------------------------------------------------

router.post('/register', function(req, res, next) {
  var data = extend({}, req.body),
    referralUserId = req.cookies[USER_REFERRAL_COOKIE_KEY];
  // 如果用户是别人推广过来的，记录一下referralUserId
  if (referralUserId) data.referralUserId = referralUserId;
  http_util.request('facade', {
      method: 'POST',
      url: '/user/mobile/register',
      data: data
    })
    .done(
      function(json) {
        if (json.success) {
          // 删除推广cookie
          if (referralUserId) {
            res.clearCookie(USER_REFERRAL_COOKIE_KEY);
          }
          // LxC(2016-03-24): 注册成功默认登录
          auth.loginManually(req, res, function(err) {
            if (err) {
              // 注册后自动登录失败，跳转到登录页面，默认带出之前输入的手机号
              req.flash('login-mobile', req.body.mobile);
              res.json({
                success: true,
                data: {
                  loggedIn: false
                }
              });
            } else {
              // 注册后自动登录成功
              handleUserLoggedIn(req, res);
            }
          });
        } else {
          res.json(json);
        }
      },
      http_util.errorHandlerJSON(req, res, next)
    );
});

function handleUserLoggedIn(req, res) {
  var user = req.user,
    redirectUrl = auth.getLoginRedirectUrl(req);
  var jsonToRet = {
      success: true,
      data: {
        name: user.name,
        mobileVerified: 'Y',
        redirectUrl: redirectUrl
      }
    };
  Q.all([
      // link track with user
      user_track.linkTrackWithUser(req, res, user.id),
      // upload cart products from cookie to server
      cart_util.uploadProductsIfNeeded(req, res)
    ])
    .done(
      function() {
        res.json(jsonToRet);
      },
      function(err) {
        res.json(jsonToRet);
      }
    );
}
module.exports = router;
