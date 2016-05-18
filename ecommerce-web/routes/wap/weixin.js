var express = require('express'),
    http_util = require('../../util/http_util'),
    weixin_oauth = require('../../util/weixin_oauth');

var router = express.Router();

// ajax for Weixin share
router.get('/getJsApiTicket', function(req, res, next) {
  http_util.pipe('ergate', {
      method: 'GET',
      url: '/weixinApi/getJsApiTicket',
      timeout: 30000  // 因为要访问第三方服务器，设置为30秒超时
    }, res);
});

// 获取openId
router.get('/oauth', weixin_oauth.handleOAuthResponse);

// test only
// -> 部署在服务号配置过的允许授权的域名下，获取openId后跳转到请求指定的pageUrl
router.get('/relay', function(req, res, next) {
  var pageUrl = req.query.pageUrl;
  weixin_oauth.getRedirectUrl(pageUrl)
    .done(
      function(redirectUrl) {
        res.redirect(redirectUrl);
      },
      function(err) {
        next(err);
      }
    );
});

module.exports = router;
