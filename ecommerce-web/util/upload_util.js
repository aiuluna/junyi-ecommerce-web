var config = require('../config'),
    logger = require('../logger'),
    rs = require('qiniu/qiniu/rs'),
    io = require('qiniu/qiniu/io'),
    Mac = require('qiniu/qiniu/auth/digest').Mac;

module.exports = {
  uploadFile: uploadFile,
  uploadStream: uploadStream

};

var accessKey = config.upload.qiniu.accessKey;
var secretKey = config.upload.qiniu.secretKey;
var bucketName = config.upload.qiniu.bucketName;
var mac = new Mac(accessKey, secretKey);

var uptoken = getToken(bucketName, mac);

function getToken(bucketname, mac) {
  var putPolicy = new rs.PutPolicy(bucketname);
  //putPolicy.callbackUrl = callbackUrl;
  //putPolicy.callbackBody = callbackBody;
  //putPolicy.returnUrl = returnUrl;
  //putPolicy.returnBody = returnBody;
  //putPolicy.asyncOps = asyncOps;
  //putPolicy.expires = expires;

  return putPolicy.token(mac);
}

function uploadFile(localFile, key, callback) {
  var extra = new io.PutExtra();
  //extra.params = params;
  //extra.mimeType = mimeType;
  //extra.crc32 = crc32;
  //extra.checkCrc = checkCrc;

  /*
  var callback = function(err, ret) {
    if(!err) {
      // 上传成功， 处理返回值
      // logger.log(ret.key, ret.hash);
      // ret.key & ret.hash
    } else {
      // 上传失败， 处理返回代码
      console.log(err);
      // http://developer.qiniu.com/docs/v6/api/reference/codes.html
    }
  }
  */
  io.putFile(uptoken, key, localFile, extra, callback);
}


function uploadStream(content, key, callback) {
  var extra = new io.PutExtra();
  //extra.params = params;
  //extra.mimeType = mimeType;
  //extra.crc32 = crc32;
  //extra.checkCrc = checkCrc;

  /*
   var callback = function(err, ret) {
   if(!err) {
   // 上传成功， 处理返回值
   // logger.log(ret.key, ret.hash);
   // ret.key & ret.hash
   } else {
   // 上传失败， 处理返回代码
   console.log(err);
   // http://developer.qiniu.com/docs/v6/api/reference/codes.html
   }
   }
   */
  io.put(uptoken, key, content, extra, callback);
}

