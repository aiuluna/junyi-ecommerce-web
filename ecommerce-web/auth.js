var url = require('url'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    RememberMeStrategy = require('passport-remember-me-extended').Strategy,
    config = require('./config'),
    logger = require('./logger'),
    common_util = require('./util/common_util'),
    http_util = require('./util/http_util');

module.exports = {
  passport: passport,
  loginManually: loginManually,
  setRememberMeCookie: setRememberMeCookie,
  rememberReferer: rememberReferer,
  setLoginRedirectUrl: setLoginRedirectUrl,
  getLoginRedirectUrl: getLoginRedirectUrl,
  // Redirect to the login page if not authenticated
  requireAuth: function(options) {
    var opts = options || {},
        failureRedirect = opts.failureRedirect || 'passport-login.html';
    return function(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      setLoginRedirectUrl(req, req.originalUrl);
      res.redirect(failureRedirect);
    };
  },

  requireRoles: function() {
    var argLen = arguments.length;
    if (argLen === 0) {
      return function (req, res, next) {
        next();
      };
    }
    var roles = [];
    for (var i = 0; i < argLen; i++) {
      roles.push(arguments[i]);
    }
    var rolesLength = roles.length;
    return function(req, res, next) {
      // no role required
      if (rolesLength  === 0) {
        next();
      }

      var type = req.user.type, canNext = false;
      for (var i = 0; i < rolesLength; i++) {
        if (type === roles[i].toUpperCase()) {
          canNext = true;
          break;
        }
      }
      if (canNext) {
        next();
      } else {
        res.status(404);
        common_util.renderEx(req, res, '404');
      }
    };
  },

  // Returns 401 for ajax requests
  requireAuthAjax: function(options) {
    var opts = options || {},
        status = opts.status || 401;
    return function(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      var errMsg = {
        success: false,
        error: {
          code: status,
          message: '您的会话已过期，请重新登录'
        }
      };
      if (opts.dataType === 'text') {
        res.status(status).end(JSON.stringify(errMsg));
      } else {
        res.status(status).json(errMsg);
      }
    };
  }
};

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.
passport.serializeUser(function(user, done) {
  done(null, user);  // save directly to session (and then to redis)
});

passport.deserializeUser(function(user, done) {
  done(null, user);  // use the `user` object in session (retrieved from redis)
});


// Use the LocalStrategy within Passport.
passport.use(new LocalStrategy({
    usernameField: 'login',
    passwordField: 'password',
    passReqToCallback: true
  },
  function(req, login, password, done) {
    http_util.request('facade', {
        method: 'POST',
        url: '/user/login',
        data: {
          login: login,
          password: password,
          rememberMe: req.body.rememberMe
        },
        timeout: 30000  // 因为会访问老系统登录，设置timeout为30s
      })
      .done(
        function(json) {
          if (json.success) {
            done(null, json.data);
          } else {
            logger.warn('Login failed, login: %s, ip: %s, reason: %s', login, common_util.getReqIP(req), json.error.message);
            done(null, false, 'Login failed');
          }
        },
        function(err) {
          done(err, null);
        }
      );
  }
));

// Remember Me cookie strategy
var rememberMeCookieConfig = config.cookie.rememberMe;
passport.use(new RememberMeStrategy({
    key: rememberMeCookieConfig.key,
    cookie: rememberMeCookieConfig.options
  },
  function(token, done) {
    var rememberMeToken = common_util.decryptCookie(token);
    if (!rememberMeToken) {
      logger.warn('Failed to decrypt rememberMeToken: ' + token);
      done(null, false);
      return;
    }
    http_util.request('facade', {
        method: 'POST',
        url: '/user/rememberMeLogin',
        data: {
          rememberMeToken: rememberMeToken
        }
      })
      .done(
        function(json) {
          if (json.success) {
            var user = json.data;
            logger.info('User ' + user.mobile + ' (id: ' + user.id + ') login using rememberMeToken');
            done(null, user);
          } else {
            done(null, false, 'Login failed using rememberMeToken');
          }
        },
        function(err) {
          done(err, null);
        }
      );
  },
  issueRememberMeToken
));

// 发送登录请求登录，绕过passport框架
function loginManually(req, res, callback) {
  var body = req.body;
  http_util.request('facade', {
      method: 'POST',
      url: '/user/login',
      data: {
        login: body.mobile,
        password: body.password,
        rememberMe: 'N'
      },
      timeout: 30000  // 因为会访问老系统登录，设置timeout为30s
    })
    .done(
      function(json) {
        if (json.success) {
          // 调用req.login来登录
          req.login(json.data, callback);
        } else {
          callback(json.error.message);
        }
      },
      function(err) {
        callback(err);
      }
    );
}

// The original design: The token is single-use, so a new token is then issued to replace it.
// BUT now we're going to reuse the token if possible
function issueRememberMeToken(user, done) {
  done(null, common_util.encryptCookie(user.rememberMeToken));
}

function setRememberMeCookie(res, token) {
  res.cookie(rememberMeCookieConfig.key, common_util.encryptCookie(token), rememberMeCookieConfig.options);
}


// Remember browser Referer, and jump back when logged in
function rememberReferer(req) {
  var referer = req.get('referer');
  if (referer) {
    var urlObj = url.parse(referer),
      pathname = urlObj.pathname;
    if (pathname === '/' || pathname.indexOf('/passport') === 0)
      return;  // 这2个地址没必要记录，默认跳转到个人中心页面
    setLoginRedirectUrl(req, referer);
  }
}

function setLoginRedirectUrl(req, url) {
  req.flash('login-redirectUrl', url);
}

function getLoginRedirectUrl(req) {
  var redirectUrl = req.flash('login-redirectUrl');
  if (redirectUrl.length) {
    return redirectUrl[redirectUrl.length-1];  // use the last
  }
  return 'member.html';  // 默认跳转到个人中心页面
}