var ShopOrder = function() {
  var TaskUtil = function() {

    var pool = {};
    var queue = [];

    return {
      add: function(orderNo, expireTime, serverTime) {
        if(orderNo && expireTime) {
          queue.push({
            orderNo: orderNo,
            expireTime: expireTime,
            serverTime: serverTime
          });
        }
      },
      stop: function(orderNo) {
        var task = pool[orderNo];
        if (task) {
          task.stop();
        }
      },
      start : function() {
        while(queue.length) {
          var item = queue.shift();
          if (item) {
            var futureTime = item.expireTime;
            var serverTime = item.serverTime;
            var task = Shop.newCountDownCtrl().create({
              data: item.orderNo,
              serverTime: serverTime,
              futureTime: futureTime,
              onTick: function(orderNo, result) {

                var keys = ['day', 'hour', 'minute', 'second'];
                var units = ['天', '小时', '分', '秒'];
                var arr = [];
                for(var i = 0, len = keys.length; i < len; ++i) {
                  var key = keys[i];
                  var val = result[key] || 0;
                  // 分钟,秒钟 一直显示
                  if (val || (key == 'minute' || key == 'second')) {
                    arr[arr.length] = val < 10 ? ('0' + val) : val;
                    arr[arr.length] = units[i];
                  }
                }
                $('#js_cd_' + orderNo).text(arr.join(''));
              },
              onTimeout: function(orderNo) {
                /* check with server */
                // console.log('timeout event triggered');
                $('.js-pay-order', $('#js_cd_' + orderNo).closest('.js-order-no')).data('timeout', true);
              }
            });
            task.start();
            pool[item.orderNo] = task;

          }
        }
      },
      clear: function() {
        $.each(pool, function(k, v) {
          if (v) {
            v.stop();
          }
        });
        pool = {};
        queue = [];
      }
    };
  }();

  function getStaticTemplate(templateId) {
    var $ele = $('#' + templateId);
    if ($ele.length === 0) {
      return '';
    }
    var text = $ele.html();
    if (!text) {
      text = $ele[0].innerHTML;
    }
    $ele.remove();
    return text;
  }

  function initPurchaseAgain($orderTable) {

    $orderTable.on('click', '.js-order-again', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if ($this.data('disabled')) {
        return;
      }
      $this.data('disabled', true);
      Shop.post({
        url: '/member/order/purchase/' + orderNo,
        success: function() {
          window.location.href = '/cart.html';
        }, error: function(json) {
          $this.data('disabled', false);
          ShopAlert.alert('错误', '失败原因:' + json.error.message);
        }
      });
    });
  }

  function initPayOrder($orderTable) {

    $orderTable.on('click', '.js-pay-order', function() {
      var $this = $(this);

      if ($this.data('disabled')) {
        return;
      }
      $this.data('disabled', true);

      if ($this.data('timeout')) {
        ShopAlert.alert('警告', '订单正在关闭，无法支付! ', function() {
          _loader.refresh();
        });

        $this.data('disabled', false);
        return false;
      }

      return true;
    });
  }

  function initCancel($orderTable, loader) {
    var html = getStaticTemplate('js_template_order_cancel');
    if (!html) {
      ShopAlert.alert('Error', 'No template defined for order cancel popup');
      return;
    }

    // confirm cancel
    $orderTable.on('click', '.js-cancel-order', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if (!$.trim(orderNo)) {
        ShopAlert.alert('出错啦', '订单号不能为空');
        return;
      }

      var $popup = ShopAlert.confirm('取消订单', html, function(yes) {
        if (yes === 'yes') {
          Shop.post({
            url:'/member/order/cancel/' + orderNo,
            data: {orderNo: orderNo, reason: $('#js_order_cancel_reason').val()},
            complete:function(){
              $popup.destroy();
              loader.refresh();
            },
            success: function(json) {

            }, error: function(json){
              ShopAlert.alert('操作失败', '失败原因:' + json.error.message);
            }
          });
        } else {
          $popup.destroy();
        }
      }, {
        autoClose: false,
        className: 's-alert-w-small',
        buttons: {
          ok: {text: '确认取消'},
          cancel: {text: '点错了'}
        },
        after:function($dialog) {
          buildSelectList($dialog);
        }
      });
    });
  }

  function isOrderNoInvalid(orderNo) {
    if (!orderNo) {
      ShopAlert.alert('Error', 'Order No Required');
      return true;
    }
    return false;
  }

  function initServiceTrackExpress($popup) {

    var $contexts = $('.js-service-view-express', $popup);

    $popup.on('keyup', 'input', function(){
      var $me = $(this);
      var maxlen = $me.attr('maxlength') || 50;
      var val = $me.val();
      if (val.length > maxlen) {
        $me.val(val.substr(0, maxlen));
      }
    });

    $popup.on('click', '.js-service-view-change', function() {
      $contexts.each(
        function() {
          var $context = $(this);
          var $viewPart = $('.js-service-change-wrapper', $context);
          var $editPart = $('.js-service-update-wrapper', $context);
          var $textEle = $('.js-text', $viewPart);
          var $inputEle = $('.js-input', $editPart);
          $viewPart.hide();
          $editPart.show();
          $inputEle.val($textEle.data('original') || '');
        }
      );
      var $inputEle = $('.js-input', $(this).closest('.js-service-view-express'));
      $inputEle.focus().val($inputEle.val());
    });
    $popup.on('click', '.js-service-view-cancel', function() {

      $contexts.each(
        function() {
          var $context = $(this);
          var $viewPart = $('.js-service-change-wrapper', $context);
          var $editPart = $('.js-service-update-wrapper', $context);
          $viewPart.show();
          $editPart.hide();
        }
      );
    });
    $popup.on('click', '.js-service-view-update', function() {
      var orderNo = $(this).closest('.js-service-view-express').data('order_no');
      if (isOrderNoInvalid(orderNo)) { return; }
      var data = {};
      $contexts.each(function () {
        var $context = $(this);
        var $editPart = $('.js-service-update-wrapper', $context);
        var $inputEle = $('.js-input', $editPart);
        var key = $inputEle.attr('name');
        data[key] = $.trim($inputEle.val());
      });
      var $code = $('#js_service_apply_express_code');
      data[$code.attr('name')] =  $.trim($code.val());
      Shop.post({
        url:'/member/order/service/express/' + orderNo,
        data: data,
        success: function() {
          $.each($contexts, function () {
            var $context = $(this);
            var $viewPart = $('.js-service-change-wrapper', $context);
            var $editPart = $('.js-service-update-wrapper', $context);
            var $textEle = $('.js-text', $viewPart);
            var $inputEle = $('.js-input', $editPart);
            $viewPart.show();
            $editPart.hide();
            var key = $inputEle.attr('name');
            $textEle.text(data[key]);
            $textEle.data('original', data[key]);
          });
        }
      });
    });
    initExpressName();

  }

  function initServiceTrack($orderTable, loader) {
    $orderTable.on('click', '.js-service-track', function () {
      var me = $(this);
      var orderNo = getOrderNo(me);
      if (isOrderNoInvalid(orderNo)) { return; }
      Shop.post({
        url:'/member/order/service/view/' + orderNo,
        data: {orderNo: orderNo},
        dataType: 'html',
        success: function(html){
          ShopAlert.alert('售后跟踪', html, null, {
            className: 's-alert-w-small',
            after: function($dialog){
              initServiceTrackExpress($dialog);
            }
          });
        },
        error: function(){
          ShopAlert.alert('操作失败', '失败原因:' + json.error.message);
        }
      });
    });
  }

  function initServiceApplyUpload(handler) {

    function toggleUploadBtn() {
      var $wrapper = $('#js_service_apply_voucher_wrapper');
      var images = $('.js-voucher-item', $wrapper);
      if (images.length >= _MAX_IMAGE_COUNT) {
        $('#js_upload_file').attr('disabled', true);
        $('.type-file-box',$wrapper.closest('td')).hide();
      } else {
        $('#js_upload_file').attr('disabled', false);
        $('.type-file-box',$wrapper.closest('td')).show();
      }
    }

    $('#js_service_apply_voucher_wrapper').on('click', '.imgClose', function() {
      var $this = $(this);
      var $item = $this.closest('.js-voucher-item');
      $item.remove();

      toggleUploadBtn();
    });

    $('#js_upload_file').fileupload({
      url: '/member/image/upload/voucher',
      dataType: 'text',
      method:'POST',
      autoUpload: false,
      paramName: 'file',
      acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,
      maxFileSize: 5242880, /* 5 MB */
      messages: {
        maxNumberOfFiles: '只能上传一张图片',
        acceptFileTypes: '只支持以下图片类型: gif, jpg, jpeg, png',
        maxFileSize: '文件超过大小 5MB'
      },
      // Enable image resizing, except for Android and Opera,
      // which actually support image resizing, but fail to
      // send Blob objects via XHR requests:
      disableImageResize: /Android(?!.*Chrome)|Opera/.test(window.navigator.userAgent),
      previewMaxWidth: 60,
      previewMaxHeight: 60,
      previewCrop: true
    }).on('fileuploadadd', function (e, data) {
      data.context = $('<span class="js-voucher-item" style="padding: 0;margin: 0;border: 0;margin-top: 10px;"/>').appendTo('#js_service_apply_voucher_wrapper');
      $.each(data.files, function (index, file) {
        var node = $(
          '<span class="js-voucher-image">' +
          '<a href="javascript:void(0)" class="imgClose"></a>' +
          '<div class="js-voucher-preview" style="line-height: 0;"></div>' +
          '<input type="hidden" class="js-service-apply-image" />' +
          '</span>'
        );

        node.data('image', data);
        data.context.hide();
        node.appendTo(data.context);
        toggleUploadBtn();
      });
    }).on('fileuploadprocessalways', function (e, data) {
      var index = data.index,
        file = data.files[index];

      if (file.error) {
        ShopAlert.alert('上传凭证', file.error, function(){
          $(data.context).remove();
        });
        return;
      }
      data.context.show();

      if (file.preview) {
        $('.js-voucher-preview', $(data.context)).append(file.preview);
      } else {
        var img = $('<img/>')
          .attr('title', file.name)
          .attr('src', 'images/no_preview.png')
          .css('vertical-align', 'inherit');
        $('.js-voucher-preview', $(data.context)).append(img);
      }

    }).on('fileuploadprogressall', function (e, data) {
      // console.log('progress', data);
    }).on('fileuploaddone', function (e, data) {
      // console.log('done', data)
      var json = $.parseJSON(data.result);
      if (json && json.success) {
        $('.js-service-apply-image', $(data.context)).val(json.data.url).data('success', true);
      }

      handler.done();
    }).on('fileuploadfail', function (e, data) {
      // console.log('fail', data)
      handler.fail();
    }).prop('disabled', !$.support.fileInput)
      .parent().addClass($.support.fileInput ? undefined : 'disabled');
  }

  function initServiceApply($orderTable, loader) {
    var html = getStaticTemplate('js_template_service_apply');
    if (!html) {
      ShopAlert.alert('Error', 'No template defined for order service application popup');
      return;
    }

    /* // add events for validations & file upload*/
    /* // 1. 可以选择多个图片, 统一上传*/
    /* // 2. 提示用户图片尚未上传*/

    var selectors = {
      requestReason   : { selector: '#js_service_apply_reason' },
      requestComment  : { selector: '#js_service_apply_comment' },
      refundExpName   : { selector: '#js_service_apply_express_name' },
      refundExpCode   : { selector: '#js_service_apply_express_code' },
      refundExpNo     : { selector: '#js_service_apply_express_no'},
      imageUrl        : {
        selector: '.js-service-apply-image',
        renderer: function(v) {
          return  $.isArray(v) ? JSON.stringify(v) : JSON.stringify([v]);
        }
      }
    };
    var collectInputValues = function($inputs) {
      var values = [];
      $.each($inputs, function(){
        var val = $.trim($(this).val());
        if (val) {
          values[values.length] = val;
        }
      });
      return values;
    };
    var getFormData = function($form) {
      var data = {};
      $.each(selectors, function(k, v){
        var $ele = $(v.selector, $form), len = $ele.length, renderer = v.renderer || function(v){return v;};
        if (len) {
          if (len > 1) {
            data[k] = renderer(collectInputValues($ele));
          } else {
            var val = $.trim($ele.val());
            if (val) {
              data[k] = renderer(val);
            }
          }
        } else {
          /*
          ShopAlert.alert('Error', 'No Field Found By Selector:' + v);
          */
        }
      });
      return data;
    };

    // service apply
    $orderTable.on('click', '.js-service-apply', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if(isOrderNoInvalid(orderNo)) { return; }

      // LxC(2016-03-31): 防止重复提交(很有可能图片上传会占用不少时间)
      var saveInProgress = false;

      var saveFormData = function() {
        Shop.post({
          url:'/member/order/service/apply/' + orderNo,
          data: $.extend({orderNo: orderNo}, getFormData($popup.getDialog())),
          complete:function(){
            $popup.destroy();
            loader.refresh();
          },
          success: function(json) {

          },
          error: function(json){
            ShopAlert.alert('操作失败', '失败原因：' + json.error.message);
          }
        });
      };

      var afterSave = function(btn) {
        // TODO check image uploaded or not
        
        // LxC(2016-03-31): 无论成功失败，这个popup都会被关闭，所以之后没必要去将saveInProgress重置为false
        if (saveInProgress) return;
        saveInProgress = true;
        btn.text('提交中...');  // 这个也没必要去重置了

        var images = $('.js-voucher-image', $('#js_service_apply_voucher_wrapper'));
        if (images.length) {
          $.each(images, function(i, v) {
            var $this = $(v);
            if ($this.data('image')) {
              $this.data('image').submit();
            }
          });
        } else {
          saveFormData();
        }
      };

      var uploadHandler = {
        done: function() {
          var passed = true;
          $.each($('.js-service-apply-image', $('#js_service_apply_voucher_wrapper')), function(i, v) {
            if ($(v).data('success') !== true) {
              passed = passed && false;
            }
          });

          if (passed) {
            saveFormData();
          }
        },
        fail: function() {
          ShopAlert.alert('上传凭证', '图片上传失败啦', function(){
            $popup.destroy();
          });
        }
      };

      var $popup = ShopAlert.confirm('申请售后', html, function(yes, btn) {
        if (yes == 'yes') {
          afterSave(btn);
        } else {
          $popup.destroy();
        }
      }, {
        autoClose: false,
        className: 's-alert-w-small',
        buttons: {
          ok: {text: '提交申请'},
          cancel: {text: '点错了'}
        },
        after:function($dialog) {
          buildSelectList($dialog);
          initServiceApplyUpload(uploadHandler);
          initExpressName();
        }
      });
    });
  }

  function buildSelectList($dialog) {
    $('.jssel', $dialog).selectBox({'selectClassName':'.jsk','selectList':'.condt','selectVal':'.selectVal'});
    $('.jssel', $dialog).each(function(index, ele) {
      var $ele = $(ele);
      $('.condt li:first', $ele).trigger('click');
    });
  }

  function initExpressName(){
    Shop.get({
      url:'/member/express/company/list',
      success: function(json) {
        var $express = $('#js_service_apply_express_name');
        $express.autocomplete(json.data,
          {
            minChars:0,
            scroll:true,
            width:$express.outerWidth(),
            formatItem:function(item){
              if(item.expressName){
                return item.expressName;
              }
              $('#js_service_apply_express_code').val('');
            },
            formatMatch:function(item){
              return item.expressName;
            },
            formatResult:function(item){
              return item.expressName;
            },
            highlight: function(value) { return value; },
            noRecord: ""
          }
        ).result(function(event,item){
          $('#js_service_apply_express_code').val(item.express100Code);
        });
      }
    });
  }

  function initConfirm($orderTable, loader) {
    // confirm received
    $orderTable.on('click', '.js-confirm-receive', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if (!$.trim(orderNo)) {
        ShopAlert.alert('出错啦', '订单号不能为空');
        return;
      }

      var $popup = ShopAlert.confirm('确认收货', '', function(yes) {
        if (yes === 'yes') {
          Shop.post({
            url:'/member/order/confirm/' + orderNo,
            data: {orderNo: orderNo},
            complete:function(){
              $popup.destroy();
              loader.refresh();
            },
            success: function(json) {

            }, error: function(json){
              ShopAlert.alert('操作失败', '失败原因:' + json.error.message);
            }
          });
        } else {
          $popup.destroy();
        }
      }, {
        autoClose: false,
        buttons: {
          ok: {text: '确认收货'},
          cancel: {text: '点错了'}
        }
      });
    });
  }

  function initSelectList() {
    var $select = $('.jssel');
    $select.selectBox({
      'selectClassName':'.jsk',
      'selectList':'.condt',
      'selectVal':'.selectVal',
      selectHandler:function(val){
        if(_loader) {
          _loader.search({timeRange: ShopUtil.getFinishTimeRange(val)});
        }
      }
    });
    $select.each(function(index, ele) {
      var $ele = $(ele);
      $('.condt li:first', $ele).trigger('click');
    });
  }

  function initCountDown($wrapper, selector) {
    /* clear count down*/
    ShopOrder.taskUtil.clear();

    /* collect count down */
    $(selector, $wrapper).each(function(i, v){
      var $v = $(v);
      ShopOrder.taskUtil.add($v.data('order_no'), $v.data('expire_time'), $v.data('server_time'));
    });

    /* start count down*/
    ShopOrder.taskUtil.start();
  }

  function initExpress() {
    var $express = $('#js_order_view_express');
    if($express && $express.length) {
      var orderNo = getOrderNo($express);
      if (!$.trim(orderNo)) {
        ShopAlert.alert('出错啦', '订单号不能为空');
        return;
      }
      Shop.post({
        url:'/member/order/express/' + orderNo,
        dataType: 'html',
        success: function(html) {
          var $package = $('.package', $express).empty().html(html);
          $('.pgDiv:first', $package).show();
          $(".logistics", $package).each(function(){
            var $logs = $(this);
            var lh = $logs.parent(".pgDiv").height() - 56;
            if(lh > 150){
              var cShow = $logs.siblings(".clickShow");
              var cHide = $logs.siblings(".clickHide");
              cShow.show();
              $logs.css({"height":"150px"});
              cShow.click(function(){
                $(this).siblings(".logistics").animate({"height":lh});
                $(this).hide();
                cHide.show();
              });
              cHide.click(function(){
                $(this).siblings(".logistics").animate({"height":"150px"});
                $(this).hide();
                cShow.show();
              });
            } else {
              $logs.siblings(".clickShow").hide();
            }
          });
        }
      });

      $express.on('click', '.pgSpan span', function() {
        var $me = $(this);
        var tab = $me.data('log_tab');
        var $parent = $me.closest('.pgSpan');
        $('span', $parent).removeClass('on');
        $me.addClass('on');
        $('.pgDiv', $express).hide();
        var $tab = $('.pgDiv[data-log_tab=' + tab + ']', $express).show();

      });
    }
  }

  function initLoader() {
    var loader = ShopLoader.init({
      pagination: false,
      url: '/member/orders/list',
      dataType: 'html',
      method: 'post',
      onBeforeLoad: function() {
        ShopUtil.block($('.orderDiv'));
        countLoader();
      },
      onAfterLoad: function() {
        ShopUtil.unblock($('.orderDiv'));
      },
      getCriteria: function() {
        var params = {
          timeRange: ShopUtil.getFinishTimeRange($('#js_search_time_range').val()),
          status : $('#js_search_status').val(),
          searchWord: $('#js_search_keyword').val()
        };

        if (params.status && params.status.toUpperCase() == 'ALL') {
          params.status = '';
        }

        return params;
      },
      render:function(html) {
        var $wrapper = $('#js_order_wrapper');
        $wrapper.empty().html(html);

        initCountDown($wrapper, '.js-order-count-down');
      }
    });

    /* bind loader will be used by ajax*/
    $('#js_pagination_orders').data('loader', loader);

    /* 点击搜索*/
    $('#js_search_btn').click(function () {
      /* 查询并更新条件缓存 */
      loader.search({searchWord: $('#js_search_keyword').val()});
    });
    $('#js_search_keyword').keyup(function(event){
      var keycode = event.which;
      if (keycode == 13) {
        /* 查询并更新条件缓存 */
        loader.search({searchWord: $('#js_search_keyword').val()});
      }

    });

    /* 订单时间范围有改变*/

    /* load order count */
    var countLoader = function(){
      Shop.post({
        url: '/member/orders/count',
        dataType:'json',
        success: function(json){
          $('a.js-tab-item', $('#js_status_div')).each(function(i, v){
            var status = $(v).data('status');
            if (status === 'PENDING_PAY' || status === 'PENDING_SHIP' || status === 'PENDING_RECV') {
              $('.red', $(v)).text(json.data[status] ? json.data[status] : '');
            }
          });
        }
      });
    };

    /* 点击状态tab */
    var $statusWrapper = $('#js_status_div');
    $statusWrapper.on('click', 'a.js-tab-item', function(){
      var me = $(this);
      $('a.js-tab-item', $('#js_status_div')).removeClass('on');
      me.addClass('on');
      var status = me.data('status');
      $('#js_search_status').val(status);

      // 这里会重新获取对应的条件(searchWord, timeRange)
      loader.search();
    });

    /* load data */
    $('a.on', $statusWrapper).trigger('click');

    return loader;
  }
  function getOrderNo($ele) {
    return $ele.closest('.js-order-no').data('order_no');
  }

  function initLoader4View() {

    function loadPage() {
      window.location.reload();
    }

    // 与ShopLoader接口保持一致
    return {
      search: loadPage,
      refresh: loadPage
    }
  }


  var $orderTable = null;
  var _loader = null;
  // 上传凭证图片数据量
  var _MAX_IMAGE_COUNT = 3;

  function init4List(options) {
    options = (options || {});
    $orderTable = $(options.orderTableSelector);
    if (!$orderTable) {
      return;
    }


    initSelectList();

    _loader = initLoader();
    initConfirm($orderTable, _loader);
    initCancel($orderTable, _loader);
    initServiceApply($orderTable, _loader);
    initServiceTrack($orderTable, _loader);
    initPurchaseAgain($orderTable);
    initPayOrder($orderTable);
  }

  function init4View(options) {
    options = (options || {});
    $orderTable = $(options.orderTableSelector);
    if (!$orderTable) {
      return;
    }

    // initSelectList();

    _loader = initLoader4View();
    initCountDown($orderTable, '.js-order-count-down');
    initConfirm($orderTable, _loader);
    initCancel($orderTable, _loader);
    initServiceApply($orderTable, _loader);
    initServiceTrack($orderTable, _loader);
    initPurchaseAgain($orderTable);
    initExpress();
    initPayOrder($orderTable);
  }

  return {
    init4List: init4List,
    init4View: init4View,
    taskUtil : TaskUtil
  }

}();