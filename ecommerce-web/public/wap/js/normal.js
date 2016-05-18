$(function() {
  // global: disable ajax cache for GET requests
  $.ajaxSetup({
    cache: false
  });

  var $win = $(window),
      wH = $win.height(),
      wWd = $win.width();

  //fixedNav
  var fixedNav = $("#fixedNav"),
      fixedNavW = fixedNav.width();
  if (fixedNav.length) {
    // 调整footer fixedNav
    fixedNav.css({
      "margin-left": -(fixedNavW / 2),
      "visibility": "visible"
    });
    $(".wd640").css("padding-bottom", "54px");
    $win.resize(function() {
      fixedNavW = fixedNav.width();
      fixedNav.css("margin-left", -(fixedNavW/2));
    });
    // 如果是在购物车页面，那就不需要显示购物车商品数量了
    var url = window.location.href;
    if (url.indexOf('/cart') === -1) {
      requestCartProductsCount();
    }
  }

  //screen
  // $("#screen,#brand").css({
  //   "min-height": wH
  // });
  $(".page").css({
    "min-height": wH
  });

  $(".moren").click(function() {
    $(this).find(".becico").toggleClass("becon");
  });

  //nothing
  var headH = $("header").height(), footerH = fixedNav.length ? fixedNav.outerHeight() : 0;
  $("#win-middle,.win-middle").css({
    "height": wH - headH - footerH,
    "width": wWd,
    "visibility": "visible"
  });
  //member-infor
  var dH = $(document).height();
  if (dH > wH) {
    $("#fullbg").css("height", dH);
  } else {
    $("#fullbg").css("height", wH);
  }

  //列表中">"符号居中展示
  $(".odlist").on('change', function(e) {
    var li = $(this).find('li');
    var odliH = li.height();
    var odLleftH = li.find(".odLleft").height();
    li.find(".u-rtarrL").css("margin-top", (odliH - 14) / 2);
    li.find(".odLleft").css("margin-top", (odliH - odLleftH) / 2);
    e.preventDefault();
  });
});

// select popover
var ShopSelect = function($) {

  var $overlay, $content, handler;

  var init = function() {

    var wH = $(window).height();
    var dH = $(document).height();
    if (dH > wH) {
      $overlay.css("height", dH);
    } else {
      $overlay.css("height", wH);
    }
    var ch = $content.height();
    $content.css("bottom", -ch);
  };

  var show = function() {
    $overlay.show();
    $content.show();
    $content.animate({
      "bottom": 0
    }, 500);
  };

  var hide = function() {
    $overlay.fadeOut();
    $content.fadeOut();
    $content.animate({
      "bottom": 0 - ($content.height())
    }, 500);
  };

  var init2 = function() {
    $content.on('click', '.mbcg-dl dd', function() {
      var $me = $(this);
      if (typeof handler === 'function') {
        handler($me);
      }
      hide();
    });
    $content.on('click', '.mbclose', function() {
      hide();
    });
  };

  var triggerChange = function(val) {
    $('.mbcg-dl dd', $content).each(function(i, v){
      var $a = $('a', $(v));
      if ($a.data('value') == val) {
        $(v).trigger('click');
      }
    });
  };

  var _seed = 0;
  function createDataHtml(arr) {
    var html = [];
    for(var i = 0, len = arr.length; i < len; ++i) {
      html.push('<dd><a data-value="' + arr[i].id + '" href="javascript:void(0)">' + arr[i].text + '</a></dd>');
    }

    return html.join('');
  }

  function createHtml(arr, seed) {
    var $html =
    '<div id="js_select_overlay_{{seed}}" class="fullbg"></div>' +
      '<div class="mbcg" id="js_select_content_{{seed}}">' +
      '<div class="p15">' +
      '<dl class="mbcg-dl">' +
      createDataHtml(arr) +
      '</dl>' +
    '<a href="javascript:void(0)" class="mbclose cgline">取消</a></div>' +
    '</div>';

    /* replace {{seed}} to the real value */
    $(document.body).append($html.replace(/\{\{seed}}/g, seed + ''));
  }

  return {
    /**
     *
     * @param data select data in [{id: '1', text: 'your text'}]
     * @param $trigger jquery object of trigger element
     * @param defVal default value
     * @param _handler callback once target value clicked
     */
    select: function(data, $trigger, defVal, _handler) {
      var seed = _seed;
      if ($trigger.data('created')) {
        return;
      } else {
        $trigger.data('created', true);
        createHtml(data, _seed++);
      }

      $overlay = $('#js_select_overlay_' + seed);
      $content = $('#js_select_content_' + seed);
      handler = _handler;

      init2();

      $trigger.on('click', function() {
        $content.hide();
        init();
        show();
      });

      if (defVal) {
        triggerChange(defVal);
      }
    }
  };
}(jQuery);

