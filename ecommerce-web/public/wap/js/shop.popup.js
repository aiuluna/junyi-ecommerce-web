// Animation manager
//
var FX = (function($, doc) {
  var dummyStyle = doc.createElement('div').style,
      vendor = (function() {
        var vendors = 'webkitT,MozT,msT,OT,t'.split(','),
          t,
          i = 0,
          l = vendors.length;
        for (; i < l; i++) {
          t = vendors[i] + 'ransform';
          if (t in dummyStyle) {
            return vendors[i].substr(0, vendors[i].length - 1);
          }
        }
        return false;
      })(),
      animEndEventName = (function () {
        if (vendor === false) return false;
        var animationEnd = {
          ''      : 'animationend',
          'webkit': 'webkitAnimationEnd',
          'Moz'   : 'animationend',
          'O'     : 'oanimationend',
          'ms'    : 'MSAnimationEnd'
        };
        return animationEnd[vendor];
      })();

  function prefixStyle(style) {
    if (vendor === '') return style;
    style = style.charAt(0).toUpperCase() + style.substr(1);
    return vendor + style;
  }

  var isAnimEnabled = prefixStyle('animation') in dummyStyle;

  return {
    isAnimEnabled: isAnimEnabled,

    animate: function(jqEl, animClass) {
      var deferred = $.Deferred();
      if (this.isAnimEnabled) {
        jqEl.addClass(animClass).on(animEndEventName, function() {
          jqEl.removeClass(animClass).off(animEndEventName);
          deferred.resolve(jqEl);
        });
      } else {
        setTimeout(function() {
          deferred.resolve(jqEl);
        }, 0);
      }
      return deferred.promise();
    },

    concurrent: function() {
      return $.when.apply($, arguments);
    }
  };
})(jQuery, document);

/* AnimManager provides just language sugar */
var AnimManager = {
  one: function(jqEl, animClass, callback) {
    return FX.animate(jqEl, animClass).done(callback || $.noop);
  },

  two: function(jqEl1, animClass1, jqEl2, animClass2, callback) {
    return FX.concurrent(
        FX.animate(jqEl1, animClass1), FX.animate(jqEl2, animClass2)
      ).done(callback || $.noop);
  },

  three: function(jqEl1, animClass1, jqEl2, animClass2, jqEl3, animClass3, callback) {
    return FX.concurrent(
        FX.animate(jqEl1, animClass1), FX.animate(jqEl2, animClass2), FX.animate(jqEl3, animClass3)
      ).done(callback || $.noop);
  }
};

