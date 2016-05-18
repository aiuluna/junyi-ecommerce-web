var Q = require('q'),
    config = require('../config'),
    logger = require('../logger'),
    web_const = require('../web_const'),
    http_util = require('./http_util');

var weixinConfig = config.weixin || {},
    WEB_ROOT_URL = config.web.rootUrl,
    OAUTH_REDIRECT_URI = WEB_ROOT_URL + web_const.WEIXIN_OAUTH_REDIRECT_URI;

module.exports = {
  getRedirectUrl: getRedirectUrl,
  handleOAuthResponse: handleOAuthResponse,
  skipOAuth: function() {
    // TEST ONLY!!
    // 如果配置文件里面配置了skipOAuth=true，自动跳过代码里面需要Weixin OAuth的地方
    return !!weixinConfig.skipOAuth;
  },
  authReley: authRelay
};

function getRedirectUrl(pageUrl) {
  var deferred = Q.defer();
  http_util.request('ergate', {
      method: 'POST',
      url: '/weixinOAuth/init',
      data: {
        pageUrl: pageUrl,
        redirectUri: OAUTH_REDIRECT_URI
      },
      timeout: 30000  // 默认30秒，可能会超时
    })
    .done(
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

function handleOAuthResponse(req, res, next) {
  http_util.request('ergate', {
      method: 'POST',
      url: '/weixinOAuth/oauth',
      data: req.query,
      timeout: 60000  // 设置为60秒超时，因为后台需要获取access
    })
    .done(
      function(result) {
        if (result.success) {
          res.redirect(result.data);
        } else {
          var err = new Error(result.error.message);
          err.status = 500;
          next(err);
        }
      },
      function(err) {
        next(err);
      }
    );
}

// 通过代理服务器来跳转获取openId
function authRelay(req, res) {
  if (weixinConfig.authRelay) {
    var authRelayUrl = weixinConfig.authRelayUrl;
    if (authRelayUrl) {
      var redirectUrl = authRelayUrl + '?pageUrl=' + encodeURIComponent(WEB_ROOT_URL + req.originalUrl);
      logger.debug('Weixin OAuth relay: ' + redirectUrl);
      res.redirect(redirectUrl);
      return true;
    }
  }
  return false;
}