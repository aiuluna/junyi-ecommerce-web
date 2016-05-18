/**
 * scroll loader
 * @type {{create}}
 */
var ShopScrollLoader = function() {
  "use strict";
  function createLoader() {
    var _opt = {
      /**
       * 请求是否可以被丢弃, 默认值为 false
       */
      abortable: false,
      /**
       * 请求返回数据, success 为 true 时触发
       */
      onSuccess: function(){},
      /**
       * 请求返回数据, success 为 false 时触发
       */
      onError: function(){},
      /**
       * 请求发起前触发
       */
      onBefore: function(){},
      /**
       * 请求完成后(不管成功还是失败)触发
       */
      onAfter: function(){}
    };
    /**
     * 请求ID生成序列, 每次 +1
     * @type {number}
     * @private
     */
    var _requestSeed = 0;

    /**
     * ajax 请求对象队列 request => XHR
     * @type {{}}
     * @private
     */
    var _xhrQueue = {}; // requestId ==> XHR
    /**
     * 已丢弃请求队列
     * @type {{}}
     * @private
     */
    var _abortQueue = {}; // requestId ==> 1
    /**
     * 是否开发模式
     * @type {boolean}
     */
    var devMode = true;

    /**
     * 日志调试
     */
    function debug() {
      if (devMode && typeof console === 'object' && $.isFunction(console.log)) {
        if (!arguments) {
          console.log('no args found');
          return;
        }
        console.log.apply(console, [].slice.call(arguments));
      }
    }

    /**
     * 获取新的请求ID
     * @returns {number}
     */
    function getRequestId() {
      return _requestSeed++;
    }

    function shrink(obj) {
      var shrinked = {};

      var count = 0;
      $.each(obj, function(k, v) {
        if (v) {
          shrinked[k] = v;
        }
        count++;
      });
      return shrinked;
    }

    function clearXhr(requestId) {

      _xhrQueue[requestId] = null;
      _abortQueue[requestId] = null;

      // how to avoid memory leak over _xhrQueue & _abortQueue
      if (requestId % 16 === 0) {
        _xhrQueue = shrink(_xhrQueue);
        _abortQueue = shrink(_abortQueue);
      }
    }
    function handleAbort(newXhr, requestId) {
      if (_opt.abortable) {
        // mark aborted
        $.each(_xhrQueue, function(k, xhr){
          if (!_abortQueue[k] && xhr) {
            _abortQueue[k] = 1;
            xhr.abort();
          }
        });

        // debug('==> request before ', requestId, ' aborted');

        // add to queue
        _xhrQueue[requestId] = newXhr;
      }
    }

    function doLoadData(_opt, data) {
      var method = _opt.method && _opt.method.toUpperCase() === 'GET' ? 'get' : 'post';
      var requestId = getRequestId();

      try {
        if ($.isFunction(_opt.onBefore)) {
          _opt.onBefore();
        }
      } catch(e) {}
      var xhr = Shop[method]({
        url: _opt.url,
        dataType: _opt.dataType || 'JSON',
        data: $.extend({}, data || {}),
        success: function (json) {
          if ($.isFunction(_opt.onSuccess)) {
            _opt.onSuccess(json);
          }
        },
        error: function(json){
          if ($.isFunction(_opt.onError)) {
            _opt.onError(json);
          }
        },
        complete: function(data, status, jqXhr) {
          if (status === 'abort') {
            debug('<== request ', requestId, ' aborted');
          }

          clearXhr(requestId);

          try {
            if ($.isFunction(_opt.onAfter)) {
              _opt.onAfter();
            }
          } catch(e) {}
        }
      });
      handleAbort(xhr, requestId);
    }

    function init(opt) {
      $.extend(_opt, opt || {});
      _opt.abortable = _opt.abortable === true;
    }
    return {
      init: init,
      load: function(data) {
        doLoadData(_opt, data);
      }
    };
  }

  return {
    create: function(option) {
      var ldr = createLoader();
      ldr.init(option);
      return ldr;
    }
  };
}();

