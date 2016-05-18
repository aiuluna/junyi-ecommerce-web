var config = require('../config'),
    common_data = require('../common_data');


module.exports = {
  renderOrderStatus: getOrderStatus,
  renderSimpleOrderStatus: getSimpleOrderStatus,
  renderSimpleOrderStatus4Wap: getSimpleOrderStatus4Wap,
  renderSimpleSettleStatus: getSimpleSettleStatus,
  // for page orders.html
  renderOrderOperation: getOrderOperation,
  renderOrderOperation4Wap: getOrderOperation4Wap,
  // for page order_view.html
  renderOrderOperation4View: getOrderOperation4View,
  renderOrderStatusProgressBar: getOrderStatusProgressBar,
  renderOrderExpressInfo: getOrderExpressInfo,
  renderOrderPayType: getOrderPayType,

  /* sale service */
  renderSaleServiceStatus: getSaleServiceStatus,
  renderSaleServicePayStatus: getSaleServicePayStatus,
  renderSaleServiceOperationMode: getSaleServiceOperationMode,

  /* order expire time */
  formatOrderExpireTime: formatOrderExpireTime,
  getOrderExpireInfo: getOrderExpireInfo,
  getOrderExpireTime: getOrderExpireTime,
  getOrderServerTime: getOrderServerTime,
  renderAttrs: renderAttrs,

  // mask mobile
  maskMobile: maskMobile,
  maskIdCard: maskIdCard,

  renderPromoterRequestStatus: renderPromoterRequestStatus,
  renderDrawRequestStatus: renderDrawRequestStatus, 
  formatBankAccount: formatBankAccount
};

function getOrderServerTime() {
  return Date.now();
}

function getSimpleSettleStatus(status) {
  switch(status) {
    case 'PENDING':
      return "待结算";
    case 'SETTLED':
      return "已结算";
    case 'EXCLUDED':
      return "未结算";
  }

  return '';
}

