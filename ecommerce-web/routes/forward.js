var express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    extend = require('extend'),
    config = require('../config'),
    logger = require('../logger'),
    http_util = require('../util/http_util');

var ERGATE_SERVER = config.servers.ergate[0];

var router = express.Router();

router.post('/wxOrder/wxOrderPayNotify',
  bodyParser.text({
    type: function() { return true; }
  }),
  function(req, res, next) {
    if (typeof req.body === 'string') {
      request({
          method: 'POST',
          url: ERGATE_SERVER + '/wxOrder/wxOrderPayNotify',
          body: req.body,
          timeout: 60000
        })
        .on('error', function(err) {
          logger.error('Error: ' + (err.stack ? err.stack : err));
          res.end();
        })
        .pipe(res);
    } else {
      http_util.pipe('ergate', {
        method: 'POST',
        url: '/wxOrder/wxOrderPayNotify',
        data: collectReqParams(req),
        timeout: 60000
      }, res);
    }
  }
);

router.post('/aliPayOrder/payNotify', function(req, res, next) {
  http_util.pipe('ergate', {
    method: 'POST',
    url: '/aliPayOrder/payNotify',
    data: collectReqParams(req),
    timeout: 60000
  }, res);
});

router.post('/aliPayOrder/refundNotify', function(req, res, next) {
  http_util.pipe('ergate', {
    method: 'POST',
    url: '/aliPayOrder/refundNotify',
    data: collectReqParams(req),
    timeout: 60000
  }, res);
});

router.post('/express/notify', function(req, res, next) {
  http_util.pipe('ergate', {
    method: 'POST',
    url: '/express/express',
    data: collectReqParams(req),
    timeout: 60000
  }, res);
});

router.post('/erpPush/order',
  bodyParser.text({
    type: function() { return true; }
  }),
  function(req, res, next) {
    if (typeof req.body === 'string') {
      request({
          method: 'POST',
          url: ERGATE_SERVER + '/erpPush/order',
          body: req.body,
          timeout: 60000
        })
        .on('error', function(err) {
          logger.error('Error: ' + (err.stack ? err.stack : err));
          res.end();
        })
        .pipe(res);
    } else {
      http_util.pipe('ergate', {
        method: 'POST',
        url: '/erpPush/order',
        data: collectReqParams(req),
        timeout: 60000
      }, res);
    }
  }
);

router.post('/erpPush/stock',
  bodyParser.text({
    type: function() { return true; }
  }),
  function(req, res, next) {
    if (typeof req.body === 'string') {
      request({
          method: 'POST',
          url: ERGATE_SERVER + '/erpPush/stock',
          body: req.body,
          timeout: 60000
        })
        .on('error', function(err) {
          logger.error('Error: ' + (err.stack ? err.stack : err));
          res.end();
        })
        .pipe(res);
    } else {
      http_util.pipe('ergate', {
        method: 'POST',
        url: '/erpPush/stock',
        data: collectReqParams(req),
        timeout: 60000
      }, res);
    }
  }
);

function collectReqParams(req) {
  var params = {};
  if (req.query) extend(params, req.query);
  if (req.body) extend(params, req.body);
  return params;
}

module.exports = router;
