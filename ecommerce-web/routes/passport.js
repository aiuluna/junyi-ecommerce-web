var util = require('util'),
    Q = require('q'),
    express = require('express'),
    extend = require('extend'),
    auth = require('../auth'),
    config = require('../config'),
    logger = require('../logger'),
    user_track = require('../user_track'),
    web_const = require('../web_const'),
    common_data = require('../common_data'),
    common_util = require('../util/common_util'),
    http_util = require('../util/http_util'),
    cart_util = require('../util/cart_util');

var router = express.Router(),
    WEB_NAME = config.web.name,
    USER_REFERRAL_COOKIE_KEY = web_const.USER_REFERRAL_COOKIE_KEY;

// ------------------------------------------------------------------------
// pages
// ------------------------------------------------------------------------

router.get('/signup', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 已登录，跳转到用户中心
    res.redirect('/member.html');
    return;
  }
  auth.rememberReferer(req);
  http_util.request('facade', {
      method: 'GET',
      url: '/user/captcha/issue',
      data: {
        width: 110,
        height: 42
      }
    })
    .done(
      http_util.resultMessageHandler(function(captchaKey) {
        res.render('passport/signup', {
          title: common_util.titlePostfix('注册'),  // begin
          welcomeMsg: '欢迎注册',  // header_passport
          siteName: WEB_NAME,  // header_passport
          adsSetting: common_data.getPageAdsSetting('REGISTER_PAGE'),
          captcha: {
            captchaKey: captchaKey
          }
        });
      }, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

router.get('/login', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 已登录，跳转到用户中心
    res.redirect('/member.html');
    return;
  }
  if (req.query.redirectUrl) {
    auth.getLoginRedirectUrl(req); // clear
    auth.setLoginRedirectUrl(req, req.query.redirectUrl);
  } else {
    auth.rememberReferer(req);
  }
  var mobile = req.flash('login-mobile');
  if (mobile.length) {
    mobile = mobile[mobile.length - 1];  // use the last
  } else {
    mobile = '';
  }
  res.render('passport/login', {
    title: common_util.titlePostfix('登录'),  // begin
    welcomeMsg: '欢迎登录',  // header_passport
    siteName: WEB_NAME,  // header_passport
    adsSetting: common_data.getPageAdsSetting('LOGIN_PAGE'),
    mobile: mobile
  });
});

router.get('/forgot', function(req, res, next) {
  if (req.isAuthenticated()) {
    // 已登录，跳转到用户中心
    res.redirect('/member.html');
    return;
  }
  http_util.request('facade', {
      method: 'GET',
      url: '/user/captcha/issue',
      data: {
        width: 110,
        height: 42
      }
    })
    .done(
      http_util.resultMessageHandler(function(captchaKey) {
        res.render('passport/forgot', {
          title: common_util.titlePostfix('忘记密码'),  // begin
          welcomeMsg: '忘记密码',  // header_passport
          siteName: WEB_NAME,  // header_passport
          adsSetting: common_data.getPageAdsSetting('RESET_PASSWORD_PAGE'),
          captcha: {
            captchaKey: captchaKey
          }
        });
      }, req, res, next),
      http_util.errorHandler(req, res, next)
    );
});

router.get('/logout', function(req, res, next) {
  // 登出当前session
  req.logout();
  // 清除rememberMe cookie
  res.clearCookie(config.cookie.rememberMe.key);
  // 返回之前页面或者首页
  var returnUrl = req.get('referer');
  if (returnUrl) {
    if (returnUrl.indexOf('/member') > -1) {
      returnUrl = '/';  // 从“会员中心”登出，回到首页
    } else if (returnUrl.indexOf('/cart') > -1) {
      returnUrl = '/cart.html';  // 从“购物车”任何页面登出，返回购物车列表页
    }
  }
  res.redirect(returnUrl || '/');
});

//用于登出是强制调到登录页面
router.get('/forceLogin',function(req, res, next){
  // 登出当前session
  req.logout();
  // 清除rememberMe cookie
  res.clearCookie(config.cookie.rememberMe.key);

  res.redirect('/passport-login.html');
});

// ------------------------------------------------------------------------
// APIs
// ------------------------------------------------------------------------

// 判断用户是否已经登录
router.post('/check',
  auth.requireAuthAjax(),
  function(req, res, next) {
    res.json({
      success: true
    });
  });

router.get('/captcha/image/:captchaKey', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'GET',
      url: '/user/captcha/image/' + req.params.captchaKey,
      data: { r: req.query.r }
    }, res);
});

router.post('/check/mobile', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'POST',
      url: '/user/check/mobile',
      data: {
        mobile: req.body.mobile
      }
    }, res);
});

router.post('/check/login', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'GET',
      url: '/user/check/login',
      data: {
        login: req.body.login
      }
    }, res);
});

router.post('/signup/verifyCode/:mobile', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'POST',
      url: '/user/signup/verifyCode/' + req.params.mobile,
      timeout: 60000
    }, res);
});

