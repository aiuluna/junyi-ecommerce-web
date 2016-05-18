var ShopAlert = function() {

  var expObj = {};

  var $win = $(window);
  var $doc = $(document);
  var $body = $(document.body);

  var KEY_HIDE_BODY_SCROLL= '$dialog_hide_body_scroll';
  var KEY_BODY_CSS_OVERFLOW = '$dialog_body_overflow';

  function getModal(id) {
    return '<div id="' + id + '" class="s-alert-modal" style="display:block;"></div>';
  }
  function hideBodyScroll($dialog) {
    return $dialog.data(KEY_HIDE_BODY_SCROLL) === true;
  }
  function getDialogHtml(obj) {
    var arr = [];

    arr.push('<div id="' + obj.id + '" class="' + (obj.className || '') + ' s-alert-wrapper" style="display:block;">');
    arr.push(getBody(obj));
    arr.push('</div>');

    //if (obj.hideBodyScroll) {
      arr.unshift('<div class="s-alert-outer">');
      arr.push('</div>');
    //}

    return arr.join('');
  }

  function getBody(obj) {
    return  obj.html ? obj.html : '<a href="javascript:;" class="s-alert-close">&times;</a>' +
    '<p class="s-alert-header">' + (obj.title || '&emsp;') + '</p>' +
    '<div class="s-alert-body"></div>' +
    '<div class="s-alert-buttons"></div>';
  }

  var supportedButtons = ['ok', 'cancel'];
  var buttonTemplates = {
    ok: function(text) {
      return '<a href="javascript:;" class="s-alert-button s-alert-ok">' + (text || '确定') + '</a>';
    },
    cancel : function(text) {
      return'<a href="javascript:;" class="s-alert-button s-alert-cancel">' + (text || '取消') + '</a>';
    }
  };

  var seed = 1;
  function getSeed() {
    return seed++;
  }

  var defaultOptions = {
    autoClose : true
  };

  function mergeDialog(options) {
    return _mergeDialog(options);
  }

  function _mergeDialog(dialogOptions) {
    var $this = $(this);
    var options = $.extend({}, defaultOptions, dialogOptions || {});
    var seed = getSeed();
    var modalId = 'alert_modal_' +　seed;
    var dialogId = 'alert_dialog_' +　seed;
    var hideBodyScroll = (options.hideBodyScroll === true);

    var modal = createModal(modalId, dialogId),
       dialog = createDialog(dialogId, options, hideBodyScroll);

    dialog = $('#' + dialogId);

    dialog.data(KEY_HIDE_BODY_SCROLL, hideBodyScroll);

    if(options.events && options.events.before && typeof options.events.before == 'function') {
      options.events.before(dialog);
    }

    if (options.body) {
      $('.s-alert-body', dialog).html(options.body);
    }
    var buttons = options.buttons || {};
    var buttonWrappers = $('.s-alert-buttons', dialog);
    for (var i = 0, len = supportedButtons.length; i < len; i++) {
      var btnKey = supportedButtons[i],
        btn = buttons[btnKey];
      if (btn) {
        buttonWrappers.append(buttonTemplates[btnKey](btn.text));
      }
    }

    dialog.on('click', '.s-alert-ok', function () {
      var $me = $(this);
      closeDialog(options.autoClose, modal, dialog, function () {
        return options.callbacks.ok('yes', $me);
      });
    });
    dialog.on('click', '.s-alert-cancel', function () {
      var $me = $(this);
      closeDialog(options.autoClose, modal, dialog, function () {
        if (options.callbacks.cancel) {
          options.callbacks.cancel('no', $me);
        } else {
          options.callbacks.ok('no', $me);
        }
      });
    });

    // destroy dialog directly
    dialog.on('click', '.s-alert-close', function () {
      var $me = $(this);
      closeDialog(true, modal, dialog, function () {
        if (options.callbacks.cancel) {
          options.callbacks.cancel('no', $me);
        } else {
          options.callbacks.ok('no', $me);
        }
      });
    });

    if(options.events && options.events.after && typeof options.events.after == 'function') {
      options.events.after(dialog);
    }

    if (hideBodyScroll) {
      dialog.data(KEY_BODY_CSS_OVERFLOW, $body.css('overflow'));
      $body.css('overflow', 'hidden');
    }

    positionDialog(modal, dialog);

    $this.destroy = function() {
      dialog.animate({
        top	: 0 - dialog.height()
      }, 200, function(){
        destroyDialog(modal, dialog);
      });

    };
    $this.getDialog = function() {
      return dialog;
    };
    $this.enableButtons = function($ele) {
      return toggleButtons($ele, true);
    };
    $this.isButtonDisabled = function($ele) {
      return isButtonEnabled($ele);
    };
    $this.disableButtons = function($ele) {
      return toggleButtons($ele, false);
    };

    return $this;
  }

  var _modalQueue = [];
  var _baseIndex = 100;
  var _modalId;
  function createModal(modalId, dialogId) {
    if(_modalQueue.length <= 0) {
      $body.append(getModal(modalId));
      _modalId = modalId;
    }
    _modalQueue.push(dialogId);

    var $modal = $('#' + _modalId);
    if (!_baseIndex) {
      _baseIndex = parseInt($modal.css('zIndex'));
    }
    $modal.css('zIndex', (_baseIndex + 2 * _modalQueue.length));
    return $modal;
  }

  function destroyModal(modal) {
    _modalQueue.pop();
    if(_modalQueue.length <= 0) {
      modal.empty().html('').remove();
    } else {
      modal.css('zIndex', (_baseIndex + 2 * _modalQueue.length));
    }
  }

  function createDialog(dialogId, options, hideBodyScroll) {
    $body.append(getDialogHtml({
      id: dialogId,
      title: options.title,
      className: options.className,
      html: options.html,
      hideBodyScroll: hideBodyScroll
    }));
    var $dialog = $('#' + dialogId);
    //if (hideBodyScroll) {
      $dialog.closest('.s-alert-outer').css('zIndex', _baseIndex + 2 * _modalQueue.length);
    //}
    return $dialog.css('zIndex', _baseIndex + 2 * _modalQueue.length);
  }

  function destroyDialog(modal, dialog) {
    dialog.animate({
      top	: 0 - dialog.height()
    }, 200, function(){
      var hasOuter = hideBodyScroll(dialog);
      if (hasOuter) {
        var overflow = dialog.data(KEY_BODY_CSS_OVERFLOW);
        if (overflow) {
          $body.css('overflow', overflow);
        }
      }

      destroyModal(modal);
      //if (hasOuter) {
        dialog.closest('.s-alert-outer').empty().html('').remove();
      //} else {
      //  dialog.empty().html('').remove();
      //}
    });
  }

  function isButtonEnabled($ele) {
    return $ele.attr('disabled') == 'disabled';
  }
  function toggleButtons($ele, toggle) {
    $ele.attr('disabled', !toggle);
  }
  function closeDialog(autoClose, modal, dialog, callback, args) {
    var closable = true;
    try {
      if (typeof callback == 'function') {
        closable = callback(args);
      }
    } catch(e) {}
    if (autoClose === true && closable !== false) {
      destroyDialog(modal, dialog);
    }
  }

  function getEvents(options) {
    var events = {};
    if (options && options.before && typeof options.before == 'function') {
      events.before = options.before;
    }
    if (options && options.after && typeof options.after == 'function') {
      events.after = options.after;
    }

    return events;
  }
  function alert(title, body, callback, options) {
    options = options || {};
    var btns = options.buttons || {};
    return mergeDialog({
      title : title,
      body : body,
      className: options.className,
      buttons: {
        ok : {
          text: (btns.ok || {}).text
        }
      },
      events : getEvents(options),
      autoClose: options.autoClose !== false,
      callbacks: {
        ok: function(yes, target){
          if (typeof callback == 'function') {
            return callback(yes, target);
          }
          return true;
        }
      }
    });
  }
  function confirm(title, body, callback, options) {
    options = options || {};
    var btns = options.buttons || {};
    return mergeDialog({
      title : title,
      body : body,
      className: options.className,
      buttons: {
        ok : {
          text: (btns.ok || {}).text
        },
        cancel: {
          text: (btns.cancel || {}).text
        }
      },
      events : getEvents(options),
      autoClose: options.autoClose !== false,
      callbacks: {
        ok: function(args, target){
          if (typeof callback == 'function') {
            return callback(args, target);
          }
          return true;
        },
        cancel: function(args, target) {
          if (typeof callback == 'function') {
            callback(args, target);
          }
          return true;
        }
      }
    });
  }

  function dialog(options) {
    options = options || {};
    var btns = options.buttons || {};
    return mergeDialog({
      title : options.title,
      body : options.body,
      html: options.html,
      events : getEvents(options),
      className: options.className,
      autoClose: options.autoClose !== false,
      buttons: {
        ok : {
          text: (btns.ok || {}).text
        }
      },
      callbacks: {
        ok: function(args, target){
          if (typeof options.callback == 'function') {
            options.callback(args, target);
          }
        }
      }
    });
  }

  expObj.alert = alert;
  expObj.confirm = confirm;
  expObj.dialog = dialog;

  function positionDialog($m, $v) {
    $v.hide();
    var ww = $win.width();
    var wh = $win.height();
    var dh = $doc.height();
    var dw = $body.prop('clientWidth');//$doc.width();
    //noinspection JSValidateTypes
    var st = $doc.scrollTop();
    //noinspection JSValidateTypes
    var sl = $doc.scrollLeft();
    var bh = dh >= wh ? dh : wh;
    var bw = dw >= ww ? dw : ww;

    //modal
    $m.css({ height: bh , width: bw });

    //if (hideBodyScroll($v)) {
      $v.closest('.s-alert-outer').css({width: bw, height: wh + st});
    //}
    $v.css({ top: -2000, left: 0}).show();
    var boxHeight = Math.max($v.height(), $v.prop('offsetHeight'));
    var boxWidth = Math.max($v.width(), $v.prop('offsetWidth'));
    var boxLeft = Math.max(0, (ww - boxWidth) / 2) + sl;
    var boxTop = Math.max(0, (wh - boxHeight) / 2) + st;
    $v.css({ top: 0, left: boxLeft});
    $v.animate({ top: boxTop, left: boxLeft}, 50, adaptDialog);
  }

  function adaptDialog(){

    var ww = $win.width();
    var wh = $win.height();

    var modals = $(".s-alert-modal").css({ height: wh + 'px', width: ww + 'px' });

    var dh = $doc.height();
    var dw = $body.prop('clientWidth');//$doc.width();
    //noinspection JSValidateTypes
    var st = $doc.scrollTop();
    //noinspection JSValidateTypes
    var sl = $doc.scrollLeft();

    var bh = dh >= wh ? dh : wh;
    var bw = dw >= ww ? dw : ww;

    $.each(modals, function(i, v) {
      var $v = $(v);
      $v.css({ height: bh + 'px', width: bw + 'px' });
    });

    var dialogs = $(".s-alert-wrapper");
    $.each(dialogs, function(i, v) {
      var $v = $(v);
      //if (hideBodyScroll($v)) {
        $v.closest('.s-alert-outer').css({width: bw, height: wh + st});
      //}

      var boxHeight = Math.max($v.height(), $v.prop('offsetHeight'));
      var boxWidth = Math.max($v.width(), $v.prop('offsetWidth'));
      var boxLeft = Math.max(0, (ww - boxWidth) / 2) + sl;
      var boxTop = Math.max(0, (wh - boxHeight) / 2) + st;
      $v.animate({ top: boxTop, left: boxLeft}, 0);//100
    });
  }

  function bindGlobalEvents() {

    $(window).scroll(function(){
      adaptDialog();
    });
    $(window).resize(function(){
      adaptDialog();
    });
  }

  // bind global events
  bindGlobalEvents();

  return expObj;

}();