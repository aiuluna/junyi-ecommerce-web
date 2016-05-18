var util = require('util'),
    url = require('url'),
    moment = require('moment'),
    config = require('../config'),
    image_util = require('./image_util');

// add helper functions to template
module.exports = function(template) {
  // common
  template.helper('encodeURI', encodeURI);
  template.helper('encodeURIComponent', encodeURIComponent);
  // self-expanded
  template.helper('timestamp', getTimestamp);
  template.helper('formatDate', formatDate);
  template.helper('formatMoney', formatMoney);
  template.helper('formatMoney2', formatMoney2);
  template.helper('escapeJsStr', escapeJsStr);
  template.helper('imageUrl', image_util.getImageUrl);
  template.helper('imageUrlInterlace', image_util.getImageUrlInterlace);
  template.helper('imageUrlPNG', image_util.getImageUrlPNG);
  template.helper('imageUrlCrop', image_util.getImageUrlCrop);
  template.helper('imageUrlResize', image_util.getImageUrlResize);
  template.helper('imageUrlBoxed', image_util.getImageUrlBoxed);
  template.helper('staticImgWeb', image_util.getStaticImgWeb);
  template.helper('staticImgWap', image_util.getStaticImgWap);
  template.helper('uploadUrl', image_util.getUploadUrl);
  template.helper('mediaUrl', image_util.getMediaUrl);
  template.helper('activityLinkHref', renderActivityLinkHref);
  template.helper('outputConditionBegin', outputConditionBegin);
  template.helper('outputConditionEnd', outputConditionEnd);
  template.helper('resCdnUrl', getResCdnUrl);
};

function getTimestamp() {
  return Date.now();
}

/**
 * @see http://momentjs.com/docs/#/displaying/format/
 * @param date date
 * @param format format
 * @returns {*}
 */
function formatDate(date, format) {
  format = format || 'YYYY-MM-DD';
  return date ? moment(date).format(format) : '';
}

function outputConditionBegin(expression) {
  return '<!--[' + expression + ']>';
}

function outputConditionEnd() {
  return '<![endif]-->';
}

/**
 * 格式化指定的<code>num</code>，最多保留2位小数，并去除多余的0
 */
function formatMoney(num, defVal) {
  if (typeof num !== 'number') {
    num = Number(num);
    if (isNaN(num)) return defVal || '0';
  }
  var s = num.toFixed(2);
  if (s.indexOf('.') > -1) {
    var idx = s.length - 1;
    if (s[idx] === '0') {
      while (s[idx] === '0') idx -= 1;
      if (s[idx] === '.') idx -= 1;
      s = s.substring(0, idx + 1);
    }
  }
  return s;
}

/**
 * 格式化指定的<code>num</code>，保留2位小数
 */
function formatMoney2(num, defVal) {
  if (typeof num !== 'number') {
    num = Number(num);
    if (isNaN(num)) return defVal || '0.00';
  }
  return num.toFixed(2);
}

function escapeJsStr(s) {
  if (!s) return '';
  return s.replace(/[\\"']/g, '\\$&').replace(/\n/g, '\\n');
}

var emptyHref = 'href="javascript:void(0)" onclick="return false"';
function renderActivityLinkHref(options, targetSelf) {
  var href = '';
  if (!options) return emptyHref;
  if (util.isObject(options)) {
    if (options.isLink === 'Y' && typeof options.linkUrl === 'string') {
      href = options.linkUrl.trim();
    } else if (options.isLink === 'N' && typeof options.activityId === 'number') {
      var typeAlias = 'p';
      switch (options.activityType) {
        case 'PRODUCT_PROMOTION':
          typeAlias = 'p';
          break;
        case 'ORDER_PROMOTION':
          typeAlias = 'o';
          break;
        case 'FLASH_SALE':
          typeAlias = 'flash';
          break;
      }
      href = 'topic-act-'+typeAlias+'-' + options.activityId + '.html';
    }
  } else if (typeof options === 'string') {
    href = options;
  }
  if (!href) return emptyHref;
  return 'href="' + encodeURI(href) + (targetSelf ? '"' : '" target="_blank"');
}

var RES_URL_PREFIX = config.servers['res'];
if (RES_URL_PREFIX) {
  // 判断是否以'/'结尾
  if (RES_URL_PREFIX[RES_URL_PREFIX.length - 1] !== '/') {
    RES_URL_PREFIX += '/';
  }
}
function getResCdnUrl(key) {
  if (RES_URL_PREFIX) {
    return RES_URL_PREFIX + key;
  }
  return key;
}