router.post('/register', function(req, res, next) {
  var data = extend({}, req.body),
      referralUserId = req.cookies[USER_REFERRAL_COOKIE_KEY];
  // 如果用户是别人推广过来的，记录一下referralUserId
  if (referralUserId) data.referralUserId = referralUserId;
  http_util.request('facade', {
      method: 'POST',
      url: '/user/register',
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

router.post('/login',
  auth.passport.authenticate('local'),
  function(req, res, next) {
    var user = req.user;
    // LxC(2016-03-04): 暂时提前到这一步来绑定微信ID
    if (common_util.isWeixinBrowser(req)) {
      var openId = req.body.openId;
      if (!openId) {
        logger.warn('[login] User login from Weixin but does not have OPENID');
      } else {
        // async
        bindWeixin(user.id, openId, function(err) {
          if (err) logger.error('[login] Failed to bind WEIXIN_OPENID to user %d', user.id, err);
        });
      }
    }
    if (user.mobileVerified === 'N') {
      req.logout();  // 老用户绑定手机号才能登陆
      res.json({
        success: true,
        data: {
          token: generateBindToken(user.id),  // 直接传回user.id不安全，加密一下
          mobile: user.mobile,
          mobileVerified: 'N'
        }
      });
      return;
    }
    if (req.body.rememberMe === 'Y') {
      auth.setRememberMeCookie(res, user.rememberMeToken);
    }
    handleUserLoggedIn(req, res);
  }
);

router.post('/bind/verifyCode/:mobile', function(req, res, next) {
  var token = req.body.token, userId;
  if (!token || !(userId = parseBindToken(token))) {
    res.json({
      success: false,
      error: {
        message: '缺少参数token'
      }
    });
    return;
  }
  http_util.pipe('facade', {
      method: 'POST',
      url: '/user/bind/verifyCode/' + req.params.mobile,
      data: {
        userId: userId
      },
      timeout: 60000
    }, res);
});

router.post('/bind/mobile', function(req, res, next) {
  var token = req.body.token, userId;
  if (!token || !(userId = parseBindToken(token))) {
    res.json({
      success: false,
      error: {
        message: '缺少参数token'
      }
    });
    return;
  }
  http_util.request('facade', {
      method: 'POST',
      url: '/user/bind/mobile',
      data: {
        userId: userId,
        mobile: req.body.mobile,
        mobileCode: req.body.mobileCode
      }
    })
    .done(
      function(result) {
        if (result.success) {
          // result.data -> UserVO, 调用req.login来登录
          req.login(result.data, function(err) {
            if (err) { return next(err); }
            handleUserLoggedIn(req, res);
          });
        } else {
          res.json(result);
        }
      },
      http_util.errorHandlerJSON(req, res, next)
    );
});

router.post('/resetpwd/verifyCode/:mobile', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'POST',
      url: '/user/resetpwd/verifyCode/' + req.params.mobile,
      timeout: 60000
    }, res);
});

router.post('/resetmobile/verifyCode/:mobile', function(req, res, next) {
  http_util.pipe('facade', {
      method: 'POST',
      url: '/user/resetmobile/verifyCode/' + req.params.mobile,
      timeout: 60000
    }, res);
});

router.post('/resetPwd', function(req, res, next) {
  http_util.request('facade', {
      method: 'POST',
      url: '/user/resetPwd',
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

router.post('/resetOldPwd',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = req.body;
    data.userId = req.user.id;
    http_util.request('facade', {
        method: 'POST',
        url: '/user/resetOldPwd',
        data: data
      }).done(
      function(json) {
        if (json.success) {
          req.flash('login-mobile', req.user.mobile);
          req.logout();
          res.clearCookie(config.cookie.rememberMe.key);
        } else {
          if (json.error.code === 304) {
            req.logout();
            res.clearCookie(config.cookie.rememberMe.key);
          }
        }
        res.json(json);
      },
      http_util.errorHandlerJSON(req, res, next)
    );
});

router.post('/resetMobile',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var user = req.user;
    req.body.userId = user.id;
    http_util.request('facade', {
      method: 'POST',
      url: '/user/resetMobile',
      data: req.body
    }).done(
      function(json) {
        if(json.success){
          req.logout();
          res.clearCookie(config.cookie.rememberMe.key);
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

function bindWeixin(userId, openId, callback) {
  http_util.request('facade', {
      method: 'POST',
      url: '/user/bind/weixin',
      data: {
        userId: userId,
        openId: openId
      }
    })
    .done(
      function(result) {
        if (result.success) {
          callback(null);
        } else {
          callback(result.error.message);
        }
      },
      function(err) {
        callback(err);
      }
    );
}

var BIND_PREFIX = 'bind-';
function generateBindToken(userId) {
  return common_util.encryptCookie(BIND_PREFIX + userId);
}

function parseBindToken(token) {
  var s = common_util.decryptCookie(token);
  if (s && s.indexOf(BIND_PREFIX) === 0) {
    return s.substring(BIND_PREFIX.length);
  }
  return null;
}

module.exports = router;
