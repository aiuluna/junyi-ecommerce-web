var url = require('url'),
    crypto = require('crypto'),
    extend = require('extend'),
    config = require('../config'),
    common_data = require('../common_data'),
    logger = require('../logger'),
    web_const = require('../web_const');

var WEB_NAME = config.web.name,
    URI_APPENDIX = config.web.uriAppendix;

module.exports = {
  // 将网站名添加到网页title上
  titlePostfix: function(title) {
    return title + '-' + WEB_NAME;
  },

  // Come up missing fields for rendering
  renderEx: _renderEx,
  renderMobile: _renderMobile,
  genSEO: _genSEO,

  // 将请求的url变成服务器可以接受的格式
  rewriteUrl: _rewriteUrl,
  // 将uri变成浏览器接受的格式
  rewriteReverse: _rewriteReverse,
  // 如果用户在移动设备上打开非url，尝试转成相近的wap页面
  redirectMobile: _redirectMobile,
  // 是否为微信内置浏览器
  isWeixinBrowser: _isWeixinBrowser,

  // 如果用户是“代理商”或者“推广员”，在url添加referral
  userReferralHook: _userReferralHook,

  // 通过AES加密Cookie
  encryptCookie: _encryptCookie,
  // 通过AES解密Cookie
  decryptCookie: _decryptCookie,

  getReqIP: _getReqIP,
  disableBrowserCache: _disableBrowserCache
};

// 将请求的url变成服务器可以接受的格式
function _rewriteUrl(req, res) {
  // @see https://nodejs.org/api/http.html#http_message_url
  var urlObj = url.parse(req.url),
      pathname = urlObj.pathname,
      len = URI_APPENDIX.length;
  if (!pathname || pathname === '/' || pathname === '/wap' || pathname === '/wap/')
    return true;  // 首页(包括wap端)
  // 页面请求必须以设定的URI_APPENDIX结尾
  var idx = pathname.indexOf(URI_APPENDIX);
  if (idx > -1 && idx === pathname.length - len) {
    // 去除url结尾的.html后缀，并作rewrite
    pathname = pathname.slice(0, -len);
    pathname = pathname.replace(/-/g, '/');
    urlObj.pathname = pathname;
    req.url = url.format(urlObj);
    return true;
  }
  // 其他的应该为ajax请求
  // 如果不是ajax请求，同时method是GET，而且accept是text/html，修正url并重定向
  if (!req.xhr && req.method === 'GET') {
    var accept = req.get('accept');
    if (accept && accept.indexOf('text/html') !== -1) {
      if (req.query.ReferralUserId) {
        // 老系统带ReferralUserId的情况下，跳转到首页(老系统是以.aspx结尾的，不会进到上面)   TODO：删除之
        // LxC(2016-03-14): 只能放到这个位置，否则rewrite就破坏掉整个url了
        res.redirect('/?referral=' + req.query.ReferralUserId);
        return false;
      }
      if (pathname[pathname.length - 1] === '/') {
        pathname = pathname.substring(0, pathname.length - 1);
      }
      res.redirect(_rewriteReverse(pathname));
      return false;
    }
  }
  return true;
}