// 倒计时
function CountdownCtrl(element, deadline, callback, options) {
  var targetEl = $(element);
  if (!targetEl.length) throw new Error('Could not find element: ' + element);

  var deadlineMillis = deadline instanceof Date ? deadline.getTime() : deadline;
  if (typeof deadlineMillis !== 'number') throw new Error('Invalid deadline: ' + deadline);

  if (arguments.length > 2) {
    if (typeof callback !== 'function') {
      if (arguments.length === 3) options = callback;
      callback = null;
    }
  }
  var opts = $.extend({
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
      html: '',
      deadlineMsg: '',
      currentTimeMillis: null  // used to adjust client time
    }, options || {});

  var html = opts.html || '', elRemainD, elRemainH, elRemainM, elRemainS;
  if (!html) {
    if (opts.showDays) html += '<i class="countdown-remain-d">-</i>天';
    if (opts.showHours) html += '<i class="countdown-remain-h">-</i>小时';
    if (opts.showMinutes) html += '<i class="countdown-remain-m">-</i>分';
    if (opts.showSeconds) html += '<i class="countdown-remain-s">-</i>秒';
  }
  targetEl.html(html);
  if (opts.showDays) elRemainD = targetEl.find('.countdown-remain-d');
  if (opts.showHours) elRemainH = targetEl.find('.countdown-remain-h');
  if (opts.showMinutes) elRemainM = targetEl.find('.countdown-remain-m');
  if (opts.showSeconds) elRemainS = targetEl.find('.countdown-remain-s');

  function pad2(n) {
    if (n < 10) return '0' + n;
    return '' + n;
  }

  var callbackTriggered = false, intvId,
      adjustMillis = opts.currentTimeMillis ? opts.currentTimeMillis - Date.now() : 0;
  function tick() {
    var nMS = deadlineMillis - Date.now() - adjustMillis;
    if (nMS <= 0) {
      if (!callbackTriggered) {
        if (callback) callback(targetEl);
        callbackTriggered = true;
      }
      if (intvId) {
        clearInterval(intvId);
        intvId = null;
      }
      if (opts.deadlineMsg) {
        targetEl.html(opts.deadlineMsg);
      } else {
        if (elRemainD) elRemainD.text('00');
        if (elRemainH) elRemainH.text('00');
        if (elRemainM) elRemainM.text('00');
        if (elRemainS) elRemainS.text('00');
      }
      return;
    }
    var nD = Math.floor(nMS / (1000 * 60 * 60 * 24));
    var nH = Math.floor(nMS / (1000 * 60 * 60)) % 24;
    var nM = Math.floor(nMS / (1000 * 60)) % 60;
    var nS = Math.floor(nMS / 1000) % 60;
    if (elRemainD) elRemainD.text(nD);
    if (elRemainH) elRemainH.text(pad2(nH));
    if (elRemainM) elRemainM.text(pad2(nM));
    if (elRemainS) elRemainS.text(pad2(nS));
  }

  return {
    start: function() {
      if (callbackTriggered) return;  // 已执行过，不再执行
      setTimeout(tick, 0);
      intvId = setInterval(tick, 1000);
    },

    destroy: function() {
      if (intvId) {
        clearInterval(intvId);
        intvId = null;
      }
    }
  };
}
function installCountdownCtrls(options) {
  $('.flash-sale-countdown').each(function() {
    var jqEl = $(this), deadline = jqEl.attr('data-deadline')-0, currentTimeMillis = jqEl.attr('data-current')-0;
    new CountdownCtrl(jqEl, deadline, $.extend({
      html: '<i class="countdown-remain-d">-</i>天<i class="countdown-remain-h">-</i>:<i class="countdown-remain-m">-</i>:<i class="countdown-remain-s">-</i>',
      deadlineMsg: '活动已结束',
      currentTimeMillis: currentTimeMillis
    }, options)).start();
  });
}

