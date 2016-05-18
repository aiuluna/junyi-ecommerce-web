var winston = require('winston'),
    path = require('path'),
    fs = require('fs'),
    util = require('util'),
    moment = require('moment'),
    DailyRotateFile = require('winston-daily-rotate-file'),
    logDir = require('./config').logDir,
    env = process.env.NODE_ENV || 'development',
    pid = '[PID:' + process.pid + ']';

var PROJECT_ROOT = __dirname;

winston.setLevels(winston.config.npm.levels);
winston.addColors(winston.config.npm.colors);

if (!fs.existsSync(logDir)) {
  // Create the directory if it does not exist
  fs.mkdirSync(logDir);
}

var logger = new (winston.Logger)({
  transports: [
    new winston.transports.Console({
      level: 'debug',
      json: false,
      formatter: formatter
    }),
    new DailyRotateFile({
      level: 'debug' /*env === 'development' ? 'debug' : 'info'*/ ,
      filename: path.join(logDir, 'activity.log'),
      datePattern: '.yyyyMMdd',
      maxsize: 1024 * 1024 * 10, // 10MB
      json: false,
      formatter: formatter
    })
  ],
  // handle uncaughtException
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      humanReadableUnhandledException: true,
      json: false,
      formatter: formatter
    })
  ]
});

// hook warn() and error() to output source file and line number
// 参考：https://gist.github.com/fisch0920/39a7edc77c422cbf8a18
var __warn = logger.warn,
    __error = logger.error;

logger.warn = function() {
  __warn.apply(logger, formatLogArguments(arguments));
};

logger.error = function() {
  __error.apply(logger, formatLogArguments(arguments));
};

// exports
module.exports = logger;

// winston Transport formatter
function formatter(params) {
  var output = moment().format('YYYY-MM-DD HH:mm:ss.SSS') + ' ' + params.level.toUpperCase() + ' ' + pid + ' - ';
  if (undefined !== params.message) output += params.message;
  // 参考：winston/lib/winston/common.js#log()
  var meta = params.meta;
  if (meta !== null && meta !== undefined) {
    if (meta && meta instanceof Error && meta.stack) {
      meta = meta.stack;
    }

    if (typeof meta !== 'object') {
      output += '\n' + meta;
    } else if (Object.keys(meta).length > 0) {
      if (typeof params.prettyPrint === 'function') {
        output += '\n' + params.prettyPrint(meta);
      } else if (params.prettyPrint) {
        output += '\n' + util.inspect(meta, false, params.depth || null);
      } else if (params.humanReadableUnhandledException && Object.keys(meta).length === 5 &&
          meta.hasOwnProperty('date') && meta.hasOwnProperty('process') && meta.hasOwnProperty('os') &&
          meta.hasOwnProperty('trace') && meta.hasOwnProperty('stack')) {
        // If meta carries unhandled exception data serialize the stack nicely
        var stack = meta.stack;
        delete meta.stack;
        delete meta.trace;
        output += '\n' + serialize(meta);
        if (stack) {
          output += '\n' + stack.join('\n');
        }
      } else {
        output += '\n' + serialize(meta);
      }
    }
  }
  return output;
}
 
//
// ### function serialize (obj, key)
// #### @obj {Object|literal} Object to serialize
// #### @key {string} **Optional** Optional key represented by obj in a larger object
// Performs simple comma-separated, `key=value` serialization for Loggly when
// logging to non-JSON inputs.
//
// 参考：winston/lib/winston/common.js#serialize()
function serialize(obj, key) {
  if (obj === null) {
    obj = 'null';
  }
  else if (obj === undefined) {
    obj = 'undefined';
  }
  else if (obj === false) {
    obj = 'false';
  }

  if (typeof obj !== 'object') {
    return key ? key + '=' + obj : obj;
  }

  if (obj instanceof Buffer) {
    return key ? key + '=' + obj.toString('base64') : obj.toString('base64');
  }

  var msg = '',
      keys = Object.keys(obj),
      length = keys.length;

  for (var i = 0; i < length; i++) {
    if (Array.isArray(obj[keys[i]])) {
      msg += keys[i] + '=[';

      for (var j = 0, l = obj[keys[i]].length; j < l; j++) {
        msg += serialize(obj[keys[i]][j]);
        if (j < l - 1) {
          msg += ', ';
        }
      }

      msg += ']';
    }
    else if (obj[keys[i]] instanceof Date) {
      msg += keys[i] + '=' + obj[keys[i]];
    }
    else {
      msg += serialize(obj[keys[i]], keys[i]);
    }

    if (i < length - 1) {
      msg += ', ';
    }
  }

  return msg;
}

// Attempts to add file and line number info to the given log arguments.
function formatLogArguments(args) {
  args = Array.prototype.slice.call(args);

  var stackInfo = getStackInfo(1);

  if (stackInfo) {
    // get file path relative to project root
    var calleeStr = '(' + stackInfo.relativePath + ':' + stackInfo.line + ')';

    if (typeof(args[0]) === 'string') {
      args[0] = calleeStr + ' ' + args[0];
    } else {
      args.unshift(calleeStr);
    }
  }

  return args;
}

// Parses and returns info about the call stack at the given index.
function getStackInfo(stackIndex) {
  // get call stack, and analyze it
  // get all file, method, and line numbers
  var stacklist = (new Error()).stack.split('\n').slice(3);

  // stack trace format:
  // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
  var stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi;
  var stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi;

  var s = stacklist[stackIndex] || stacklist[0];
  var sp = stackReg.exec(s) || stackReg2.exec(s);

  if (sp && sp.length === 5) {
    return {
      method: sp[1],
      relativePath: path.relative(PROJECT_ROOT, sp[2]),
      line: sp[3],
      pos: sp[4],
      file: path.basename(sp[2]),
      stack: stacklist.join('\n')
    };
  }
}