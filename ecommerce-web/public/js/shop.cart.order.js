
$(function() {
  //gotop
  $("#goTop").hide();
  //fixedNav
  $(window).scroll(function() {
    var scrollH = $(window).scrollTop();
    if (scrollH >= 500) {
      $("#goTop").fadeIn();
    } else {
      $("#goTop").fadeOut();
    }
  });
  $("#goTop").click(function() {
    var speed = 500; //滑动的速度
    $('body,html').animate({
      scrollTop: 0
    }, speed);
    return false;
  });
  // 优惠券下拉菜单
  $('.jssel').selectBox({
    selectClassName: '.jsk',
    selectList: '.condt',
    selectVal: '.selectVal',
    selectHandler: function(val) {
      var vals = val.split(':');
      OrderManager.onCouponSelectChanged(vals[0], vals[1]);
    }
  });
  checkBuyerMemoInput();

  // 修正显示(去除多余的边框)
  $(".intab tr").each(function() {
    $(".intab tr:last-child th,.intab tr:last-child td").css("border-bottom-width", "0");
  });

  OrderManager.init();

  checkUseCoupon();
  $('#js_useCouponCheck').click(checkUseCoupon);
  $('#js_redeemBtn').click(redeemCoupon);
  $('#js_redeemCodeInput').on('input propertychange', function() {
    $('#js_redeemError').hide();
  });

  function checkBuyerMemoInput() {
    var buyerMemo = $('#js_buyerMemo'),
        buyerMemoLeft = $('#js_buyerMemoLeft'),
        max = 200,
        curLength = buyerMemo.val().length;
    buyerMemo.on('input propertychange', function() {
      var txt = buyerMemo.val(),
          leftNum = max - txt.length;
      if (leftNum <= 0) {
        buyerMemo.val(txt.substring(0, max));
        buyerMemoLeft.text(0);
      } else {
        buyerMemoLeft.text(leftNum);
      }
    });
  }

  function checkUseCoupon() {
    var cb = $('#js_useCouponCheck'),
        couponSelect = $('#js_couponSelect');
    if (cb.prop("checked")) {
      couponSelect.prop("disabled", false);
      couponSelect.css({
        "background-color": "#fff",
        "color": "#333"
      });
      // notify OrderManager
      var selectedCouponVal = $('#js_selectedCoupon').val();
      if (selectedCouponVal) {
        var vals = selectedCouponVal.split(':');
        OrderManager.onCouponSelectChanged(vals[0], vals[1]);
      } else {
        OrderManager.onCouponSelectChanged(-1);
      }
    } else {
      couponSelect.prop("disabled", true);
      couponSelect.css({
        "background-color": "#f4f4f4",
        "color": "#aaa"
      });
      OrderManager.onCouponSelectChanged(-1);
    }
  }

  var redeemInProgress = false;
  function redeemCoupon() {
    var $redeemError = $('#js_redeemError'),
        redeemCode = $('#js_redeemCodeInput').val().trim();
    if (!redeemCode) {
      $redeemError.html('您输入的兑换码有误，请重新输入').show();
      return;
    }

    if (redeemInProgress) return;
    redeemInProgress = true;

    $redeemError.empty().hide();

    $.ajax({
      method: 'POST',
      url: '/cart/coupon/redeem',
      data: {
        items: JSON.stringify(_ITEMS),
        rcode: redeemCode
      },
      dataType: 'json'
    }).done(function(json) {
      if (!json.success) {
        $redeemError.html(json.error.message).show();
        return;
      }
      // clear
      $('#js_redeemCodeInput').val('');
      // use it for selected coupon
      var coupon = json.data,
          selectVal = coupon.id + ':' + coupon.amountDiscount,
          selectDisplay = coupon.name;
      $('#js_couponSelectOpts').prepend('<li value="' + selectVal + '"><a href="javascript:void(0)">' + selectDisplay + '</a></li>');
      $('#js_couponSelect').val(selectDisplay);
      $('#js_selectedCoupon').val(selectVal);
      var cb = $('#js_useCouponCheck');
      if (cb.prop('checked')) {
        OrderManager.onCouponSelectChanged(coupon.id, coupon.amountDiscount);
      } else {
        // 如果之前没有可用的优惠券，需要改变checkbox状态
        cb.prop('checked', true);
        checkUseCoupon();
      }
    }).fail(function(xhr) {
      $redeemError.html('网络错误，请稍后重试').show();
    }).always(function() {
      redeemInProgress = false;
    });
  }
});