function historyBack() {
  window.history.back();
  return false;
}

function BoxAdapt() {
  var ww = $(window).width();
  var wh = $(window).height();
  var dst = $(document).scrollTop();
  var $pop = $(".pop");

  var bh = $pop.height();
  var bw = $pop.width();

  var left = (ww - bw) / 2;
  var top = (wh - bh) / 2;

  if(wh < ww) {
    // 288 = 320 * 0.9
    var cw = Math.max(288, 0.9 * wh);
    $pop.css('width', cw + 'px');

    bh = $pop.height();
    bw = $pop.width();
    left = (ww - bw) / 2;
    top = (wh - bh) / 2;
  } else {
    // exceed width
    if (ww - bw < 30) {
      $pop.css('width', (ww - 30) + 'px');

      bh = $pop.height();
      bw = $pop.width();
      left = (ww - bw) / 2;
      top = (wh - bh) / 2;
    }
  }

  if (wh - bh <= 0) {
    $pop.css('height', Math.min(bh, (wh - 60)) + 'px');

    bh = $pop.height();
    bw = $pop.width();
    left = (ww - bw) / 2;
    top = (wh - bh) / 2;
  }

  $pop.animate({
    "top": top,
    "left": left
  }, 0);
}

function requestCartProductsCount() {
  $.ajax({
    method: 'GET',
    url: '/cart/product/count',
    dataType: 'json'
  }).done(function(json) {
    if (json.success) {
      var count = json.data;
      if (count) {
        var showCount = count;
        if (count > 99) showCount = '···';
        $('#cartCount').text(showCount).removeClass('hidden');
      }
    }
  });
}

// 如果用户是“代理商”或者“推广员”，为页面上的href添加referral标签
function userReferralHook(referralUserId) {
  $('a').each(function() {
    var $this = $(this), href = $this.attr('href').trim();
    if (!href) return;
    var doHook = false;
    if (href === '/wap' || href === '/wap/') {
      doHook = true;
    } else {
      var s = href;
      if (href[0] === '/') s = href.substring(1);
      doHook = /^topic-|^product-/.test(s);
    }
    if (doHook) {
      if (href.indexOf('?') < 0) {
        $this.attr('href', href + '?referral=' + referralUserId);
      } else {
        $this.attr('href', href + '&referral=' + referralUserId);
      }
    }
  });
}

function setWindowTitle(title) {
  document.title = title;
  // 解决iOS以及部分安卓浏览器标题没法修改的问题
  // see http://www.zhihu.com/question/26228251/answer/32405529
  var $body = $('body'), $iframe;
  $iframe = $('<iframe src="images/blank.gif"></iframe>').on('load', function() {
    setTimeout(function() {
      $iframe.off('load').remove();
    }, 0);
  }).appendTo($body);
}

// 有些页面打开比较慢，打开前跳出一个popup提示页面跳转中
function openPageMaybeSlow(pageUrl) {
  $('<div>' +
    '  <div class="weui_mask"></div>' +
    '  <div class="weui_toast">' +
    '    <i class="weui_icon_toast"><span class="icon_loading"></span></i>' +
    '    <p class="weui_toast_content">页面跳转中...</p>' +
    '  </div>' +
    '</div>').appendTo($('body'));
  setTimeout(function() {
    window.location.href = pageUrl;
  }, 50);
}