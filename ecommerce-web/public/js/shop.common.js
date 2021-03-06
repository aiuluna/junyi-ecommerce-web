var Shop = function(){

  function doAjax(opt) {
    return $.ajax({
      method: opt.method,
      url: opt.url,
      dataType: opt.dataType || 'json',
      data: opt.data
    }).done(function(json, textStatus) {
      if(textStatus === 'abort') {
        return;
      }

      if (!opt.dataType || opt.dataType.toUpperCase() == 'JSON') {
        if (json.success) {
          if (typeof opt.success == 'function') {
            opt.success(json);
          }
        } else {
          if (typeof opt.error == 'function') {
            opt.error(json);
          }
        }
      } else {
        // for non-json request
        if (typeof opt.success == 'function') {
          opt.success(json);
        }
      }
    }).fail(function(xhr, textStatus) {
      if(textStatus === 'abort') {
        return;
      }
      if (typeof opt.fail == 'function') {
        try {
          opt.fail(xhr);
        } catch(e) {}
      }
      if(xhr.status == 401) {
        // session timeout, redirect to login page
        ShopAlert.alert('会话过期', '您的会话已经过期啦, 请重新登录', function() {
          location.href = 'passport-login.html';
        });

      } else if (xhr.status == 403) {
        ShopAlert.alert('权限不足', '您没有权限访问该资源', function() {
          // 返回首页
          location.href = '/';
        });
      } else if (xhr.status == 404) {
        ShopAlert.confirm('地址错误', '您请求的资源不存在, 是否访问首页?', function(yes) {
          if (yes == 'yes') {
            location.href = '/';
          }
        });
      } else if (xhr.status == 500) {
        ShopAlert.alert('错误', '服务器出错啦, 请稍后重试');
      }
    }).always(function(data, textStatus, jqXhr){
      /*
      args: {
        done: [data, status, xhr],
        fail: [xhr, status, err]
      }
       */
      if (opt.complete && typeof opt.complete == 'function') {
        opt.complete(data, textStatus, jqXhr);
      }
    });
  }

  function ajaxGet(opt){
    return doAjax($.extend(opt, {method: 'GET'}));
  }

  function ajaxPost(opt){
    return doAjax($.extend(opt, {method: 'POST'}));
  }

  /**
   * generate pagination html
   * @param opt object {selector: '.rtl', pageNumber: 1, pageSize : 20, totalCount: 21, callback: function(){} }
   */
  function pagination(opt) {
    opt = $.extend({ pageNumber: 1, pageSize: 20, callback: function(){} }, opt);
    var $ele = $(opt.selector);
    var $pagination = $ele.pagination(opt.totalCount, {
      current_page: opt.pageNumber< 1 ? 0 : opt.pageNumber - 1, // start with 0
      items_per_page : opt.pageSize <= 0 ? 20 : opt.pageSize,
      callback: opt.callback,
      num_edge_entries: 2,
      num_display_entries: 7,
      prev_text : '<',
      next_text : '>',
      current_class: 'on',
      link_to: 'javascript:;'
    });
    return $pagination;
  }

  function CountDownTask() {
    var _opt = {
      onTimeout: function(orderNo) {/* do nothing */},
      onTick: function() {/* do nothing */},
      taskInterval: 1000 /* 1 second */,
      serverTime: new Date(),
      futureTime: new Date().getTime() + 1000 /* expireTime in milli*/
    };

    // const milliseconds
    var ONE_SECOND_IN_MILLI = 1000,
        ONE_MINUTE_IN_MILLI = 60 * 1000,
        ONE_HOUR_IN_MILLI = 3600 * 1000,
        ONE_DAY_IN_MILLI = 3600 * 24 * 1000;

    var count = 0;
    var self = this;
    self.start = function() {
      count = 0;
      var func = function(){
        self.countDown(_opt.serverTime, _opt.futureTime);
      };
      func();
      self.taskKey = setInterval(func, _opt.taskInterval);
    };

    self.stop = function() {
      clearInterval(self.taskKey);
    };

    self.create = function(opt) {
      // TODO validate futureTime required
      _opt = $.extend(_opt, opt || {});

      return self;
    };

    self.countDown = function(serverTime, expireTime) {
      var passTime = _opt.taskInterval * count++;
      var remaining = expireTime - serverTime - passTime,
        days,
        hours,
        minutes,
        seconds,
        result= { day:0, hour:0, minute:0, second:0 };

      // timeout triggered
      if (remaining <= 0) {
        _opt.onTick(_opt.data, result);
        /* stop task */
        self.stop();
        /* trigger timeout event */
        _opt.onTimeout(_opt.data);
        return;
      }

      // calc days
      days =  Math.floor(remaining / ONE_DAY_IN_MILLI);

      // calc hour
      remaining = remaining - days * ONE_DAY_IN_MILLI;
      hours =  Math.floor(remaining / ONE_HOUR_IN_MILLI);

      // calc minute
      remaining = remaining - hours * ONE_HOUR_IN_MILLI;
      minutes = Math.floor(remaining / ONE_MINUTE_IN_MILLI);

      // calc second
      remaining = remaining - minutes * ONE_MINUTE_IN_MILLI;
      seconds = Math.floor(remaining / ONE_SECOND_IN_MILLI);

      result = { day:days, hour:hours, minute:minutes, second:seconds };

      _opt.onTick(_opt.data, result);
    };
  }

  // List of HTML entities for escaping.
  var htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  // Regex containing the keys listed immediately above.
  var htmlEscaper = /[&<>"'\/]/g;

  // Escape a string for HTML interpolation.
  function escapeHtml(string) {
    if (string) {
      return ('' + string).replace(htmlEscaper, function(match) {
        return htmlEscapes[match];
      });
    } else {
      return string;
    }
  }
  return {
    get: ajaxGet,
    post: ajaxPost,
    pagination: pagination,
    escapeHtml: escapeHtml,
    newCountDownCtrl : function() {
      return new CountDownTask();
    }
  };
}();

var ShopLoader = function() {

  function loader() {
    var _opt = {
      // url: '',
      // method: '',
      // getCriteria: function() {},
      // dataType: 'json',
      pageSelector: '.rtl',
      pagination: true, // display pagination or not; default true
      // render:function() {},
      abortable : true,
      onBeforeLoad: function(){
        /* mask right part default */
        ShopUtil.block($('.mbright', $('#content')));
      },
      onAfterLoad: function() {
        /* mask right part default */
        ShopUtil.unblock($('.mbright', $('#content')));
      }
    };
    var _requestSeed = 0;
    var _xhrQueue = {}; // requestId ==> XHR
    var _abortQueue = {}; // requestId ==> 1
    var _pagination = null;

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

        // add to queue
        _xhrQueue[requestId] = newXhr;
      }
    }

    var _$pagination;
    function init(opt) {
      $.extend(_opt, opt);
      _opt.abortable = _opt.abortable === true;
      if (_opt.abortable === true) {
        _$pagination = $(_opt.pageSelector);
      }
    }

    var _criteria = {};
    function getCriteria() {
      return $.extend({}, _criteria);
    }

    function refreshCriteria(params, notStored) {
      var criteria = $.extend(_opt.getCriteria() || {}, params || {});
      if (notStored !== false) {
        _criteria = criteria;
      }

      return criteria;
    }

    function doLoadData(_opt, data, pg) {
      var method = _opt.method && _opt.method.toUpperCase() === 'GET' ? 'get' : 'post';
      var requestId = getRequestId();
      // Shop.get | Shop.post

      try {
        if ($.isFunction(_opt.onBeforeLoad)) {
          _opt.onBeforeLoad();
        }
      } catch(e) {}
      var xhr = Shop[method]({
        url: _opt.url,
        dataType: _opt.dataType || 'JSON',
        data: $.extend({}, data || {}, pg || {}),
        success: function (json) {
          doRender(json);
        },
        complete: function() {
          clearXhr(requestId);

          try {
            if ($.isFunction(_opt.onAfterLoad)) {
              _opt.onAfterLoad();
            }
          } catch(e) {}
        }
      });
      handleAbort(xhr, requestId);
    }

    function doRender(page) {

      _opt.render(page);
      if (_opt.pagination === true) {
        var pgOpt = {
          selector: _opt.pageSelector,
          pageNumber: page.data.pageNumber,
          totalCount: page.data.totalCount,
          pageSize: page.data.pageSize,
          callback: function (pageNum) {
            doPage(pageNum + 1);
          }
        };
        Shop.pagination(pgOpt);

        _pagination = $(_opt.pageSelector).data('pagination');
      }
    }

    function doSearch(params, notStored) {

      var data = refreshCriteria(params, notStored);
      var pg = {pageNumber: 1};
      doLoadData(_opt, data, pg);
    }

    function doPage(pageNum, pageSize) {
      var pageParam = {};
      pageParam.pageNumber = pageNum;
      if (pageSize && pageSize > 0) {
        pageParam.pageSize = pageSize;
      }

      var data = getCriteria();
      doLoadData(_opt, data, pageParam);
    }

    function doRefresh() {
      var pageNum = getPageNum();
      doPage(pageNum);
    }

    function getPageNum() {
      if (_pagination) {
        return _pagination.getCurrentPage();
      }

      return 0;
    }

    return {
      init: init,
      search: doSearch,
      page: doPage,
      refresh: doRefresh
    };
  }

  return {
    init:function(opt) {
      var ldr = loader();
      ldr.init(opt);
      return ldr;
    }
  };

}();

