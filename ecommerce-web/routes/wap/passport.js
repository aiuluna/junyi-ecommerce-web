var util = require('util'),
    Q = require('q'),
    express = require('express'),
    extend = require('extend'),
    auth = require('../../auth'),
    config = require('../../config'),
    logger = require('../../logger'),
    user_track = require('../../user_track'),
    web_const = require('../../web_const'),
    common_data = require('../../common_data'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    cart_util = require('../../util/cart_util'),
    weixin_oauth = require('../../util/weixin_oauth');

var router = express.Router(),
    WEB_NAME = config.web.name,
    USER_REFERRAL_COOKIE_KEY = web_const.USER_REFERRAL_COOKIE_KEY;

// ------------------------------------------------------------------------
// pages
// ------------------------------------------------------------------------

router.get('/login', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 已登录，跳转到用户中心
    res.redirect('/wap/member.html');
    return;
  }
  // 如果用户从微信登录，尝试获取openId
  if (common_util.isWeixinBrowser(req) && !weixin_oauth.skipOAuth()) {
    // 如果在微信里面访问这个地址，需要判断是否已经通过认证(带上openId)
    var openId = req.query.openId;
    if (!openId) {
      // 记住跳转url
      rememberLoggedInRedirectUrl(req);
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
  } else {
    // 记住跳转url
    rememberLoggedInRedirectUrl(req);
  }
  var mobile = req.flash('login-mobile');
  if (mobile.length) {
    mobile = mobile[mobile.length - 1];  // use the last
  } else {
    mobile = '';
  }
  common_util.renderMobile(req, res, 'passport/login', {
    _bodyClass: 'bg_white',
    title: common_util.titlePostfix('登录'),
    mobile: mobile
  });
});

function rememberLoggedInRedirectUrl(req) {
  if (req.query.redirectUrl) {
    auth.getLoginRedirectUrl(req); // clear
    auth.setLoginRedirectUrl(req, req.query.redirectUrl);
  } else {
    auth.rememberReferer(req);
  }
}

//用于登出是强制调到登录页面
router.get('/forceLogin',function(req, res, next){
  // 登出当前session
  req.logout();
  // 清除rememberMe cookie
  res.clearCookie(config.cookie.rememberMe.key);

  res.redirect('/passport-login');
});

router.get('/signup', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 已登录，跳转到用户中心
    res.redirect('/wap/member.html');
    return;
  }
  auth.rememberReferer(req);
  common_util.renderMobile(req, res, 'passport/signup', {
    _bodyClass: 'bg_white',
    title: common_util.titlePostfix('快速注册')
  });
});

router.get('/signup/agreement', function(req, res, next) {
  common_util.renderMobile(req, res, 'passport/signup_agreement', {
    _bodyClass: 'bg_white',
    title: common_util.titlePostfix('注册协议')
  });
});

router.get('/forgot', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 已登录，跳转到用户中心
    res.redirect('/wap/member.html');
    return;
  }
  common_util.renderMobile(req, res, 'passport/forgot', {
    _bodyClass: 'bg_white',
    title: common_util.titlePostfix('忘记密码')
  });
});

router.get('/logout', function(req, res, next) {
  // 登出当前session
  req.logout();
  // 清除rememberMe cookie
  res.clearCookie(config.cookie.rememberMe.key);
  // 移动端退出后返回首页
  res.redirect('/wap/');
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
              handleUserLoggedIn(req, res, {
                success: true,
                data: {
                  loggedIn: true
                }
              });
            }
          });
        } else {
          res.json(json);
        }
      },
      http_util.errorHandlerJSON(req, res, next)
    );
});

router.post('/resetPwd', function(req, res, next) {
  http_util.request('facade', {
      method: 'POST',
      url: '/user/mobile/resetPwd',
      data: req.body
    })
    .done(
      function(json) {
        if (json.success) {
          // 注册成功跳转到登录页面，默认带出之前输入的手机号
          req.flash('login-mobile', req.body.mobile);
        }
        res.json(json);
      },
      http_util.errorHandlerJSON(req, res, next)
    );
});

function handleUserLoggedIn(req, res, jsonToRet) {
  var user = req.user,
      redirectUrl = auth.getLoginRedirectUrl(req);
  jsonToRet = jsonToRet || {
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