function getSimpleOrderStatus(status) {
  switch(status) {
    case 'PENDING_PAY':
      return "待付款";
    case 'PENDING_SHIP':
      return "待发货";
    case 'PENDING_RECV':
      return "待收货";
    case 'FINISHED':
      return "订单已完成";
    case 'CANCELLED':
      return "订单已关闭";
  }
  return '';
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

function getOrderStatus(order) {

  var arr = [];
  switch (order.orderStatus) {

    case 'PENDING_PAY':

      arr.push('<span>等待买家付款</span>');
      break;
    
    case 'PENDING_SHIP':

      arr.push('<span>付款完成</span><br/><span>等待发货</span>');
      break;
    case 'PENDING_RECV':

      arr.push('<span>等待收货</span><br/>');
      if (order.afterSale == 'Y') {
        arr.push('<span>售后处理</span><br/>');
      }

      break;
    case 'FINISHED':

      arr.push('<span>订单已完成</span><br/>');
      if (order.afterSale == 'Y') {
        arr.push('<span>售后处理</span><br/>');
      }

      break;
    case 'CANCELLED':

      arr.push('<span>订单已关闭</span><br/>');
      if (order.afterSale == 'Y') {
        arr.push('<span>售后处理</span><br/>');
      } else {
        arr.push('<span>' +　(order.closeReasonName) + '</span>');
      }
  }

  arr.push('<a href="member-orders-view-' + order.orderNo + '.html" target="_self" class="red js-view-order">查看订单</a>');

  return arr.join('');
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

function getOrderOperation(order) {
  var arr = [];
  arr.push('<div class="plr15 grey">');
  switch (order.orderStatus) {
    case 'PENDING_PAY':

      arr.push('<p class="grey f12">请在' +
        '<span class="red js-order-count-down" ' +
        renderAttr('id', 'js_cd_' + order.orderNo) +
        renderAttrs(getOrderExpireInfo(order)) +
        '> ' + formatOrderExpireTime(order) + '</span>内完成付款</p>');
      arr.push('<a href="cart-checkout-' + order.orderNo + '.html" class="tabtn js-pay-order">立即付款</a>');
      arr.push('<a href="javascript:void(0)" class="grey cancel js-cancel-order">取消订单</a>');

      break;
    case 'PENDING_SHIP':

      if (order.afterSale == 'Y') {
        arr.push('<a href="javascript:void(0)" class="grey aftersales js-service-track">售后跟踪</a>');
      } else {
        if(order.commissionSettleStatus == 'PENDING') {
          arr.push('<a href="javascript:void(0)" class="grey cation js-service-apply">申请售后</a>');
        }
      }

      break;
    case 'PENDING_RECV':

      arr.push('<a href="javascript:void(0)" class="tabtn receipt js-confirm-receive">确认收货</a>');
      if (order.afterSale == 'Y') {
        arr.push('<a href="javascript:void(0)" class="grey aftersales js-service-track">售后跟踪</a>');
      } else {
        if(order.commissionSettleStatus == 'PENDING') {
          arr.push('<a href="javascript:void(0)" class="grey cation js-service-apply">申请售后</a>');
        }
      }

      break;
    case 'FINISHED':

      if (order.afterSale == 'Y') {
        arr.push('<a href="javascript:void(0)" class="grey aftersales js-service-track">售后跟踪</a>');
      } else {
        if(order.commissionSettleStatus == 'PENDING') {
          arr.push('<a href="javascript:void(0)" class="grey cation js-service-apply">申请售后</a>');
        }
      }

      break;
    case 'CANCELLED':

      arr.push('<a href="javascript:void(0)" class="grey5 js-order-again">再次购买</a>');
      if (order.afterSale == 'Y') {
        arr.push('<a href="javascript:void(0)" class="grey aftersales js-service-track">售后跟踪</a>');
      }

  } // end of switch
  arr.push('</div>');
  return arr.join('');
}

function getOrderOperation4Wap(order) {
  var arr = [];
  var ops = {
    pay:     '<a href="javascript:void(0)" data-orderNo="'+order.orderNo+'" class="redbtn js-pay-order">立即付款</a>',
    track:   '<a href="member-order-service-view-' + order.orderNo + '.html" class="greybtn">售后跟踪</a>',
    express:   '<a href="member-order-express-view-' + order.orderNo + '.html" class="greybtn">物流跟踪</a>',
    apply:   '<a href="member-order-service-apply-' + order.orderNo + '.html" class="greybtn">申请售后</a>',
    cancel:  '<a href="javascript:void(0)" class="grey6 cancel js-cancel-order">取消订单</a>',
    confirm: '<a href="javascript:void(0)" class="redbtn receipt js-confirm-receive">确认收货</a>',
    buy: '<a href="javascript:void(0)" class="redbtn receipt js-order-again">再次购买</a>'
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
      break;

  } // end of switch

  return arr.join('');
}

function calcTime(interval) {
  if (interval <= 0) {
    return { second : 0 };
  }
  var days =  Math.floor(interval / 86400000);

  var forHour = Math.abs(interval - days * 86400000);
  var hours =  Math.floor(forHour / 3600000);

  var forMinute = Math.abs(forHour - hours * 3600000);
  var minutes = Math.floor(forMinute / 60000);

  var forSecond = Math.abs(forMinute - minutes * 60000);
  var seconds = Math.floor(forSecond / 1000);

  return {
    day:days ,
    hour:hours,
    minute:minutes,
    second:seconds
  };
}

function renderTime(val, unit, show) {
  if (val) {
    return (val > 10 ? val : '0' + val) + unit;
  } else {
    return show ? '00' + unit : '';
  }
}

function getOrderTtl() {
  return common_data.getOrderTtlOfPendingPay();
}

function formatOrderExpireTime(order) {
  var ttl = getOrderTtl();
  var left = order.orderTime + ttl - Date.now();

  var result = calcTime(left);

  return renderTime(result.days, '天')
      + renderTime(result.hours, '小时')
      + renderTime(result.minutes, '分钟', true)
      + renderTime(result.seconds, '秒', true);
}

function getOrderExpireTime(order) {
  var ttl = getOrderTtl();
  return order.orderTime + ttl;
}

function getOrderExpireInfo(order) {

  if (order.orderStatus === 'PENDING_PAY') {
    return {
      'order_no'    : order.orderNo,
      'server_time' : Date.now(),
      'order_time'  : order.orderTime,
      'order_ttl'   : getOrderTtl(),
      'expire_time' : getOrderExpireTime(order)
    };
  }

  return {};
}

function getOrderOperation4View(order) {
  var arr = [];
  arr.push('<div class="plr15 grey">');
  switch (order.orderStatus) {
    case 'PENDING_PAY':

      arr.push('<p class="f18"><i class="nowico1"></i>当前状态：<span class="red">等待买家付款</span></p>');
      arr.push('<p class="grey pleft25">还有 ' +
        '<span class="red js-order-count-down" ' +
        renderAttr('id', 'js_cd_' + order.orderNo) +
        renderAttrs(getOrderExpireInfo(order)) +
        '> '+ formatOrderExpireTime(order) + ' </span>'
        + ' 进行付款，若未及时付款，系统将自动取消订单</p>'
      );
      arr.push('<p class="pleft25 ptop20">');
      arr.push('<a href="cart-checkout-' + order.orderNo + '.html" class="mbBtn mr20 js-pay-order">立即付款</a>');
      arr.push('<a href="javascript:void(0)" class="grey5 cancel js-cancel-order">取消订单</a>');
      arr.push('</p>');
      break;
    case 'PENDING_SHIP':

      arr.push('<p class="f18">');
      if (order.afterSale == 'Y') {

        arr.push('<a href="javascript:void(0)" class="fr f14 grey5 cation aftersales js-service-track">售后跟踪</a>');
      } else {
        if(order.commissionSettleStatus == 'PENDING') {
          arr.push('<a href="javascript:void(0)" class="fr f14 grey5 cation cation js-service-apply">申请售后</a>');
        }
      }

      arr.push('<i class="nowico2"></i>');
      arr.push('当前状态：<span class="red">付款成功，等待发货</span>');
      arr.push('</p>');

      break;
    case 'PENDING_RECV':

      arr.push('<p class="f18">');
      if (order.afterSale == 'Y') {
        arr.push('<a href="javascript:void(0)" class="fr f14 grey5 cation aftersales js-service-track">售后跟踪</a>');
      } else {
        if(order.commissionSettleStatus == 'PENDING') {
          arr.push('<a href="javascript:void(0)" class="fr f14 grey5 cation cation js-service-apply">申请售后</a>');
        }
      }

      arr.push('<i class="nowico2"></i>');
      arr.push('当前状态：<span class="red">已发货，等待收货</span>');
      arr.push('</p>');
      arr.push('<p class="pleft25 ptop20"><a href="javascript:void(0)" class="mbBtn receipt js-confirm-receive">确认收货</a></p>');

      break;
    case 'FINISHED':

      arr.push('<p class="f18">');
      if (order.afterSale == 'Y') {

        arr.push('<a href="javascript:void(0)" class="fr f14 grey5 cation aftersales js-service-track">售后跟踪</a>');
      } else {
        if(order.commissionSettleStatus == 'PENDING') {
          arr.push('<a href="javascript:void(0)" class="fr f14 grey5 cation cation js-service-apply">申请售后</a>');
        }
      }

      arr.push('<i class="nowico2"></i>');
      arr.push('当前状态：<span class="red">订单已完成</span>');
      arr.push('</p>');
      break;
    case 'CANCELLED':
      arr.push('<p class="f18"><i class="nowico1"></i>当前状态：<span class="red">订单已关闭</span></p>');
      arr.push('<p class="pleft25 grey">关闭原因：' + (order.closeReasonName) + '</p>');
      arr.push('<p class="pleft25 ptop20">');
      arr.push('<a class="mbBtn mr20 js-order-again" href="javascript:void(0)">再次购买</a>' );
      if (order.afterSale == 'Y') {
        arr.push('<a class="grey5 aftersales js-service-track" href="javascript:void(0)">售后跟踪</a>' );
      }
      arr.push('</p>');
  } // end of switch
  arr.push('</div>');
  return arr.join('');
}

function maskMobile(mobile) {
  if(mobile) {
    var str = '' + mobile;
    return _mask(str, 4, 4);
  } else {
    return '';
  }
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

function maskIdCard(idcard) {
  if(idcard) {
    var str = '' + idcard;
    var length = str.length;
    return _mask(str, (length == 15 ? 6 : 8), 4);
  } else {
    return '';
  }
}

function getOrderStatusProgressBar(order) {
  var clz1, clz2, clz3, clz4, arr = [];

  // 已关闭的订单不用显示进度条
  if (order.orderStatus == 'CANCELLED') {
    return '';
  }
  switch (order.orderStatus) {
    case 'PENDING_PAY':
      clz1 = 'mbon1';
      break;
    case 'PENDING_SHIP':
      clz1 = 'mbon1-end';
      clz2 = 'mbon2';

      break;
    case 'PENDING_RECV':
      clz1 = 'mbon1-end';
      clz2 = 'mbon2-end';
      clz3 = 'mbon3';
      break;
    case 'FINISHED':
      clz1 = 'mbon1-end';
      clz2 = 'mbon2-end';
      clz3 = 'mbon3-end';
      clz4 = 'mbon4';
      break;
    case 'CANCELLED':
      // do nothing
  }

  arr.push('<div class="mbProcess">');
  arr.push('<span class="'+ (clz1 ? clz1 : '') +'">1.提交订单</span>');
  arr.push('<span class="'+ (clz2 ? clz2 : '') +'">2.付款成功</span>');
  arr.push('<span class="'+ (clz3 ? clz3 : '') +'">3.蚂蚁发货</span>');
  arr.push('<span class="'+ (clz4 ? clz4 : '') +'">4.确认收货</span>');
  arr.push('</div>');

  return arr.join('');
}

function getOrderPayType(type) {

  switch(type) {
    case 'BANK_ACCOUNT':
      return "银行账户";
    case 'ALI_PAY':
      return "支付宝";
    case 'WEIXIN_PAY':
      return "微信支付";
    case 'ALI_ESCROW':
      return "国际支付宝";
  }

  return '';
}

function getSaleServiceOperationMode(mode) {
  switch (mode) {
  /**
   * 提前关闭服务单
   */
    case 'CLOSE':
      return "关闭售后";
  /**
   * 退款不退货
   */
    case 'REFUND_ONLY':
      return "仅退款";
  /**
   * 先退货后退款
   */
    case 'RETURN_REFUND':
      return "退货退款";
  }
  return '';
}

function getSaleServiceStatus(status) {
  switch (status) {
  /**
   * 待处理
   */
    case 'PENDING_PROCESSING':
      return "待处理";
  /**
   * 待发货
   */
    case 'PENDING_SENDING':
      return "待发货";
  /**
   * 待收货
   */
    case 'PENDING_RECEIVING':
      return "待收货";
  /**
   * 待退款
   */
    case 'PENDING_REFUNDING':
      return "待退款";
  /**
   * 已完成
   */
    case 'FINISHED':
      return "已完成";
  /**
   * 已关闭
   */
    case 'CLOSED':
      return "已关闭";
  }
  return '';
}

function getSaleServicePayStatus(status) {
  switch (status) {
    case 'PENDING_PAY':
      return '待付款';
    case 'PAID':
      return '已付款';
    case 'PAY_FAILED':
      return '支付失败';
    case 'REFUND':
      return '已退款';
    case 'REFUND_PROCESSING':
      return '退款处理中';
    case 'REFUND_FAILURE':
      return '退款失败';
    case 'REFUND_CANCELLED':
      return '退款已取消';
    case 'REFUND_PAYING':
      return '退款支付中';
  }
  return '';
}

// 已发货, 已完成 的订单才需要显示物流信息
function getOrderExpressInfo(order) {
  if (order.orderStatus == 'PENDING_RECV' || order.orderStatus == 'FINISHED') {
    return '<div class="mbBrd js-order-no" id="js_order_view_express" data-order_no="' + order.orderNo + '">' +
           ' <p class="mbh4">物流信息</p>' +
           ' <div class="mbdtail"><div class="package"><div style="padding: 5px 10px;">物流信息加载中...</div>' +
           '</div></div></div>';
  }

  return '';
}

function formatBankAccount(bankNo) {
  if(bankNo) {
    return bankNo.replace(/[^\d]/g, '').replace(/(\d{4})(?=\d)/g, "$1 ");
  }
  return '';
}

function renderPromoterRequestStatus(status) {
  switch (status) {
    case 'AUDIT_WAITING':
      return "待审核";
    case 'AUDIT_PASSED':
      return "审核通过";
    case 'AUDIT_REJECTED':
      return "失败";

  }
}

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