var ShopShipAddressPopup = function($) {
  "use strict";

  var $addressList, $addressAddBtn;
  var liTmplFunc, fromTmplFunc;

  function getAddressId($ele) {
    return $ele.closest('li').data('addr_id');
  }

  function getHtml(action, data) {
    if (action == 'create') {
      return fromTmplFunc({
        addr: data || {}
      });
    } else {
      var phone = data.telephone ? data.telephone : '';
      var arr = phone.split('-');
      $.each(arr, function(i, v) {
        if (i === 0) {
          data.telephone_region = v;
        }
        if (i === 1) {
          data.telephone_no = v;
        }
        if (i === 2) {
          data.telephone_ext = v;
        }
      });

      return fromTmplFunc({
        addr: data || {}
      });
    }
  }

  function bindPopupEvent($dialog) {

  }

  function getFormData($form) {
    var addrData = $('#js_addr_select').data('$address').getAddress();

    function setAddr(data, dataKey, type, key) {
      if (addrData[type] && addrData[type][key]) {
        data[dataKey] = addrData[type][key];
      }
    }

    function setVal(data, dataKey, selector, delim) {
      var $selected = $(selector, $form);
      if ($selected.length == 1) {
        var val = $.trim($selected.val());
        if (val) {
          data[dataKey] = val;
        }
      } else if ($selected.length > 1) {
        var arr = [];
        $selected.each(function(i, v) {
          var val = $.trim($(v).val());
          if (val) {
            arr.push(val);
          }
        });
        data[dataKey] = arr.join(delim || '');
      }
    }

    var data = {};
    setAddr(data, 'provinceId', 'state', 'id');
    setAddr(data, 'cityId', 'city', 'id');
    setAddr(data, 'countyId', 'county', 'id');
    setAddr(data, 'provinceName', 'state', 'name');
    setAddr(data, 'cityName', 'city', 'name');
    setAddr(data, 'countyName', 'county', 'name');

    setVal(data, 'shipTo', '.cName');
    setVal(data, 'mobile', '.cPhone');
    setVal(data, 'idCardNo', '.cID');
    setVal(data, 'address', '.cAdd');
    setVal(data, 'zipCode', '.js-zip-code');
    setVal(data, 'telephone', '#js_addr_telephone input', '-');

    return data;
  }

  function popupAddressForm(action, addr) {

    addr = addr || {};
    var addrId = addr.id;
    var popupCallback = function(yes, $btn) {
      if (yes != 'yes') {
        return;
      }

      if ($popup.isButtonDisabled($btn)) {
        return false;
      } else {
        $popup.disableButtons($btn);
      }

      if (!ShopShipAddress.validateAddress($popup.getDialog())) {
        $popup.enableButtons($btn);
        return false;
      }
      Shop.post({
        url: '/member/user/address/' + (action == 'create' ? 'create' : 'update'),
        data: $.extend(getFormData($popup.getDialog()), {
          id: addrId
        }),
        success: function(json) {
          if (json && json.success) {
            if (action == 'create') {
              $addressList.append(liTmplFunc({
                addr: json.data,
                ShopUtil: ShopUtil
              }));
              selectDefaultAddress();
            } else {
              var selector = 'li[data-addr_id=' + addrId + ']';
              var $li = $(selector, $addressList);
              var isActive = $li.hasClass('on');
              $li.replaceWith(liTmplFunc({
                addr: json.data,
                ShopUtil: ShopUtil
              }));
              if (isActive) {
                /* do not extract variable */
                $(selector, $addressList).trigger('click');
              }
            }

            $popup.destroy();
          } else {
            ShopAlert.alert('保存失败', '保存新地址失败啦, 请重试');
          }
        },
        complete:function(){
          $popup.enableButtons($btn);
        }
      });
    };

    var $popup = ShopAlert.dialog({
      autoClose: false,
      title: (action == 'create' ? '新增' : '修改') + '收货地址',
      body: getHtml(action, addr),
      className: 's-alert-w-600',
      buttons: {
        ok: {
          text: '保存新地址'
        }
      },
      after: function($dialog) {
        bindPopupEvent($dialog);
        ShopShipAddress.initAddressSelect(addr);
        ShopShipAddress.initFieldValidation($dialog);
      },
      callback: popupCallback
    });
  }

  function bindEvents() {
    $addressList.on('click', '.js-addr-set-def', function(event) {
      var $me = $(this);
      Shop.post({
        url: '/member/user/address/default',
        data: {
          id: getAddressId($me)
        },
        success: function(json) {
          if (json && json.success) {
            var $current = $me.closest('.js-addr-set-def-wrapper');
            $current.data('address.locked', true);
            $('.js-addr-set-def-wrapper', $addressList).each(function() {
              var $wrapper = $(this);
              if (!$wrapper.data('address.locked')) {
                $wrapper.html('<a href="javascript:void(0)" class="bemo js-addr-set-def">设为默认</a>');
              }
            });
            $current.html('<i class="almo">默认地址</i>').data('address.locked', false);
          }
        }
      });
      event.preventDefault();
      event.stopPropagation();
      return false;
    }).on('click', '.js-addr-update', function(event) {
      var addressId = getAddressId($(this));
      Shop.get({
        url: '/member/user/address/view/' + addressId,
        success: function(json) {
          // popup && bind events
          popupAddressForm('update', json.data.userShippingAddress);
        }
      });
      event.preventDefault();
      event.stopPropagation();
      return false;
    }).on('click', '.js-addr-delete', function(event) {
      var $me = $(this),
        $li = $me.closest('li');
      var isSelected = $li.hasClass('on');
      ShopAlert.confirm('确认', '确定要删除该收货地址吗?', function(yes){
        if (yes == 'yes') {
          Shop.post({
            url: '/member/user/address/delete',
            data: {
              id: getAddressId($me)
            },
            success: function(json) {
              if (json && json.success) {
                $li.removeClass('on').remove();
                if (isSelected) {
                  selectDefaultAddress();
                }
              }
            }
          });
        }
      });

      event.preventDefault();
      event.stopPropagation();
      return false;
    }).on('click', 'li', function() {
      var $li = $(this);
      var isCurrent = $li.hasClass('on');
      if (!isCurrent) {
        $('li.on', $addressList).removeClass('on');
        $(this).addClass('on');
        $addressList.trigger('address.update', [$li, getAddress()]);
      }

    });

    // btn add
    $('#js_addr_add_btn').on('click', function() {
      // popup & event binding
      popupAddressForm('create');
    });
  }

  function selectDefaultAddress() {
    var $li = $('li.on', $addressList);
    if ($li.length === 0) {
      $('li:first', $addressList).trigger('click');
    }
  }

  function getAddress() {
    var $li = $('li.on', $addressList);
    if ($li && $li.length) {
      return {
        addressId: $li.data('addr_id'),
          provinceId: $li.data('state_id')
      };
    } else {
      return null;
    }
  }

  function init() {
    $addressList = $('#js_addr_list');
    $addressAddBtn = $('#js_addr_add_btn');
    liTmplFunc = ShopUtil.getTemplateById('js_addr_li_template');
    fromTmplFunc = ShopUtil.getTemplateById('js_addr_form_template');
    bindEvents();

    selectDefaultAddress();
  }

  function onChange(func) {
    if (typeof func === 'function') {
      $addressList.on('address.update', function(event, $li, address) {
        func(address);
      });
    }
  }

  return {
    init: init,
    getAddress: getAddress,
    onChange: onChange
  };

}(jQuery);