var ShopUtil = function() {

  var exp = {};

  function formatDate(date, format){
    // if date is null/undefined/0/''
    if (!date) {
      return '';
    }
    date = new Date(date);

    var map = {
      "M": date.getMonth() + 1, //月份
      "d": date.getDate(), //日
      "h": date.getHours(), //小时
      "m": date.getMinutes(), //分
      "s": date.getSeconds(), //秒
      "q": Math.floor((date.getMonth() + 3) / 3), //季度
      "S": date.getMilliseconds() //毫秒
    };
    format = format.replace(/([yMdhmsqS])+/g, function (all, t) {
      var v = map[t];
      if (v !== undefined) {
        if (all.length > 1) {
          v = '0' + v;
          v = v.substr(v.length - 2);
        }
        return v;
      }
      else if (t === 'y') {
        return (date.getFullYear() + '').substr(4 - all.length);
      }
      return all;
    });
    return format;
  }
  exp.formatDate = formatDate;

  function toStr(val) {
    if(val || val == '') {
      return val;
    }
    if (0 == val) {
      return '0';
    }
    if (false == val) {
      return 'false';
    }

    return '';
  }
  function fillArr(arr, str) {
    var args = arguments;
    if (args.length == 2) {

      arr.push(toStr(str));
      return;
    }
    if(args.length <= 1) {
      return;
    }
    for (var i = 1, len = args.length; i < len; i++) {
      arr.push(toStr(args[i]));
    }
  }
  exp.fillArr = fillArr;

  function getOrderStatus(code) {
    switch(code) {
      case 'PENDING_PAY':
        return "待付款";
      case 'PENDING_SHIP':
        return "待发货";
      case 'PENDING_RECV':
        return "待收货";
      case 'FINISHED':
        return "已完成";
      case 'CANCELLED':
        return "已关闭";
    }

    return '';
  }
  exp.getOrderStatus = getOrderStatus;

  function getSettleStatus(code) {
    switch(code) {
      case 'PENDING':
        return "待结算";
      case 'SETTLED':
        return "已结算";
      case 'EXCLUDED':
        return "未结算";
    }

    return '';
  }
  exp.getSettleStatus = getSettleStatus;

  function renderGender(sexType) {
    switch(sexType) {
      case 'MALE':
        return "男";
      case 'FEMALE':
        return "女";
      case 'NOT_SET':
        return "保密";

    }

    return '';
  }

  exp.renderGender = renderGender;
  function renderPromoterRequestStatus(status) {
    switch(status) {
      case 'AUDIT_WAITING':
        return "待审核";
      case 'AUDIT_PASSED':
        return "审核通过";
      case 'AUDIT_REJECTED':
        return "失败";

    }

    return '';
  }

  exp.renderPromoterRequestStatus = renderPromoterRequestStatus;

  function renderAccountType(type) {
    switch(type) {
      case 'BANK':
        return "银行账户";
      case 'ALI_PAY':
        return "支付宝";
    }

    return '';
  }

  exp.renderAccountType = renderAccountType;

  function renderDrawRequestStatus(status) {
    switch (status) {
      case 'COMMISSION_REQUESTED':
        return "待审核";
      case 'COMMISSION_APPROVED':
        return "审核通过";
      case 'COMMISSION_PAYED':
        return "已发放";
      case 'COMMISSION_FAILED':
        return "发放失败";
    }
    return '';
  }
  exp.renderDrawRequestStatus = renderDrawRequestStatus;

  function getFinishTimeRange(code) {
    switch(code) {
      case '0':
        return 7;
      case '1':
        return 30;
      case '2':
        return 90;
      case '3':
        return 180;
      case '4':
        return -1;
    }

    return 30;
  }
  exp.getFinishTimeRange = getFinishTimeRange;

  function formatMoney(num, defVal) {
    if (typeof num !== 'number' || isNaN(num)) return defVal || '0';
    var s = num.toFixed(2).toString();
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

  exp.formatMoney = formatMoney;

  function ellipsis(str, len) {
    if (str && str.length && str.length > len) {
      return str.substr(str, len) + '...';
    }

    return str;
  }

  /**
   * utility function to mask characters of string
   * @param str string to be mask
   * @param maskLen length of characters mask
   * @param suffixLen length of last characters retained
   * @returns string eg _mask('123456789', 4, 4) => 1****6789
   * @private
   */
  function _mask(str, maskLen, suffixLen) {
    maskLen = maskLen || 4;
    suffixLen = suffixLen || 4;
    var totalLen = maskLen + suffixLen;
    var masked = '****';
    if (maskLen > 4) {
      while(masked.length < maskLen) {
        masked += '*';
      }
    }
    if(str) {
      var length = str.length;
      // 位数不足, 全部输出
      if (length > maskLen) {
        if (length > totalLen) {
          return str.substr(0, length - totalLen) + masked + str.slice(0 - suffixLen)
        } else {
          return masked + str.slice(0 - suffixLen);
        }
      } else {
        return str;
      }
    } else {
      return '';
    }
  }

  function maskMobile(mobile) {
    if(mobile) {
      var str = '' + mobile;
      return _mask(str, 4, 4);
    } else {
      return '';
    }
  }
  exp.maskMobile = maskMobile;

  function maskIdCard(idcard) {
    if(idcard) {
      var str = '' + idcard;
      var length = str.length;
      return _mask(str, (length == 15 ? 6 : 8), 4);
    } else {
      return '';
    }
  }
  exp.maskIdCard = maskIdCard;

  exp.ellipsis = ellipsis;

  function initTemplateHelper() {
    /**
     * 对日期进行格式化，
     * @param date 要格式化的日期
     * @param format 进行格式化的模式字符串
     *     支持的模式字母有：
     *     y:年,
     *     M:年中的月份(1-12),
     *     d:月份中的天(1-31),
     *     h:小时(0-23),
     *     m:分(0-59),
     *     s:秒(0-59),
     *     S:毫秒(0-999),
     *     q:季度(1-4)
     * @return String
     * @author yanis.wang
     * @see	http://yaniswang.com/frontend/2013/02/16/dateformat-performance/
     */
    if (typeof template === "function") {

      // register utility function for aui/template.js
      template.helper('formatMoney', ShopUtil.formatMoney);
      template.helper('formatDate', ShopUtil.formatDate);
    } else {
      if (typeof console == 'object' && typeof console.log == 'function') {
        console.log('no template library found')
      }
    }
  }

  exp.initTemplateHelper = initTemplateHelper;

  /**
   * @require template.js
   * get compiled template from text by node id, the node will be removed if compilation succeed
   * @param id element id
   * @returns compiled template function
   */
  function getTemplateById(id) {
    var $node = $('#' + id);

    if ($node && $node.length && typeof template === "function") {
      var text = $node.text();
      if (!text) {
        text = $node[0].innerHTML;
      }
      var func = template.compile(text);
      // remove node if template compiled
      $node.remove();
      return func;
    } else {
      if (typeof console == 'object' && typeof console.log == 'function') {
        console.log('no template library found or no template node defined: ' + id);
      }
    }
  }
  // expose function
  exp.getTemplateById = getTemplateById;

  function initBlockUI() {
    if (!$.blockUI) {
      return;
    }
    $.blockUI.defaults.css = {
      top:'20%'
    };
    $.blockUI.defaults.overlayCSS= {
      backgroundColor:	'#fff', // white
        opacity:			0, // 100% transparent
        cursor:				'wait'
    };
  }

  function block($ele, options) {
    options = $.extend({}, options || {});
    if ($ele && $ele.length) {
      options.message = '<div class="s-loading"><span style="padding-left: 40px;">&nbsp;&nbsp;'
        + (options.message ? options.message : '加载中...')
        + '</span></div>';
      $ele.block($.extend({}, options));
    }
  }
  function unblock($ele) {
    if ($ele && $ele.length) {
      $ele.unblock();
    }
  }
  exp.initBlockUI = initBlockUI;
  exp.block = block;
  exp.unblock = unblock;


  +function initUtil() {
    $(initTemplateHelper);
    $(initBlockUI);
  }();

  return exp;
}();