var ShopScroll = function($){
  "use strict";
  var $doc = $(document);
  var $win = $(window),
    hasTouch = 'ontouchstart' in window,
    CLICK_EVT = hasTouch ? 'touchend' : 'click',
    TOUCH_MOVE = hasTouch ? 'touchmove' : 'scroll';

  var emptyFunc = function(){};

  var defOptions = {
    method:'POST',
    // url: '',
    renderItem: emptyFunc,
    beforeLoad: emptyFunc,
    afterLoad: emptyFunc,
    beforeAppendData: emptyFunc,
    afterAppendData: emptyFunc,
    onDataEnd: emptyFunc,
    fail: emptyFunc,
    getParams: emptyFunc,
    loadAtFirst: true,
    /**
     * 请求是否可以阻断, 前一个请求尚未完成, 后续要求将会被忽略;
     * 该参数默认值为 true
     */
    blockable: true,
    /**
     * 请求是否可以被丢弃, 后一个请求发起, 将会丢弃之前的所有请求;
     * 该参数只有在 { blockable : false } 才会生效;
     * 该参数默认值为 false
     */
    abortable: false,
    pageParam: 'pageNumber'
  };

  var loader = null;
  var loading = false;

  var _options = {};
  function loadData(params) {
    var $wrapper = _options.dataWrapper, extra = (params || {});
    extra[_options.pageParam] = getCurrentPage($wrapper) + 1;

    // check data ended or not
    if ($wrapper.data(key4DataLoaded)) {
      return;
    }


    if (isBlockable()) {
      if (!loading) {
        loader.load($.extend({}, _options.getParams(), extra));
      }
    } else {
      loader.load($.extend({}, _options.getParams(), extra));
    }
  }

  function isBlockable() {
    return _options.blockable;
  }

  var key4CurrentPage = 'current_page';
  var key4DataLoaded = 'data_loaded';
  function getCurrentPage($wrapper) {
    return ($wrapper.data(key4CurrentPage) || 0);
  }
  function incCurrentPage($wrapper) {
    $wrapper.data(key4CurrentPage, getCurrentPage($wrapper) + 1);
  }

  function appendData(json, itemFn) {
    var $wrapper = _options.dataWrapper;

    executeCallback(_options.beforeAppendData);
    var data = json.data;
    if (!$wrapper.data(key4DataLoaded)) {
      var arr = [];
      for (var i = 0, len = data.pageData.length; i < len; i++) {
        arr.push(itemFn(data.pageData[i]));
      }
      $wrapper.append(arr.join(''));
    }
    executeCallback(_options.afterAppendData);

    var current = getCurrentPage($wrapper);
    if ( current + 1 >= data.totalPages) {

      if (!$wrapper.data(key4DataLoaded)) {
        $wrapper.data(key4DataLoaded, true);
        executeCallback(_options.onDataEnd);
      }
    } else {
      incCurrentPage($wrapper);
    }

    if (data.pageNumber <= 1 && data.pageData.length === 0) {
      executeCallback(_options.onDataEmpty);
    }
  }
  function executeCallback(cb, json) {
    if (typeof cb == 'function') {
      cb(json);
    }
  }
  function onBeforeLoad() {
    if (isBlockable()) {
      loading = true;
    }

    var $wrapper = _options.dataWrapper;
    if ($wrapper.is('ul')) {
      $wrapper.append('<li id="js_scroll_loading" style="text-align: center;">加载中...</li>');
    }

    executeCallback(_options.beforeLoad);
  }

  function onAfterLoad() {
    if (isBlockable()) {
      loading = false;
    }

    var $wrapper = _options.dataWrapper;
    if ($wrapper.is('ul')) {
      $('#js_scroll_loading').remove();
    }
    executeCallback(_options.afterLoad);
  }

  function initLoader() {

    loader = ShopScrollLoader.create({
      abortable: _options.abortable,
      cache: false,
      method: _options.method,
      url: _options.url,
      dataType: 'json',
      onSuccess: function(json) {
        appendData(json, _options.renderItem);
      },
      onError: function(json) {
        executeCallback(_options.fail, json);
      },
      onBefore: function(){
        onBeforeLoad();
      },
      onAfter: function() {
        onAfterLoad();
      }
    });
  }

  function init(options) {

    _options = $.extend(defOptions, options);

    initLoader(_options);

    $win.on(TOUCH_MOVE,function(){
      var dh = $doc.height();
      var wh = $win.height();
      var st = $doc.scrollTop();
      if ((dh-wh) - st <= 30) {
        loadData();
      }
    });

    if (_options.loadAtFirst) {
      loadData();
    }
  }

  function reload() {
    var $wrapper = _options.dataWrapper;
    $wrapper.data(key4DataLoaded, false);
    $wrapper.data(key4CurrentPage, 0);
    $wrapper.html('');
    loadData();
  }

  return {
    init: init,
    load: loadData,
    reload: reload
  };
}(jQuery);