// 将uri变成浏览器接受的页面格式
function _rewriteReverse(uri) {
  var idx = uri.indexOf('?'),
      pathname = uri,
      search = '';
  if (idx !== -1) {
    search = uri.substring(idx);
    pathname = uri.slice(0, idx);
  }
  if (pathname) {
    if (pathname[0] === '/') {
      pathname = '/' + pathname.substring(1).replace(/\//g, '-');
    } else {
      pathname = pathname.replace(/\//g, '-');
    }
  }
  return pathname + URI_APPENDIX + search;
}

// 如果用户在移动设备上打开非url，尝试转成相近的wap页面
// NOTE：这个middleware必须在_rewriteUrl之后，它会用到已经rewrite过req.url
var wapRE = /^\/wap/;
function _redirectMobile(req, res) {
  var url = req.url;
  if (wapRE.test(url)) {
    req.wap = true;  // <-- 如果是wap请求，默认req.wap为true
    // TODO: 如果是微信回流，访问的URL会带上不同的参数
    // 参考：http://blog.csdn.net/wangbaokangfei/article/details/38755053
    // 朋友圈   from=timeline&isappinstalled=0
    // 微信群   from=groupmessage&isappinstalled=0
    // 好友分享 from=singlemessage&isappinstalled=0
    return true;
  }
  // 判断是否为网页请求，排除ajax请求
  if (!req.xhr && req.method === 'GET') {
    var accept = req.get('accept');
    if (accept && accept.indexOf('text/html') !== -1) {
      if (!_isMobileDevice(req)) return true;
      // 转成相近的wap url
      if (/^\/(product|topic|passport|article)/.test(url)) {
        // 跳转到wap对应页面
        res.redirect('/wap' + req.originalUrl);
      } else if (/^\/member/.test(url)) {
        // 跳转到wap个人中心默认页面
        res.redirect('/wap/member.html');
      } else if (/^\/cart/.test(url)) {
        // 跳转到wap购物车列表页面
        res.redirect('/wap/cart.html');
      } else {
        // 跳转到wap首页
        var referral = req.query.referral;
        if (referral) {
          res.redirect('/wap/?referral=' + referral);
        } else {
          res.redirect('/wap/');
        }
      }
      return false;
    }
  }
  return true;
}
// 通过浏览器useragent判断用户设备是否为手机，
// 参考：http://detectmobilebrowsers.com/   (http://detectmobilebrowsers.com/download/node)
// NOTE：上述脚本无法判断UC浏览器，稍微做了修改
// 关于UC浏览器的ua，参考：http://www.aiezu.com/code/server_http_user-agent_uc.html
var mRE1 = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|ucweb|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/,
    mRE2 = /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/;
function _isMobileDevice(req) {
  var ua = req.headers['user-agent'].toLowerCase();
  return mRE1.test(ua) || mRE2.test(ua.substr(0, 4));
}


// 如果用户是“代理商”或者“推广员”，在url添加referral
var COOKIE_OPTIONS = config.cookie.track.options,
    USER_REFERRAL_COOKIE_KEY = web_const.USER_REFERRAL_COOKIE_KEY;
function _userReferralHook(req, res, next) {
  if (req.user) {
    var user = req.user, userType = user.type, userIdStr = '' + user.id;
    // 如果用户是“代理商”或者“推广员”，在url添加referral
    if (userType === 'DISTRIBUTOR' || userType === 'PROMOTER') {
      var originalUrl = req.originalUrl;
      // 判断请求是否已经带上referral，如果带上，判断是否为当前用户id
      if (originalUrl.indexOf('referral=') === -1) {
        if (originalUrl.indexOf('?') < 0) {
          res.redirect(originalUrl + '?referral=' + user.id);
        } else {
          res.redirect(originalUrl + '&referral=' + user.id);
        }
        return;
      } else if (req.query.referral !== userIdStr) {
        // 如果不是当前用户id，替换成当前用户id并redirect
        res.redirect(originalUrl.replace(/referral=\d*/, 'referral=' + userIdStr));
        return;
      }
    }
  } else {
    if (req.query.referral) {
      res.cookie(USER_REFERRAL_COOKIE_KEY, req.query.referral, COOKIE_OPTIONS);
    } else if (req.query.ReferralUserId) {
      // 老系统用的是这个key，在过渡阶段也允许使用(只有/?ReferralUserId=xxx会进到这里，其他的rewrite都处理掉了)   TODO：删除之
      res.cookie(USER_REFERRAL_COOKIE_KEY, req.query.ReferralUserId, COOKIE_OPTIONS);
    }
  }
  next();
}


// ------------------------------------------------------------------------
// Encrypt and Decrypt
// ------------------------------------------------------------------------

var algorithm = 'aes-128-ecb';
var secret = config.cookie.secret;
var clearEncoding = 'utf8';
var cipherEncoding = 'base64';

function _encryptCookie(data) {
  var cipher = crypto.createCipher(algorithm, secret);
  try {
    return cipher.update(data, clearEncoding, cipherEncoding) + cipher.final(cipherEncoding);
  } catch (e) {
    logger.error('Failed to encrypt: "' + data + '", ' + e.stack);
    return null;
  }
}

function _decryptCookie(data) {
  var decipher = crypto.createDecipher(algorithm, secret);
  try {
    return decipher.update(data, cipherEncoding, clearEncoding) + decipher.final(clearEncoding);
  } catch (e) {
    logger.error('Failed to decrypt: "' + data + '", ' + e.stack);
    return null;
  }
}

// ------------------------------------------------------------------------
// Come up missing fields for rendering
// ------------------------------------------------------------------------

var seoConfig = config.web.seo || {},
    cnzzConfig = config.cnzz || {};

function _renderEx(req, res, view, locals, callback) {
  // 比较通用的数据，包括：
  // 1.登陆用户
  // 2.默认SEO配置
  // 3.默认网站配置
  // 等
  var data = {
    _user: req.user,
    _seo: seoConfig,
    _siteName: WEB_NAME,
    _siteConfig: common_data.getSiteConfig(),
    _headerNav: '',
    _cnzz: cnzzConfig
  };
  if (locals) extend(data, locals);
  res.render(view, data, callback);
}

function _renderMobile(req, res, view, locals, callback) {
  // 比较通用的数据，包括：
  // 1.登陆用户
  // 2.默认SEO配置
  // 3.默认网站配置
  // 等
  var data = {
    _user: req.user,
    _seo: seoConfig,
    _siteName: WEB_NAME,
    _siteConfig: common_data.getSiteConfig(),
    _bodyClass: '',
    _footerNav: '',
    _isWeixin: _isWeixinBrowser(req),
    _enableWxShare: false,
    _cnzz: cnzzConfig
  };
  if (locals) extend(data, locals);
  res.render('wap/' + view, data, callback);
}

function _isWeixinBrowser(req) {
  var ua = req.headers['user-agent'].toLowerCase();
  return ua.indexOf('micromessenger') !== -1;
}

function _genSEO(metaKeywords, metaDescription) {
  return {
    metaKeywords: metaKeywords || seoConfig.metaKeywords,
    metaDescription: metaDescription || seoConfig.metaDescription
  };
}

// ------------------------------------------------------------------------
// Get the request IP address and normalize
// see http://stackoverflow.com/questions/24896386/request-connection-remoteaddress-now-prefixed-in-ffff-in-node-js
// and http://stackoverflow.com/questions/31100703/stripping-ffff-prefix-from-request-connection-remoteaddress-nodejs
// ------------------------------------------------------------------------

var ipaddr = require('ipaddr.js');
function _getReqIP(req) {
  //var ipString = req.ip;  // the simple way
  var ipString = req.headers["x-forwarded-for"];
  if (ipString) {
    ipString = ipString.split(',')[0];
    return ipString;  // This request is forwarded by nginx, which is guaranteed to be IPv4
  } else {
    ipString = req.connection.remoteAddress;
  }
  if (!ipString || ipString === 'localhost' || ipString === '::1') {
    return '127.0.0.1';
  }
  if (ipaddr.isValid(ipString)) {
    try {
      var addr = ipaddr.parse(ipString);
      if (ipaddr.IPv6.isValid(ipString) && addr.isIPv4MappedAddress()) {
        return addr.toIPv4Address().toString();
      }
      return addr.toNormalizedString();
    } catch (e) {
      return ipString;
    }
  }
  return 'unknown';
}

// ------------------------------------------------------------------------
// Disable browser cache
// see http://madhatted.com/2013/6/16/you-do-not-understand-browser-history
// and https://mixmax.com/blog/chrome-back-button-cache-no-store
// ------------------------------------------------------------------------

function _disableBrowserCache(res) {
  res.setHeader('Cache-Control', 'must-revalidate, no-store, no-cache, private');
  res.setHeader('Pragma', 'no-store, no-cache');
}
