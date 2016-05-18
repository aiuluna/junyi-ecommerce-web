var util = require('util'),
    Q = require('q'),
    request = require('request'),
    config = require('../config'),
    logger = require('../logger');

module.exports = {
  request: _request,
  pipe: _pipe,
  resultMessageHandler: _resultMessageHandler,
  errorHandler: _errorHandler,
  errorHandlerJSON: _errorHandlerJSON,
  multiRequest: _multiRequest,
  spreadMap: _spreadMap
};

function _request(server, options) {
  var reqOpts = _toReqOpts(server, options),
      startTime = Date.now(),
      deferred = Q.defer();
  // set encoding (_pipe does not need encoding but _request needs)
  reqOpts.encoding = options.encoding || 'utf8';
  request(reqOpts, function(err, response, body) {
    if (err) {
      if (err.connect === true) {
        // connection timeouts
        logger.error('Connection timeouts: ' + reqOpts.url);
      } else if (err.code === 'ETIMEDOUT') {
        // read timeouts
        logger.error('Connection ETIMEDOUT (read timeout): ' + reqOpts.url);
      } else if (err.code === 'ECONNREFUSED') {
        logger.error('Connection failed (server may be not up): ' + reqOpts.url);
      }
      deferred.reject(err);
      return;
    }
    var ellapse = Date.now() - startTime;
    if (ellapse > 500) {
      logger.debug('[request_lag] Ellapse %d ms: %s', ellapse, reqOpts.url);
    }
    if (response.statusCode === 200) {
      var contentType = response.headers['content-type'] || '',
          isJSON = contentType.indexOf('application/json') > -1;
      if (isJSON) {
        deferred.resolve(JSON.parse(body));
      } else {
        deferred.resolve(body);
      }
    } else {
      var message = 'Request error (' + response.statusCode + '): ' + reqOpts.url;
      logger.error(message);
      deferred.reject(message);
    }
  });
  return deferred.promise;
}

function _pipe(server, options, res) {
  var reqOpts = _toReqOpts(server, options);
  request(reqOpts)
    .on('error', function(err) {
      logger.error('Failed to request ' + reqOpts.url + ', ' + (err.stack ? err.stack : err));
      res.json({
        success: false,
        error: { message: 'Internal server error!' }
      });
    })
    .pipe(res);
}

// 成功处理
function _resultMessageHandler(successHandler, req, res, next) {
  if (arguments.length === 2) {
    // 简短格式: _resultMessageHandler(successHandler, next)
    next = req;
  }
  return function(json) {
    if (json.success) {
      successHandler(json.data);
    } else {
      var err = new Error(json.error.message);
      err.status = 500;
      next(err);
    }
  };
}

// 错误处理
function _errorHandler(req, res, next) {
  if (arguments.length === 1) {
    // 简短格式: _errorHandler(next)
    next = req;
  }
  return function(err) {
    if (!(err instanceof Error)) {
      err = new Error(err.toString ? err.toString() : '' + err);
    }
    err.status = 500;
    next(err);
  };
}

// 错误处理
function _errorHandlerJSON(req, res, next) {
  if (arguments.length === 1) {
    // 简短格式: _errorHandlerJSON(res)
    res = req;
  }
  return function(err) {
    if (!(err instanceof Error)) {
      res.json({
        success: false,
        error: {
          message: err.toString ? err.toString() : '' + err
        }
      });
    } else {
      res.json({
        success: false,
        error: {
          message: err.message
        }
      });
    }
  };
}

function _toReqOpts(server, options) {
  if (arguments.length !== 2)
    throw new TypeError('Arguments required: server, options');
  if (typeof options === 'string') {
    options = { url: options };
  } else if (typeof options.url === 'undefined') {
    throw new TypeError('options.url must not be null');
  }
  var reqOpts = {
    method: options.method || 'GET',
    url: _nextServerUrlRR(server, options.url),
    timeout: options.timeout || 5000  // LxC(2016-02-01): 默认5秒   TODO: 涉及第三方调用的接口可能超时..
  }, data = options.data;
  if (data && typeof data === 'object') {
    var method = reqOpts.method.toUpperCase();
    if (method === 'GET') {
      reqOpts.qs = data;
    } else if (method === 'POST') {
      reqOpts.form = data;
    }
  }
  return reqOpts;
}

var nextIndexRR = {},
    servers = config.servers;
// initialize nextIndexRR
for (var server in servers) nextIndexRR[server] = 0;
// Use Round-Robin to generate the server url
function _nextServerUrlRR(server, uri) {
  var arr = servers[server];
  if (!arr || !arr.length) throw new TypeError('Unknown server: ' + server);
  if (arr.length === 1) {
    return arr[0] + uri;
  } else {
    var nextIndex = nextIndexRR[server];
    nextIndex = (nextIndex + 1) % arr.length;
    nextIndexRR[server] = nextIndex;
    return arr[nextIndex] + uri;
  }
}

var __slice = Array.prototype.slice;

function _multiRequest(reqs) {
  if (!arguments.length) return Q();
  reqs = arguments.length === 1 && util.isArray(reqs) ? reqs : __slice.call(arguments);
  return Q.allSettled(reqs);
}

function _spreadMap(options) {
  var mapOpts = [];
  options = arguments.length === 1 && util.isArray(options) ? options : __slice.call(arguments);
  for (var i = 0; i < options.length; ++i) {
    var opt = options[i];
    if (typeof opt === 'string') {
      mapOpts.push({
        name: opt,
        ignoreError: false/*,
        defaultOnError: {}*/
      });
    } else if (opt && typeof opt === 'object') {
      mapOpts.push(opt);
    } else {
      throw new TypeError('Invalid option at index: ' + i + ', ' + opt);
    }
  }
  return function() {
    if (arguments.length !== mapOpts.length)
      throw new TypeError('Map options mismatch, spread outputs length: ' + arguments.length);
    var resultObj = {};
    for (var i = 0; i < arguments.length; ++i) {
      var result = arguments[i],
          mapOpt = mapOpts[i];
      if (result.state === 'fulfilled') {
        // resolved
        var val = result.value;
        if (val && typeof val === 'object') {
          if (typeof val.success === 'boolean') {
            if (val.success) {
              resultObj[mapOpt.name] = val.data;
            } else {
              if (mapOpt.ignoreError) {
                logger.warn('Ignore multiRequest#%d for `%s`: %s', i, mapOpt.name, JSON.stringify(val));
                resultObj[mapOpt.name] = mapOpt.defaultOnError;
              } else {
                throw new Error('multiRequest#' + i + ' for `' + mapOpt.name + '` error: ' + JSON.stringify(val));
              }
            }
          } else {
            resultObj[mapOpt.name] = val;
          }
        } else {
          resultObj[mapOpt.name] = val;
        }
      } else {
        // rejected
        if (mapOpt.ignoreError) {
          logger.warn('Ignore multiRequest#%d for `%s`: %s', i, mapOpt.name, result.reason);
          resultObj[mapOpt.name] = mapOpt.defaultOnError;
        } else {
          throw new Error('multiRequest#' + i + ' for `' + mapOpt.name + '` error: ' + result.reason);
        }
      }
    }
    return resultObj;
  };
}