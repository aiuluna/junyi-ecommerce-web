$(function() {
  //gotop
  $("#goTop").hide();
  //fixedNav
  $(window).scroll(function() {
    var scrollH = $(window).scrollTop();
    if (scrollH >= 200) {
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

  $(".c-close").click(function() {
    $(this).parents(".cart-tip").fadeOut();
  });

  CartManager.initialize();

  if (typeof _ERR_MSG === 'string') ShopAlert.alert('错误', _ERR_MSG);
});

function popupLogin() {
  ShopLogin.popupLogin(function() {
    window.location.reload();
  });
}

// Manages carts
var CartManager = {
  initialize: function() {
    var cartCtrls = this.cartCtrls = [];
    $('.mycart').each(function() {
      cartCtrls.push(new CartCtrl(this));
    });
    if (cartCtrls.length) {
      // 默认把第一个购物车全部选中
      cartCtrls[0].selectAll(true);
    }
  },

  notifyCartDeleted: function(cartCtrl) {
    var cartCtrls = this.cartCtrls,
      idx = cartCtrls.indexOf(cartCtrl);
    if (idx > -1) cartCtrls.splice(idx, 1);
    if (!cartCtrls.length) {
      // 购物车为空了
      $('.cart-tab').fadeOut();
      $('.nobox2').show();
    }
  },

  submitPreOrder: function(items) {
    if (this.submitInProgress) return;
    this.submitInProgress = true;
    // 判断用户是否已经登录
    var self = this;
    $.ajax({
      method: 'POST',
      url: '/passport/check',
      dataType: 'json'
    }).done(function(json) {
      self._goToNextPage(items);
    }).fail(function(xhr) {
      self.submitInProgress = false;
      ShopLogin.popupLogin(function() {
        self.submitInProgress = true;
        self._goToNextPage(items);
      });
    });
  },

  _goToNextPage: function(items) {
    var f = document.getElementById('submitPreOrderForm');
    f.elements['items'].value = JSON.stringify(items);
    f.submit();
  }
};

// A cart controller based on warehouse (there may be many)
function CartCtrl(cartElement) {
  var cartEl = this.cartEl = $(cartElement),
    cartRowMap = this.cartRowMap = {},
    selectedRows = this.selectedRows = [],
    self = this;
  this.productsCouldSell = 0;
  this.productsTotal = 0;
  // init tr
  cartEl.find('tr.goodsline').each(function() {
    var rowCtrl = new CartRowCtrl(self, this);
    cartRowMap[rowCtrl.skuId] = rowCtrl;
    if (rowCtrl.selected) selectedRows.push(rowCtrl);
    if (!rowCtrl.outOfStock) ++self.productsCouldSell;
    ++self.productsTotal;
  });
  var cartAllCheckbox = this.cartAllCheckbox = cartEl.find('input[name=cartAll]');
  cartAllCheckbox.click(this._handleCartAllClick.bind(this));
  // Fields for calc result
  this.spanTotalPayFee = cartEl.find('.total-pay-fee');
  this.spanOrderActDiscount = cartEl.find('.order-act-discount');
  this.spanTotalTax = cartEl.find('.total-tax');
  this.spanTotalFee = cartEl.find('.total-fee');
  this.spanErrorMessage = cartEl.find('.error-message');
  this.btnOrder = cartEl.find('.btn-order');
  this.btnOrder.click(this._preOrderNow.bind(this));
  // Queue for re-calc action
  this.actionQueue = [];
  this.seq = 0;
  this.recalcExecuting = false;
}
$.extend(CartCtrl.prototype, {
  notifyRowSelected: function(rowCtrl) {
    var selectedRows = this.selectedRows;
    selectedRows.push(rowCtrl);
    if (selectedRows.length === this.productsCouldSell) {
      // Set cartAll checked
      this.cartAllCheckbox.prop('checked', true);
    }
    // re-calc
    this._queueCartSelectRecalc();
  },

  notifyRowUnselected: function(rowCtrl) {
    var selectedRows = this.selectedRows;
    var idx = selectedRows.indexOf(rowCtrl);
    if (idx < 0) {
      // should not occur
      console.error('notifyRowUnselected is called but the given rowCtrl is not selected');
      return;
    }
    if (selectedRows.length === this.productsCouldSell) {
      // Uncheck cartAll
      this.cartAllCheckbox.prop('checked', false);
    }
    selectedRows.splice(idx, 1);
    if (selectedRows.length) {
      this._queueCartSelectRecalc();
    } else {
      this._doCartSelectNone();
    }
  },

  notifyQuantityChanged: function(rowCtrl) {
    if (rowCtrl.selected) {
      // re-calc
      this._queueCartSelectRecalc();
    }
    this._deferUpdateCartProductQuantity(rowCtrl.skuId, rowCtrl.quantity);
  },

  notifyRowDeleted: function(rowCtrl) {
    var selectedRows = this.selectedRows,
      cartRowMap = this.cartRowMap;
    var idx = selectedRows.indexOf(rowCtrl);
    if (idx > -1) {
      console.error('Must un-select the row before calling notifyRowDeleted');
      return;
    }
    // 操作DOM
    cartRowMap[rowCtrl.skuId] = null;
    if (rowCtrl.orderActId) {
      // 判断是否要删除订单促销标题行
      var removeOrderActRow = true;
      for (var skuId in cartRowMap) {
        if (cartRowMap[skuId] && cartRowMap[skuId].orderActId === rowCtrl.orderActId) {
          removeOrderActRow = false;
          break;
        }
      }
      if (removeOrderActRow) {
        this.cartEl.find('.order-act-row.act-' + rowCtrl.orderActId).fadeOut();
      }
    }
    if (!rowCtrl.outOfStock) --this.productsCouldSell;
    if (!--this.productsTotal) {
      this.cartEl.fadeOut();
      CartManager.notifyCartDeleted(this);
    } else if (!selectedRows.length) {
      this.cartAllCheckbox.prop('checked', false);
    } else if (selectedRows.length === this.productsCouldSell) {
      // Set cartAll checked
      this.cartAllCheckbox.prop('checked', true);
    }
  },

  // LxC(2016-03-04): 如果从之前的页面back，浏览器会缓存checkbox的状态，也就是说
  // 下面的cartAllCheckbox默认是选中的，通过<code>force</code>来控制是否强制selectAll
  // @param force  只在onload里面用到
  selectAll: function(force) {
    var cartAllCheckbox = this.cartAllCheckbox;
    if (!force && cartAllCheckbox.prop('checked')) return;
    cartAllCheckbox.prop('checked', true);
    this._handleCartAllClick();
  },

  _handleCartAllClick: function() {
    var cartAllCheckbox = this.cartAllCheckbox,
      cartRowMap = this.cartRowMap,
      selectedRows = this.selectedRows,
      b = cartAllCheckbox.prop('checked');
    for (var skuId in cartRowMap) {
      var rowCtrl = cartRowMap[skuId];
      if (!rowCtrl) continue;  // row deleted
      if (b && !rowCtrl.outOfStock && !rowCtrl.selected) {
        selectedRows.push(rowCtrl);
        rowCtrl.select(true);
      } else if (!b && rowCtrl.selected) {
        rowCtrl.select(false);
      }
    }
    if (b) {
      // all products selected
      this._queueCartSelectRecalc();
    } else {
      // none selected
      if (!b) this.selectedRows = [];
      this._doCartSelectNone();
    }
  },

  _queueCartSelectRecalc: function() {
    var selectedRows = this.selectedRows;
    if (!selectedRows.length) return;
    this.actionQueue.push(this._doCartSelectRecalc.bind(this, ++this.seq, this._getSelectedItems()));
    if (!this.recalcExecuting) this._nextCartSelectRecalc();
  },

  _doCartSelectRecalc: function(seq, items) {
    if (this.seq !== seq) {
      this._nextCartSelectRecalc();
      return;
    }
    var self = this, startTime = Date.now();
    this.recalcExecuting = true;
    $.ajax({
      method: 'POST',
      url: '/cart/select',
      data: {
        json: JSON.stringify({seq: seq, items: items})
      },
      dataType: 'json'
    }).done(function(json) {
      if (self.seq !== seq) return;  // skip
      if (json.success) {
        self._updateRecalcResult(json.data);
      } else {
        popupSevereError(json.error.message);
      }
    }).always(function() {
      var elapse = Date.now() - startTime;
      if (elapse < 500) {
        // 如果速度太快，客户端控制一下
        setTimeout(function() {
          self.recalcExecuting = false;
          self._nextCartSelectRecalc();
        }, 500 - elapse);
      } else {
        self.recalcExecuting = false;
        self._nextCartSelectRecalc();
      }
    });
  },

  _nextCartSelectRecalc: function() {
    if (!this.actionQueue.length) return;
    // 取最后一个，其他的抛弃掉
    var action = this.actionQueue.pop();
    this.actionQueue = [];
    action();
  },

  _doCartSelectNone: function() {
    ++this.seq;  // <-- 增加seq，防止之前的操作异步返回的结果覆盖掉当前显示
    this._updateRecalcResult({});
    // 禁用 “去结算” 按钮
    var btnOrder = this.btnOrder;
    if (!btnOrder.hasClass('cantjies')) btnOrder.addClass('cantjies').removeClass('cart-btn');
  },

  _updateRecalcResult: function(data) {
    var btnOrder = this.btnOrder;
    if (data.hasError) {
      if (!btnOrder.hasClass('cantjies')) btnOrder.addClass('cantjies').removeClass('cart-btn');
    } else {
      if (!btnOrder.hasClass('cart-btn')) btnOrder.addClass('cart-btn').removeClass('cantjies');
    }
    if (data.errorMessage) {
      this.spanErrorMessage.html(data.errorMessage).show();
    } else {
      this.spanErrorMessage.hide();
    }
    this.spanTotalPayFee.html(data.totalPayFee ? formatMoney2(data.totalPayFee) : MONEY_ZERO);
    this.spanOrderActDiscount.html('-' + (data.orderActDiscount ? formatMoney2(data.orderActDiscount) : MONEY_ZERO));
    // LxC(2016-04-06): 4月8号起税改，不再存在<=50元免税 -->
    //this.spanTotalTax.html(data.totalPayTax ? formatMoney2(data.totalPayTax) : '<del>' + formatMoney2(data.totalTax) + '</del>');
    this.spanTotalTax.html(data.totalPayTax ? formatMoney2(data.totalPayTax) : MONEY_ZERO);
    // <--
    this.spanTotalFee.html(data.totalFee ? formatMoney2(data.totalFee) : MONEY_ZERO);
    // 更新订单促销折扣
    this.cartEl.find('.soYou').hide();
    if (data.orderActList) {
      var warehouseId = data.warehouseId;
      data.orderActList.forEach(function(o) {
        var el = $('#orderActDiscount_' + warehouseId + '_' + o.activityId);
        el.html('-' + formatMoney2(o.discount));
        el.parent().show();
      });
    }
    // 判断是否有单个商品违规错误
    if (data.checkResultList) {
      var cartRowMap = this.cartRowMap;
      data.checkResultList.forEach(function(result) {
        var rowCtrl = cartRowMap[result.skuId];
        if (rowCtrl) rowCtrl.handleSelectResult(result);
      });
    }
  },

  _preOrderNow: function() {
    var btnOrder = this.btnOrder;
    if (btnOrder.hasClass('cantjies')) return;
    var selectedRows = this.selectedRows;
    if (!selectedRows.length) return;
    CartManager.submitPreOrder(this._getSelectedItems());
  },

  // 返回一个list，需要保证页面次序
  _getSelectedItems: function() {
    var cartRowMap = this.cartRowMap,
      items = [];
    this.cartEl.find('.cart-tab tr').each(function() {
      var skuId = $(this).attr('data-sku'),
        rowCtrl = cartRowMap[skuId];
      if (rowCtrl && rowCtrl.selected) {
        items.push({
          skuId: rowCtrl.skuId,
          quantity: rowCtrl.quantity
        });
      }
    });
    return items;
  },

  _deferUpdateCartProductQuantity: function(skuId, quantity) {
    if (!this.productQuantityUpdateQueue) {
      this.productQuantityUpdateQueue = [{
        skuId: skuId,
        quantity: quantity
      }];
    } else {
      var queue = this.productQuantityUpdateQueue,
        alreadyInQueue = false, i;
      for (i = 0; i < queue.length; ++i) {
        if (queue[i].skuId == skuId) {
          queue[i].quantity = quantity;
          alreadyInQueue = true;
          break;
        }
      }
      if (!alreadyInQueue) {
        queue.push({
          skuId: skuId,
          quantity: quantity
        });
      }
    }
    if (this.qTid) clearTimeout(this.qTid);
    this.qTid = setTimeout(this._updateCartProductQuantity.bind(this), 1000);
  },

  _updateCartProductQuantity: function() {
    this.qTid = null;
    if (!this.productQuantityUpdateQueue || !this.productQuantityUpdateQueue.length)
      return;
    var json = JSON.stringify(this.productQuantityUpdateQueue), self = this;
    this.productQuantityUpdateQueue = null;
    $.ajax({
      method: 'POST',
      url: '/cart/product/updateBatch',
      data: {
        products: json
      },
      dataType: 'json'
    }).fail(ajaxErrorHandler);
  }
});

/**
 * Useful properties:
 * - skuId
 * - outOfStock  true: 库存不足，“无效”商品
 * - selected
 * - orderActId  订单活动id
 * - quantity
 */
function CartRowCtrl(cartCtrl, tr) {
  this.cartCtrl = cartCtrl;
  var rowEl = this.rowEl = $(tr);
  this.skuId = Number(rowEl.attr('data-sku'));
  var outOfStock = this.outOfStock = rowEl.hasClass('out-of-stock');
  this.selected = false;
  if (!outOfStock) {
    var cb = this.inputCheck = rowEl.find('input.check');
    this.selected = cb.prop('checked');
    cb.click(this._toggleSelect.bind(this, true));
    // 初始化+/-购物数量控件
    this._initQuantityEditCtrl();
  }
  // 订单促销
  var actId = rowEl.attr('data-act');
  if (actId) {
    this.orderActId = Number(actId);
  } else {
    this.orderActId = -1;
  }
  // 删除按钮
  var self = this;
  rowEl.find('.goodsDel').click(function() {
    // 跳出confirm窗口确认
    ShopAlert.confirm('购物车', '确定要移除该商品吗？', function(result) {
      if (result === 'yes') self._handleGoodsDelClick();
    });
  });
}
$.extend(CartRowCtrl.prototype, {
  select: function(b) {
    if (this.outOfStock) return;
    if (this.selected === b) return;
    this._toggleSelect(false);
  },

  handleSelectResult: function(result) {
    this.stock = result.stock;
    if (result.restrictNumber) this.restrictNumber = result.restrictNumber;
    switch (result) {
    case 'OVERSELL':
      this._showMessageForStock();
      break;
    case 'OVER_RESTRICT_NUMBER':
      this._showMessageForRestrict();
      break;
    case 'OUT_OF_STOCK':
    case 'OFF_SHELVES':
      this._makeInvalid();
      break;
    default:
      break;  // 'SUCCESS'
    }
  },

  _initQuantityEditCtrl: function() {
    var rowEl = this.rowEl,
      tdEl = rowEl.find('td').eq(3),
      btnRedu = this.btnRedu = tdEl.find('.dt-redu'),
      btnAdd = this.btnAdd = tdEl.find('.dt-add'),
      inputQuantity = this.inputQuantity = tdEl.find('.dt-count'),
      self = this;
    this.salePrice = Number(rowEl.find('input[name=salePrice]').val());
    this.amountEl = rowEl.find('.amount');
    this.quantity = Number(inputQuantity.val());
    this.stock = Number(tdEl.find('input[name=stock]').val());
    this.restrictNumber = Number(tdEl.find('input[name=restrictNumber]').val());
    this.msgEl = tdEl.find('.stock-message');
    this.restrictStr = this.msgEl.html();
    // bind events
    btnRedu.click(function() {
      if (self.quantity <= 1) return;
      self.inputQuantity.val(--self.quantity);
      self._updateAmount();
      self._validateQuantity();
      self.cartCtrl.notifyQuantityChanged(self);
    });
    btnAdd.click(function() {
      if (self.quantity >= self.stock) {
        //self._showMessageForStock();
        return;
      }
      if (self.restrictNumber && self.quantity >= self.restrictNumber) {
        //self._showMessageForRestrict();
        return;
      }
      self.inputQuantity.val(++self.quantity);
      self._updateAmount();
      self._validateQuantity();
      self.cartCtrl.notifyQuantityChanged(self);
    });
    // validate on load
    this._validateQuantity();
  },

  _toggleSelect: function(notify) {
    var selected = this.selected = !this.selected;
    if (selected) {
      this.inputCheck.prop('checked', true).parent().addClass('tdbg');
      if (notify) this.cartCtrl.notifyRowSelected(this);
    } else {
      this.inputCheck.prop('checked', false).parent().removeClass('tdbg');
      if (notify) this.cartCtrl.notifyRowUnselected(this);
    }
  },

  _handleGoodsDelClick: function() {
    // send ajax to delete this product from cart
    var self = this;
    $.ajax({
      method: 'POST',
      url: '/cart/product/delete',
      data: {
        skuId: this.skuId
      }
    }).done(function() {
      self.rowEl.fadeOut();
      if (self.selected) self._toggleSelect(true);
      self.cartCtrl.notifyRowDeleted(self);
    }).fail(ajaxErrorHandler);
  },

  _validateQuantity: function() {
    var quantity = this.quantity,
      stock = this.stock,
      restrictNumber = this.restrictNumber,
      btnRedu = this.btnRedu,
      btnAdd = this.btnAdd;
    if (restrictNumber && quantity > restrictNumber) {
      this._showMessageForRestrict();
    } else if (quantity > stock) {
      this._showMessageForStock();
    } else {
      this._hideMessage();
    }
    if (quantity > 1) {
      // enable - button
      if (btnRedu.hasClass('dt-reduct')) btnRedu.removeClass('dt-reduct');
    } else {
      if (!btnRedu.hasClass('dt-reduct')) btnRedu.addClass('dt-reduct');
    }
    if (quantity < stock && (!restrictNumber || quantity < restrictNumber)) {
      // enable + button
      if (btnAdd.hasClass('dt-addct')) btnAdd.removeClass('dt-addct');
    } else {
      if (!btnAdd.hasClass('dt-addct')) btnAdd.addClass('dt-addct');
    }
  },

  _updateAmount: function() {
    this.amountEl.html(formatMoney2(this.salePrice * this.quantity));
  },

  _showMessageForRestrict: function() {
    this.msgEl.html(this.restrictStr).show();
  },

  _showMessageForStock: function() {
    this.msgEl.html('剩余库存：' + this.stock).show();
  },

  _hideMessage: function() {
    this.msgEl.hide();
  },

  _makeInvalid: function() {
    if (this.selected) this._toggleSelect(true);
    this.outOfStock = true;
    var rowEl = this.rowEl,
      tds = rowEl.find('td');
    tds.eq(0).html('<span class="grey">无效</span>');
    this.btnRedu.addClass('dt-reduct').prop('disabled', true);
    this.btnAdd.addClass('dt-addct').prop('disabled', true);
    this.amountEl.html('-');
  }
});

function formatMoney2(num) {
  if (typeof num !== 'number') {
    num = Number(num);
    if (isNaN(num)) return '¥0.00';
  }
  return '¥' + num.toFixed(2);
}

var MONEY_ZERO = formatMoney2(0);

var hasSevereError = false;
function popupSevereError(message) {
  if (hasSevereError) return;
  hasSevereError = true;
  ShopAlert.alert('错误', message, function() {
    window.location.reload();
  });
}

function ajaxErrorHandler() {
  ShopAlert.alert('错误', '服务器出现意外错误，请稍后重试');
}