var OrderManager = function($) {

  var totalPayWeight, couponId = -1;
  var spanShippingFee, spanCouponDiscount, spanTotalPayTax, spanTotalFee;

  function init() {
    totalPayWeight = Number($('#js_tpw').val());
    couponId = Number($('#js_couponId').val());
    spanShippingFee = $('#shippingFee');
    spanCouponDiscount = $('#couponDiscount');
    spanTotalPayTax = $('#totalPayTax');
    spanTotalFee = $('#totalFee');

    $('#submitOrder').click(submitOrder);

    ShopShipAddressPopup.init();
    ShopShipAddressPopup.onChange(function(address) {
      if (!totalPayWeight) return;  // 如果商品都是包邮，不需要去后台重新计算了
      queueCartPreOrderRequest();
    });
  }

  var requestQueue = [], requestInProcess = false, seq = 1;

  function queueCartPreOrderRequest() {
    requestQueue.push(requestCartPreOrder);
    if (!requestInProcess) executeNextRequest();
  }

  function executeNextRequest() {
    if (!requestQueue.length) return;
    // 取最后一个，其他的抛弃掉
    var action = requestQueue.pop();
    requestQueue = [];
    action();
  }

  function requestCartPreOrder() {
    requestInProcess = true;
    var address = ShopShipAddressPopup.getAddress();
    $.ajax({
      method: 'POST',
      url: '/cart/preorder',
      data: {
        json: JSON.stringify({
          seq: seq++,
          items: _ITEMS,
          couponId: couponId > 0 ? couponId : null,
          shippingRegionId: address ? address.provinceId : null
        })
      },
      dataType: 'json'
    }).done(function(json) {
      if (json.success) {
        data = json.data;
        spanShippingFee.html(formatMoney2(data.shippingFee));
        spanCouponDiscount.html('-' + formatMoney2(data.couponDiscount));
        spanTotalPayTax.html(formatMoney2(data.totalPayTax));
        spanTotalPayTax.prop('title', '含运费税费：' + formatMoney2(data.totalShippingTax));
        spanTotalFee.html(formatMoney2(data.totalFee));
      }
    }).always(function() {
      requestInProcess = false;
      executeNextRequest();
    });
  }

  function onCouponSelectChanged(id, discount) {
    if (couponId == id) return;
    couponId = id;
    queueCartPreOrderRequest();
  }

  var submitInProcess = false;
  function submitOrder() {
    var address = ShopShipAddressPopup.getAddress();
    if (!address) {
      ShopAlert.alert('提示', '请选择一个收货地址！');
      return;
    }

    if (submitInProcess) return;
    submitInProcess = true;

    $.ajax({
      method: 'POST',
      url: '/cart/checkout',
      data: {
        items: JSON.stringify(_ITEMS),
        shipAddrId: address.addressId,
        buyerMemo: $('#js_buyerMemo').val(),
        couponId: couponId,
        fromMobile: 'N'
      },
      dataType: 'json'
    }).done(function(json) {
      if (!json.success) {
        submitInProcess = false;
        ShopAlert.alert('错误', json.error.message);
        return;
      }
      // LxC(2016-03-04): 我们希望购物车第二个页面不要在history留下记录，使用location.replace
      var checkoutUrl = 'cart-checkout-' + json.data + '.html';
      try {
        window.location.replace(checkoutUrl);
      } catch (e) {
        window.location.href = checkoutUrl;
      }
    }).fail(function(xhr) {
      submitInProcess = false;
      ShopAlert.alert('错误', '网络错误，请稍后重试');
    });
  }

  return {
    init: init,
    onCouponSelectChanged: onCouponSelectChanged
  };

}(jQuery);

function formatMoney2(num) {
  if (typeof num !== 'number') {
    num = Number(num);
    if (isNaN(num)) return '¥0.00';
  }
  return '¥' + num.toFixed(2);
}
