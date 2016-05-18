var extend = require('extend'),
    Q = require('q'),
    config = require('./config'),
    logger = require('./logger'),
    common_util = require('./util/common_util'),
    http_util = require('./util/http_util');

var TRACK_COOKIE_CONFIG = config.cookie.track,
    TRACK_COOKIE_KEY = TRACK_COOKIE_CONFIG.key;

var user_track = module.exports = function(/*options*/) {
  // 给用户分配一个track cookie->跟踪用户行为
  return function(req, res, next) {
    if (!req.cookies[TRACK_COOKIE_KEY]) {
      http_util.request('facade', {
          method: 'GET',
          url: '/user/track/getTrackId' + (req.user ? '?userId=' + req.user.id : '')
        })
        .done(
          function(json) {
            if (json.success) {
              var trackId = json.data;
              if (req.user) logger.info('[user_track] Set trackId for user %d to `%s`', req.user.id, trackId);
              setTrackCookie(res, trackId);
            } else {
              logger.error('[facade] GET /user/track/getTrackId, ' + json.error.message);
            }
            next();
          },
          function(err) {
            logger.error('[facade] GET /user/track/getTrackId', err);
            next();
          }
        );
    } else {
      next();
    }
  };
};

extend(user_track, {
  getTrackId: getTrackId,
  setTrackCookie: setTrackCookie,
  linkTrackWithUser: linkTrackWithUser,
  recordSearchWord: recordSearchWord,
  recordViewProduct: recordViewProduct
});


function getTrackId(req, res) {
  if (req.cookies[TRACK_COOKIE_KEY]) {
    var value = req.cookies[TRACK_COOKIE_KEY],
        trackId = common_util.decryptCookie(value);
    if (!trackId) {
      // decrypt出错，删除错误的cookie，否则不停地报错……
      res.clearCookie(TRACK_COOKIE_KEY);
    }
    return trackId;
  }
  return null;
}

function setTrackCookie(res, trackId) {
  res.cookie(TRACK_COOKIE_KEY, common_util.encryptCookie(trackId), TRACK_COOKIE_CONFIG.options);
}

function linkTrackWithUser(req, res, userId) {
  var deferred = Q.defer(),
      trackId = getTrackId(req, res);
  if (trackId) {
    http_util.request('facade', {
        method: 'POST',
        url: '/user/track/link',
        data: {
          trackId: trackId,
          userId: userId
        }
      })
      .done(
        function(json) {
          if (json.success) {
            var newTrackId = json.data;
            if (newTrackId !== trackId) {
              logger.info('[user_track] Switch trackId for user %d from `%s` to `%s`', userId, trackId, newTrackId);
              setTrackCookie(res, newTrackId);
            }
            deferred.resolve();
          } else {
            logger.error('[facade] POST /user/track/link, ' + json.error.message);
            deferred.reject(json.error.message);
          }
        },
        function(err) {
          logger.error('[facade] POST /user/track/link', err);
          deferred.reject(err);
        }
      );
  } else {
    deferred.resolve();
  }
  return deferred.promise;
}

function record(trackId, trackValue, trackType) {
  var deferred = Q.defer();
  http_util.request('facade', {
      method: 'POST',
      url: '/user/track/record',
      data: {
        trackId: trackId,
        trackValue: trackValue,
        trackType: trackType
      }
    })
    .done(
      function(json) {
        if (json.success) {
          deferred.resolve();
        } else {
          logger.error('[facade] POST /user/track/record, ' + json.error.message);
          deferred.reject(json.error.message);
        }
      },
      function(err) {
        logger.error('[facade] POST /user/track/record', err);
        deferred.reject(err);
      }
    );
  return deferred.promise;
}

// ------------------------------------------------------------------------
// 记录最近搜索过的关键词
// ------------------------------------------------------------------------

function recordSearchWord(req, res, searchWord) {
  var trackId = getTrackId(req, res);
  if (!trackId) return;
  return record(trackId, searchWord, 'SEARCH_WORD');
}

// ------------------------------------------------------------------------
// 记录最近浏览过的商品
// ------------------------------------------------------------------------

function recordViewProduct(req, res, skuId) {
  var trackId = getTrackId(req, res);
  if (!trackId) return;
  return record(trackId, skuId, 'VIEW_PRODUCT');
}
