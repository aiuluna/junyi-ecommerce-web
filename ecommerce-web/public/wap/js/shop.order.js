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
                    arr[arr.length] = '<span class="red">' + (val < 10 ? ('0' + val) : val) + '</span>';
                    arr[arr.length] = units[i];
                  }
                }
                $('#js_cd_' + orderNo).html(arr.join(''));
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
    if ($ele.length == 0) {
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

      if ($this.data('timeout')) {
        ShopAlert.alert('警告', '订单因为支付超时正在关闭，无法支付! ', function() {
          _loader.refresh();
        });
      }

      ShopPopup.popupLoading('页面跳转中...');
      setTimeout(function() {
        window.location.href = 'cart-checkout-' + $this.attr('data-orderNo') + '.html';
      }, 50);
    });
  }

  function initCancel($orderTable, loader) {

    var dataArr = [
      {value:"0", text:'买错了'},
      {value:"1", text:'我不想买了'},
      {value:"2", text:'信息填写错误'},
      {value:"3", text:'付款遇到问题'},
      {value:"4", text:'重复下单'},
      {value:"5", text:'商品价格太贵'},
      {value:"6", text:'不能开具发票'},
      {value:"7", text:'其他理由'}
    ];
    var dataMap = {}, dataMap2 = {};
    $.each(dataArr, function(i, v){ dataMap[v.value] = v.text; dataMap2[v.text] = v.value; });

    $(document.body).append('<select style="display: none;" id="js_cancel_order_select"></select>');

    $('#js_cancel_order_select').mobiscroll().select({
      theme: 'ios',
      lang: 'zh',
      display: 'bottom',
      data: dataArr,
      mode: 'mixed',
      headerText:'请选择取消订单原因:',
      inputClass: 'hidden',
      onBeforeClose: function(val, btn){
        if (btn == 'set') {
          var orderNo = $('#js_cancel_order_select').data('orderNo');

          Shop.post({
            url: '/member/order/cancel/' + orderNo,
            data: {orderNo: orderNo, reason: val},
            complete: function () {
              setTimeout(function () {
                loader.refresh();
              }, 800);
            },
            success: function () {
              ShopPopup.toast('取消订单成功');
            }, error: function (json) {
              ShopPopup.toast('操作失败, 原因:' + json.error.message);
            }
          });
        }
      }
    });

    // confirm cancel
    $orderTable.on('click', '.js-cancel-order', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if (!$.trim(orderNo)) {
        ShopAlert.alert('出错啦', '订单号不能为空');
        return;
      }

      $('#js_cancel_order_select').data('orderNo', orderNo).mobiscroll('show');
    });
  }

  function isOrderNoInvalid(orderNo) {
    if (!orderNo) {
      ShopAlert.alert('Error', 'Order No Required');
      return true;
    }
    return false;
  }

  function initServiceApply(){
    // service apply
    $orderTable.on('click', '.js-service-apply', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if (isOrderNoInvalid(orderNo)) {
        return;
      }

      window.location.href = 'member-order-service-apply-' + orderNo + '.html';
    });
  }

  function initServiceTrack(){
    // service view
    $orderTable.on('click', '.js-service-view', function() {
      var $this = $(this),
        orderNo = getOrderNo($this);

      if (isOrderNoInvalid(orderNo)) {
        return;
      }

      window.location.href = 'member-order-service-view-' + orderNo + '.html';
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

      var handler = function(yes) {
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
      };
      var $popup = confirm('确认收货?');
      if ($popup) {
        handler('yes');
      }
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

    var $wrapper = $orderTable;
    var $noOrder = $('#win-middle');
    var $statusList = $('#js_status_list');
    var orderTmpl = ShopUtil.getTemplateById('js_order_item_template');

    var loader = ShopScroll;
    loader.init({
      blockable: false,
      abortable: true,
      dataWrapper: $wrapper,
      method:'POST',
      url:'member/orders/list',
      getParams: function() {
        var $li = $('li.on', $statusList);
        var status = $('a', $li).data('status');
        if (!status) {
          $('a[data-status=ALL]', $statusList).closest('li').addClass('on');
        }
        return {
          status: (status || 'ALL'),
          pageSize: 8
        };
      },
      beforeLoad: function(){
        $noOrder.hide();
        $wrapper.after('<p id="js_scroll_loading" class="nomore" style="text-align: center;"><img src="images/loading-cycle.gif" width="20" height="20"></p>')
      },
      afterLoad: function() {
        $('#js_scroll_loading').remove();
      },
      beforeAppendData: function() {
      },
      afterAppendData:function() {
        // 列表页面倒计时执行但不显示
        initCountDown($wrapper, '.js-order-count-down');
      },
      onDataEnd: function() {
        $wrapper.append('<p class="nomore">已显示全部内容</p>');
      },
      onDataEmpty: function() {
        $noOrder.show();
        $wrapper.html('');
      },
      renderItem: function(order) {
        return orderTmpl({
          order: order,
          order_util: {
            getSimpleOrderStatus4Wap: getSimpleOrderStatus4Wap,
            getOrderOperation4Wap: getOrderOperation4Wap,
            renderAttrs: renderAttrs
          },
          ShopUtil: ShopUtil
        });
      },
      fail: function() {}
    });

    /* 点击状态tab */
    $statusList.on('click', 'li', function(){
      $('li.on', $statusList).removeClass('on');
      var $li = $(this);
      $li.addClass('on');
      var $a = $('a', $li);
      var status = $a.data('status');
      $wrapper.empty().html('');
      $wrapper.data('data_loaded', false);
      $wrapper.data('current_page', 0);
      ShopScroll.load({status: status});
    });

    return {
      loadPage: loader.load,
      refresh: loader.reload
    };
  }
  function getOrderNo($ele) {
    return $ele.closest('.js-order-no').data('order_no');
  }

  function initLoader4View() {

    function loadPage() {
      window.location.reload(true);
    }

    // 与ShopLoader接口保持一致
    return {
      loadPage: loadPage,
      refresh: loadPage
    }
  }


  var $orderTable = null;
  var _loader = null;

  function init4List(options) {
    options = (options || {});
    $orderTable = $(options.orderTableSelector);
    if (!$orderTable) {
      return;
    }

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
    initPayOrder($orderTable);
  }

  function renderAttr(key, value) {
    return key + '="' + value + '" ';
  }

  function renderAttrs(values) {
    var arr = [];
    for (var k in values) {
      arr.push(renderAttr('data-' + k, values[k]));
    }
    return arr.join(' ');
  }
  function getSimpleOrderStatus4Wap(status) {
    switch(status) {
      case 'PENDING_PAY':
        return "等待买家付款";
      case 'PENDING_SHIP':
        return "等待卖家发货";
      case 'PENDING_RECV':
        return "等待收货";
      case 'FINISHED':
        return "订单已完成";
      case 'CANCELLED':
        return "订单已关闭";
    }
    return '';
  }
  function getOrderOperation4Wap(order) {
    var arr = [];
    var ops = {
      pay:     '<a href="javascript:void(0)" data-orderNo="' + order.orderNo + '" class="redbtn js-pay-order">立即付款</a>',
      track:   '<a href="member-order-service-view-' + order.orderNo + '.html" class="greybtn js-service-track">售后跟踪</a>',
      apply:   '<a href="member-order-service-apply-' + order.orderNo + '.html" class="grey6 js-service-apply">申请售后</a>',
      cancel:  '<a href="javascript:void(0)" class="grey6 cancel js-cancel-order">取消订单</a>',
      confirm: '<a href="javascript:void(0)" class="redbtn receipt js-confirm-receive">确认收货</a>',
      buy: '<a href="javascript:void(0)" class="redbtn receipt js-order-again">再次购买</a>',
      express:   '<a href="member-order-express-view-' + order.orderNo + '.html" class="greybtn">物流跟踪</a>'
    };
    switch (order.orderStatus) {
      case 'PENDING_PAY':
        arr.push(ops.cancel);
        arr.push(ops.pay);
        break;
      case 'PENDING_SHIP':

        if (order.afterSale == 'Y') {
          arr.push(ops.track);
        } else {
          if(order.commissionSettleStatus == 'PENDING') {
            arr.push(ops.apply);
          }
        }
        break;
      case 'PENDING_RECV':

        if (order.afterSale == 'Y') {
          arr.push(ops.track);
        } else {
          if(order.commissionSettleStatus == 'PENDING') {
            arr.push(ops.apply);
          }
        }
        arr.push(ops.express);
        arr.push(ops.confirm);
        break;
      case 'FINISHED':
        if (order.afterSale == 'Y') {
          arr.push(ops.track);
        } else {
          if(order.commissionSettleStatus == 'PENDING') {
            arr.push(ops.apply);
          }
        }
        arr.push(ops.express);
        break;
      case 'CANCELLED':
        if (order.afterSale == 'Y') {
          arr.push(ops.track);
        }

        arr.push(ops.buy);
    } // end of switch

    return arr.join('');
  }


  function init4ServiceView() {

    var ATTR_CUSTOM = 'custom';
    var $expressSelect = $('#js_express_select');
    var $customRow = $('#js_express_name_dd');
    var $customField = $('#js_express_name2');
    var $expressName = $('#js_express_name');
    var $expressCode = $('#js_express_code');
    /**
     * 初始化快递公司下拉框
     */
    function initExpressCompanySelect(data) {
      var dataMap = {}, dataMap2 = {}, dataArr = [];
      $.each(data, function(i, v){
        dataMap[v.id] = v;
        dataMap2[v.expressName] = v.id;
        dataArr.push({
          value: v.id,
          text: v.expressName
        });
      });
      if (!dataMap2['其他']) {
        dataArr.push({
          value : '-1', text: '其他'
        });
      }


      $expressSelect.closest('dd').on('click', function(){
        $expressSelect.mobiscroll('show');
      });

      $('#js_express_name2').on('change', function() {
        var custom = $('#js_express_name2').val();
        if(custom) {
          $('#js_express_name').val(custom);
        }
      });
      $expressSelect.mobiscroll().select({
        theme: 'ios',
        lang: 'zh',
        display: 'bottom',
        data: dataArr,
        mode: 'mixed',
        headerText:'请选择物流公司:',
        multiline:1,
        inputClass: 'hidden',
        onBeforeClose: function(val, btn){
          if (btn == 'set') {
            $('#chtmlIn').text(val);
            if (val == '其他') {
              $('#js_express_name_dd').removeClass('hidden');
              $('#js_express_name2').data(ATTR_CUSTOM, true);
              $('#js_express_name').val(val);
              $('#js_express_code').val('');
            } else {
              $('#js_express_name_dd').addClass('hidden');
              $('#js_express_name2').data(ATTR_CUSTOM, false).val('');
              $('#js_express_name').val(val);
              $('#js_express_code').val(dataMap[dataMap2[val]]['express100Code']);
            }
          }
        }
      });
    }

    /**
     * 根据需要初始化快递公司下拉框
     */
    function initCompanyList() {
      Shop.get({
        url: '/member/express/company/list',
        success: function(json) {
          var data = json.data;
          /* 物流公司存在 */
          if (data && data.length) {
            initExpressCompanySelect(data);
          } else {
            /* 显示文本框让用户自行填写 */

            var $input = $('#js_express_name2').data(ATTR_CUSTOM);
            $('p', $input.closest('dd')).show();
            $expressSelect.closest('dd').hide();
          }
        }
      });
    }

    function getInputInfo() {
      var fields = ['js_express_name', 'js_express_no', 'js_express_code'], data = {}, $field;
      $.each(fields, function(i, k) {
        $field = $('#' + k);
        data[$field.attr('name')] =  $.trim($field.val());
      });

      /* 如果用户自己手动输入物流公司 */
      var $name2 = $('#js_express_name2');
      if ($name2.data('custom')) {
        data[$name2.attr('name')] =  $.trim($name2.val());
      }
      return data;
    }
    function saveInfo($me) {
      ShopPopup.popupLoading('数据保存中...');
      var data = getInputInfo();
      Shop.post({
        url:'/member/order/service/express/' + getOrderNo($me),
        data: data,
        success: function() {
          ShopPopup.toastSuccess('保存成功');

          /* 更新第一张页面信息 */
          $('#js_express_view_exp_name').text(data.expressName);
          $('#js_express_view_exp_no').text(data.expressNo);
          setTimeout(function(){
            historyBack();
          }, 500);
        },
        complete: function() {
          ShopPopup.popupLoadingClose();
        }
      });
    }

    initCompanyList();

    $('#js_express_btn').on('click', function(){
      saveInfo($(this));
    });

    $('#js_express_edit').on('click', function() {
      window.location.hash = '#js_page_second';
    });
  }

  return {
    init4List: init4List,
    init4View: init4View,
    init4Express: initExpress,
    init4ServiceView: init4ServiceView,
    taskUtil : TaskUtil
  }

}();