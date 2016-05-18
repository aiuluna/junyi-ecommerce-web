$(function() {
  var applicableCoupons = _COUPONS;

  OrderManager.init();

  $('#js_selectCoupon').click(popupSelectCoupon);
  $('#js_redeemCoupon').click(popupRedeemCoupon);
  if (applicableCoupons.length) {
    _useCoupon(applicableCoupons[0]);
  }

  function popupSelectCoupon() {
    if (!applicableCoupons.length) {
      ShopPopup.toast('没有可用的优惠券');
      return;
    }
    var actions = [];
    for (var i = 0; i < applicableCoupons.length; ++i) {
      var coupon = applicableCoupons[i];
      actions.push({
        text: coupon.name,
        onClick: _useCoupon.bind(null, coupon)
      });
    }
    ShopPopup.actions({
      actions: actions,
      cancelLabel: '有钱任性不使用优惠券',
      onCancel: function() {
        _useCoupon(null);
      }
    });
  }

  function _useCoupon(coupon) {
    if (coupon) {
      OrderManager.onCouponSelectChanged(coupon.id, coupon.amountDiscount);
      $('#js_selectedCoupon').html(coupon.name);
    } else {
      OrderManager.onCouponSelectChanged(-1);
      $('#js_selectedCoupon').empty();
    }
  }

  function popupRedeemCoupon() {
    ShopPopup.prompt('兑换优惠券', function(redeemCode) {
      redeemCode = redeemCode.trim();
      if (!redeemCode) {
        ShopPopup.toast('您输入的兑换码有误，请重新输入');
        popupRedeemCoupon();
        return;
      }
      _redeemCoupon(redeemCode);
    });
  }

  var redeemInProgress = false;
  function _redeemCoupon(redeemCode) {
    if (redeemInProgress) return;
    redeemInProgress = true;

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
        ShopPopup.toast(json.error.message);
        popupRedeemCoupon();
        return;
      }
      ShopPopup.toastSuccess('兑换成功');
      // use it for selected coupon
      var coupon = json.data;
      applicableCoupons.unshift(coupon);
      _useCoupon(coupon);
    }).fail(function(xhr) {
      ShopPopup.toast('网络错误，请稍后重试');
      popupRedeemCoupon();
    }).always(function() {
      redeemInProgress = false;
    });
  }
});


var ShippingAddressManager = (function() {

  var sel_address, addressTemplate, $wrapper, $addressListPage, $noDataDiv;

  function _data(elem) {
    var fields = {
      shipTo: 'ship_to',
      id: "id",
      isDefault: 'is_default',
      idCardNo: 'id_card_no',
      mobile: 'mobile',
      provinceId: 'province_id',
      provinceName: 'province_name',
      cityName: 'city_name',
      countyName: 'county_name',
      address: 'address'
    };

    var addr = {};
    for (var key in fields) {
      var data_field = fields[key];
      var value = elem.data(data_field);
      if(value) {
        addr[key] = value;
      }
    }
    return addr;
  }
  function _render(data) {
    var html = addressTemplate({address:data, ShopUtil: ShopUtil});
    $wrapper.html('');
    $wrapper.append(html);
  }
  function init() {
    $wrapper = $('#js_select_wrapper');
    $addressListPage = $('.js_address_list_page');
    addressTemplate = ShopUtil.getTemplateById('js_address_template');
    $noDataDiv = $('#win-middle');
    loadSelectAddress();
  }

  function getAddress() {
    return sel_address;
  }

  function onChange(callback) {
    $wrapper.change('change', function() {
      loadSelectAddress(callback);
    });
  }

  function loadSelectAddress(callback) {
    var addressElem =  $addressListPage.find('.becon').parent();
    sel_address = _data(addressElem);
    if(!$.isEmptyObject(sel_address)) {
      _render(sel_address);
    } else {
      $wrapper.html($noDataDiv.html());
    }
    if(callback && typeof callback === 'function') {
      callback(sel_address);
    }
  }

  return {
    init: init,
    getAddress: getAddress,
    onChange: onChange
  };

})();

// 订单管理，包括计算运费、提交订单
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

    ShippingAddressManager.init();
    ShippingAddressManager.onChange(function(address) {
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
    var address = ShippingAddressManager.getAddress();
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
    var address = ShippingAddressManager.getAddress();
    if (!address || !address.id) {
      ShopPopup.alert('请选择一个收货地址！');
      return;
    }

    if (submitInProcess) return;
    submitInProcess = true;
    ShopPopup.popupLoading('页面跳转中...');
    $.ajax({
      method: 'POST',
      url: '/cart/checkout',
      data: {
        items: JSON.stringify(_ITEMS),
        shipAddrId: address.id,
        buyerMemo: $('#js_buyerMemo').val(),
        couponId: couponId,
        fromMobile: 'Y'
      },
      dataType: 'json'
    }).done(function(json) {
      if (!json.success) {
        submitInProcess = false;
        ShopPopup.popupLoadingClose();
        ShopPopup.alert(json.error.message);
        return;
      }
      // 不要关闭loading popup，让用户知道页面还在加载
      //ShopPopup.popupLoadingClose();
      // LxC(2016-03-04): 我们希望购物车第二个页面不要在history留下记录，使用location.replace
      var checkoutUrl = 'cart-checkout-' + json.data + '.html';
      try {
        window.location.replace(checkoutUrl);
      } catch (e) {
        window.location.href = checkoutUrl;
      }
    }).fail(function(xhr) {
      submitInProcess = false;
      ShopPopup.popupLoadingClose();
      ShopPopup.alert('网络错误，请稍后重试');
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