// jQuery Transition extend
//
(function($) {
  $.fn.transitionEnd = function(callback) {
    var events = ['webkitTransitionEnd', 'transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'msTransitionEnd'],
        i, dom = this;

    function fireCallBack(e) {
      if (e.target !== this) return;
      callback.call(this, e);
      for (i = 0; i < events.length; i++) {
        dom.off(events[i], fireCallBack);
      }
    }
    if (callback) {
      for (i = 0; i < events.length; i++) {
        dom.on(events[i], fireCallBack);
      }
    }
    return this;
  };
})($);

var ShopPopup = (function() {

  var _tplAlert = '<div class="weui_dialog_alert">' +
    '  <div class="weui_mask"></div>' +
    '  <div class="weui_dialog">' +
    '    <div class="weui_dialog_hd"><strong class="weui_dialog_title">{{title}}</strong></div>' +
    '    <div class="weui_dialog_bd">{{content}}</div>' +
    '    <div class="weui_dialog_ft">' +
    '      <a href="javascript:;" class="weui_btn_dialog primary">{{btn}}</a>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var _tplConfirm = '<div class="weui_dialog_confirm">' +
    '  <div class="weui_mask"></div>' +
    '  <div class="weui_dialog">' +
    '    <div class="weui_dialog_hd"><strong class="weui_dialog_title">{{title}}</strong></div>' +
    '    <div class="weui_dialog_bd">{{content}}</div>' +
    '    <div class="weui_dialog_ft">' +
    '      <a href="javascript:;" class="weui_btn_dialog default">{{btn1}}</a>' +
    '      <a href="javascript:;" class="weui_btn_dialog primary">{{btn2}}</a>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var _tplPrompt = '<div class="weui_dialog_confirm">' +
    '  <div class="weui_mask"></div>' +
    '  <div class="weui_dialog">' +
    '    <div class="weui_dialog_hd"><strong class="weui_dialog_title">{{title}}</strong></div>' +
    '    <div class="weui_dialog_bd"><input type="text"/></div>' +
    '    <div class="weui_dialog_ft">' +
    '      <a href="javascript:;" class="weui_btn_dialog default">{{btn1}}</a>' +
    '      <a href="javascript:;" class="weui_btn_dialog primary">{{btn2}}</a>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var _tplToastIcon = '<div>' +
    '  <div class="weui_mask_transparent"></div>' +
    '  <div class="weui_toast dim">' +
    '    <i class="weui_icon_toast"><span class="{{iconClass}}"></span></i>' +
    '    <p class="weui_toast_content">{{content}}</p>' +
    '  </div>' +
    '</div>';

  var _tplPopupLoading = '<div>' +
    '  <div class="weui_mask"></div>' +
    '  <div class="weui_toast dim">' +
    '    <i class="weui_icon_toast"><span class="{{iconClass}}"></span></i>' +
    '    <p class="weui_toast_content">{{content}}</p>' +
    '  </div>' +
    '</div>';

  function popupAlert(msg, callback, title, buttonName) {
    var _title = title ? title : '温馨提示',
        _buttonName = buttonName ? buttonName : '确定',
        tpl = _tplAlert.replace('{{title}}', _title).replace('{{content}}', msg).replace('{{btn}}', _buttonName),
        dialog = $(tpl).appendTo($('body'));
    dialog.find('.weui_btn_dialog').on('click', function() {
      dialog.remove();
      if (callback) callback();
    });
  }

  function popupConfirm(msg, callback, title, buttons) {
    var _title = title ? title : '请确认',
        _buttons = (buttons && buttons.length === 2) ? buttons : [{name: '取消', key: 'no'}, {name: '确定', key: 'yes'}],
        tpl = _tplConfirm.replace('{{title}}', _title).replace('{{content}}', msg),
        dialog;
    for (var i = 0; i < _buttons.length; ++i) {
      var btn = _buttons[i], j = i + 1;
      tpl = tpl.replace('{{btn' + j + '}}', btn.name);
    }
    dialog = $(tpl).appendTo($('body'));
    dialog.find('.weui_btn_dialog').each(function(idx) {
      $(this).on('click', function() {
        dialog.remove();
        if (callback) callback(_buttons[idx].key);
      });
    });
  }

  function popupPrompt(msg, callback, buttonLabels) {
    var tpl = _tplPrompt.replace('{{title}}', msg),
        _buttonLabels = (buttonLabels && buttonLabels.length === 2) ? buttonLabels : ['取消', '确定'],
        dialog, promptInput;
    for (var i = 0; i < _buttonLabels.length; ++i) {
      var label = _buttonLabels[i], j = i + 1;
      tpl = tpl.replace('{{btn' + j + '}}', label);
    }
    dialog = $(tpl).appendTo($('body'));
    promptInput = dialog.find('input');
    dialog.find('.weui_btn_dialog').each(function(idx) {
      $(this).on('click', function() {
        dialog.remove();
        if (idx === 1 && callback) callback(promptInput.val());
      });
    });
  }

  var currentToast = null;
  function toast(msg, ellapse) {
    var wnd = $(window),
        offsetW = wnd.width(),
        offsetH = wnd.height();
    var preferedW = Math.min(280, Math.max(offsetW - 40, 100)),
        t = $('<div class="ui-popup-toast dim" style="max-width:' + preferedW + 'px">' + msg + '</div>').appendTo($('body')),
        w = t.outerWidth(), h = t.outerHeight();
    // position to center
    t.css({
      left: Math.min(Math.max(Math.round((offsetW - w) / 2), 0), offsetW - w),
      top: Math.min(Math.max(Math.round((offsetH - h) / 2), 0), offsetH - h)
    });
    // 删除之前的toast
    if (currentToast) currentToast.remove();
    currentToast = t;
    AnimManager.one(t.removeClass('dim'), 'anim-fade-in', function() {
      setTimeout(function() {
        if (currentToast === t) {
          AnimManager.one(t, 'anim-fade-out', function() {
            if (currentToast === t) {
              t.remove();
              currentToast = null;
            }
          });
        }
      }, ellapse || 1200);
    });
  }

  function toastSuccess(msg, ellapse) {
    var tpl = _tplToastIcon.replace('{{iconClass}}', 'icon_success').replace('{{content}}', msg),
        wrapper = $(tpl).appendTo($('body')),
        t = wrapper.find('.weui_toast');
    AnimManager.one(t.removeClass('dim'), 'anim-fade-in', function() {
      setTimeout(function() {
        AnimManager.one(t, 'anim-fade-out', function() {
          wrapper.remove();
        });
      }, ellapse || 1200);
    });
  }

  function toastError(msg, ellapse) {
    var tpl = _tplToastIcon.replace('{{iconClass}}', 'icon_error').replace('{{content}}', msg),
        wrapper = $(tpl).appendTo($('body')),
        t = wrapper.find('.weui_toast');
    AnimManager.one(t.removeClass('dim'), 'anim-fade-in', function() {
      setTimeout(function() {
        AnimManager.one(t, 'anim-fade-out', function() {
          wrapper.remove();
        });
      }, ellapse || 1200);
    });
  }

  var currentPopupLoading = null;
  function popupLoading(msg) {
    var tpl = _tplPopupLoading.replace('{{iconClass}}', 'icon_loading').replace('{{content}}', msg),
        wrapper = $(tpl).appendTo($('body')),
        t = wrapper.find('.weui_toast');
    if (currentPopupLoading) {
      // 直接替换，不需要动画
      currentPopupLoading.remove();
      t.removeClass('dim');
    } else {
      AnimManager.one(t.removeClass('dim'), 'anim-fade-in');
    }
    currentPopupLoading = wrapper;
  }
  function popupLoadingClose() {
    if (currentPopupLoading) {
      var wrapper = currentPopupLoading,
          t = wrapper.find('.weui_toast');
      AnimManager.one(t, 'anim-fade-out', function() {
        wrapper.remove();
      });
      currentPopupLoading = null;
    }
  }

  // ActionSheet, params:
  // {
  //   actions: [{
  //     text: "菜单",
  //     className: "danger",
  //     onClick: function() {
  //       console.log(1);
  //     }
  //   }, {
  //     text: "菜单2",
  //     className: "danger",
  //     onClick: function() {
  //       console.log(2);
  //     }
  //   }],
  //   cancelLabel: '取消',
  //   onCancel: function() {}
  // }
  function showActionSheet(params) {
    var mask = $('<div class="weui_mask_transition"></div>').appendTo(document.body);

    var actions = params.actions || [];
    var actionsHtml = actions.map(function(d, i) {
      return '<div class="weui_actionsheet_cell ' + (d.className || "") + '">' + d.text + '</div>';
    }).join("");
    var cancelLabel = params.cancelLabel || '取消';

    var tpl = '<div class="weui_actionsheet" id="weui_actionsheet">'+
              '  <div class="weui_actionsheet_menu">'+ actionsHtml + '</div>'+
              '  <div class="weui_actionsheet_action">'+
              '    <div class="weui_actionsheet_cell weui_actionsheet_cancel">' + cancelLabel + '</div>'+
              '  </div>'+
              '</div>';
    var dialog = $(tpl).appendTo(document.body);

    dialog.find(".weui_actionsheet_menu .weui_actionsheet_cell").each(function(i, e) {
      $(e).click(function() {
        hideActionSheet();
        if (actions[i] && actions[i].onClick) {
          actions[i].onClick();
        }
      });
    });
    dialog.find(".weui_actionsheet_action .weui_actionsheet_cancel").click(function() {
      hideActionSheet();
      if (params.onCancel) params.onCancel();
    });

    mask.show().addClass('weui_fade_toggle')
      .one('click', function() {
        hideActionSheet();
      })
      .on('touchmove', function(e) {
        e.preventDefault();
      });
    dialog.show().addClass("weui_actionsheet_toggle");

    function hideActionSheet() {
      mask.removeClass("weui_fade_toggle").transitionEnd(function() {
        $(this).hide().remove();
      });
      dialog.removeClass("weui_actionsheet_toggle").transitionEnd(function() {
        $(this).hide().remove();
      });
    }
  }

  return {
    alert: popupAlert,
    confirm: popupConfirm,
    prompt: popupPrompt,
    toast: toast,
    toastSuccess: toastSuccess,
    toastError: toastError,
    popupLoading: popupLoading,
    popupLoadingClose: popupLoadingClose,
    // ActionSheet
    actions: function(params) {
      showActionSheet(params || {});
    },
    closeActions: function() {
      hideActionSheet();
    }
  };
})();