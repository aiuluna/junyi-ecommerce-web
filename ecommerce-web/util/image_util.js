var config = require('../config');

module.exports = {
  getImageUrl: getImageUrl,
  getImageUrlInterlace: getImageUrlInterlace,
  getImageUrlPNG: getImageUrlPNG,
  getImageUrlCrop: getImageUrlCrop,
  getImageUrlResize: getImageUrlResize,
  getImageUrlBoxed: getImageUrlBoxed,
  filterHtmlContent: filterHtmlContent,
  getUploadUrl: getUploadUrl,
  getMediaUrl: getMediaUrl,
  getStaticImgWeb: getStaticImgWeb,
  getStaticImgWap: getStaticImgWap
};

var IMAGE_JPG = '/format/jpg';
var IMAGE_PNG = '/format/png';
// LxC(2016-03-09): 默认的quanlity是75，很多图片的文字会糊掉，修改为90
var IMAGE_JPG_HIGH_QUALITY = '/format/jpg/q/90';
var IMAGE_INTERLACE = '/interlace/1';  // 支持interlace渐进加载

function getImageUrl(imageUri, width, height) {
  if (!imageUri) return '';
  var imageUrl = encodeURI(getNextImageServer() + imageUri);
  if (typeof width === 'number') {
    if (typeof height !== 'number') height = width;
    // 限定缩略图的宽最多为<Width>，高最多为<Height>，进行等比缩放，不裁剪
    imageUrl += '?imageView2/2/w/' + width + '/h/' + height + IMAGE_JPG_HIGH_QUALITY;
  }
  return imageUrl;
}

function getImageUrlInterlace(imageUri, width, height) {
  if (!imageUri) return '';
  var imageUrl = encodeURI(getNextImageServer() + imageUri);
  if (typeof width === 'number') {
    if (typeof height !== 'number') height = width;
    // 限定缩略图的宽最多为<Width>，高最多为<Height>，进行等比缩放，不裁剪
    imageUrl += '?imageView2/2/w/' + width + '/h/' + height + IMAGE_JPG_HIGH_QUALITY + IMAGE_INTERLACE;
  }
  return imageUrl;
}

function getImageUrlPNG(imageUri, width, height) {
  if (!imageUri) return '';
  var imageUrl = encodeURI(getNextImageServer() + imageUri);
  if (typeof width === 'number') {
    if (typeof height !== 'number') height = width;
    // 限定缩略图的宽最多为<Width>，高最多为<Height>，进行等比缩放，不裁剪
    imageUrl += '?imageView2/2/w/' + width + '/h/' + height + IMAGE_PNG;
  }
  return imageUrl;
}

function getImageUrlCrop(imageUri, width, height) {
  if (!imageUri) return '';
  var imageUrl = encodeURI(getNextImageServer() + imageUri);
  if (typeof width === 'number') {
    if (typeof height !== 'number') height = width;
    // 限定缩略图的宽最少为<Width>，高最少为<Height>，进行等比缩放，居中裁剪
    imageUrl += '?imageView2/1/w/' + width + '/h/' + height + IMAGE_JPG_HIGH_QUALITY + IMAGE_INTERLACE;
  }
  return imageUrl;
}

function getImageUrlResize(imageUri, width, height) {
  if (!imageUri) return '';
  var imageUrl = encodeURI(getNextImageServer() + imageUri);
  if (typeof width === 'number') {
    if (typeof height !== 'number') height = width;
    // 限定缩略图的宽为<Width>，高为<Height>，进行缩小或者放大，不维持原来的比例
    imageUrl += '?imageMogr2/thumbnail/' + width + 'x' + height + '!';
  }
  return imageUrl;
}

var originalSizeRE = /_(\d+)x(\d+)\./;
function getImageUrlBoxed(imageUri, width, height) {
  if (!imageUri) return '';
  var imageUrl = encodeURI(getNextImageServer() + imageUri);
  if (typeof width === 'number') {
    if (typeof height !== 'number') height = width;
    // 查看原先的图片名是否包含了长宽信息
    var result = originalSizeRE.exec(imageUri), cropped = false;
    if (result && result.length === 3) {
      var originalWidth = result[1]-0, originalHeight = result[2]-0;
      if (originalWidth / originalHeight > width / height) {
        // 限定缩略图的宽最少为<Width>，高最少为<Height>，进行等比缩放，居中裁剪
        imageUrl += '?imageView2/1/w/' + width + '/h/' + height + IMAGE_JPG_HIGH_QUALITY;
        cropped = true;
      }
    }
    if (!cropped) {
      // 限定缩略图的宽最多为<Width>，高最多为<Height>，进行等比缩放，不裁剪
      imageUrl += '?imageView2/2/w/' + width + '/h/' + height + IMAGE_JPG_HIGH_QUALITY;
    }
  }
  return imageUrl;
}

function filterHtmlContent(content, desiredWidth, imageLazyload) {
  if (!content) return '';
  if (arguments.length === 2) {
    if (typeof desiredWidth === 'boolean') {
      imageLazyload = desiredWidth;
      desiredWidth = undefined;
    }
  }
  var mediaServer = getNextImageServer();
  content = content.replace(/{{MEDIA_SERVER}}/g, mediaServer);
  var imageParam = '';
  if (desiredWidth && typeof desiredWidth === 'number') {
    imageParam = '?imageView2/2/w/' + desiredWidth + IMAGE_JPG /*+ IMAGE_INTERLACE*/; // 图片基本上都是lazy加载的，interlace就失去意义了
  }
  content = content.replace(/{{IMAGE_PARAM}}/g, imageParam);
  if (imageLazyload) content = content.replace(/src="/g, 'class="lazy" src="images/blank.gif" data-original="');
  return content;
}


var nextIndexRR = 0,
    cdnServers = config.servers.cdn;
if (!cdnServers || !cdnServers.length) throw new TypeError('CDN servers not defined');
// Use Round-Robin to get the image url
var getNextImageServer;
if (cdnServers.length === 1) {
  var server = cdnServers[0];
  getNextImageServer = module.exports.getNextImageServer = function() {
    return server;
  };
} else {
  getNextImageServer = module.exports.getNextImageServer = function() {
    nextIndexRR = (nextIndexRR + 1) % cdnServers.length;
    return cdnServers[nextIndexRR];
  };
}


var roundSeed = {
  media: 0,
  facade: 0
};
function getNext(arr, key) {
  if (arr && arr.length) {
    if (arr.length == 1) {
      return arr[0];
    }
    roundSeed[key] = (roundSeed[key] + 1) % arr.length;
    return arr[roundSeed[key]];
  } else {
    return '';
  }
}

function getUploadUrl(url){
  var server = 'facade';
  return encodeURI(getNext(config.servers[server], server)) + (url ? url : '');
}

function getMediaUrl(url){
  var server = 'media';
  return encodeURI(getNext(config.servers[server], server)) + (url ? url : '');
}

// ------------------------------------------------------------------------
// 部分图片放到CDN上加速
// ------------------------------------------------------------------------

var STATIC_IMG_URL_PREFIX = config.servers['static'];
function getStaticImgWeb(imgName) {
  if (STATIC_IMG_URL_PREFIX) {
    return STATIC_IMG_URL_PREFIX + '/web/' + imgName;
  }
  return "images/" + imgName;
}

function getStaticImgWap(imgName) {
  if (STATIC_IMG_URL_PREFIX) {
    return STATIC_IMG_URL_PREFIX + '/wap/' + imgName;
  }
  return "images/" + imgName;
}
