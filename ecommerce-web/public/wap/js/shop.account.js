var ShopAccount = function($) {

  var ACCT_TYPE = {
    ALI_PAY: 'ALI_PAY',
    BANK: 'BANK'
  };

  function getAcctFieldMap() {
    return {
      alipayNo    : 'js_alipay_no',
      alipayName  : 'js_alipay_name',
      accountName : 'js_acct_name',
      accountNo   : 'js_acct_no',
      bankName    : 'js_bank_name',
      bankSite    : 'js_bank_site'
    };
  }

  function getUserFieldMap() {
    return {
      userName      :'js_user_name'  ,
      sexType       :'js_user_gender',
      userMobile    :'js_user_mobile',
      requestReason :'js_user_reason'
    }
  }

  function getAccountFormatMap() {
    return {
      accountNo: function(val) {
        return trimBankNo(val);
      }
    }
  }

  function _getDataByFields(fields) {
    var data = {};
    $.each(fields, function(k, v){
      data[k] = $.trim($('#' + v).val());
    });
    return data;
  }

  function getAcctFields(type) {

    var fields = ['accountName', 'bankName', 'bankSite', 'accountNo'];
    if (type == ACCT_TYPE.ALI_PAY ) {
      fields = ['alipayNo', 'alipayName'];
    }
    return fields;
  }

  var FieldValidator = function() {
    var rules = {
      'accountName': {
        pattern: /^[a-zA-Z\u4e00-\u9fa5]{2,20}$/,
        message: '2-20位字符组成，可由中文及英文自由组合',
        text: '开户人姓名'
      },
      'accountNo': {
        pattern: /^\d{4}(\s\d{4}){3}$|\d{4}(\s\d{4}){3}\s\d{1,4}$/,
        message: '16-20位数字之间',
        text:'银行卡号'
      },
      'bankName': {
        pattern: /^[a-zA-Z\u4e00-\u9fa5]{4,100}$/,
        message: '4-100位字符组成，可由中文及英文自由组合',
        text:'开户银行'
      },
      'bankSite': {
        pattern: /^[a-zA-Z\u4e00-\u9fa5]{4,100}$/,
        message: '4-100位字符组成，可由中文及英文自由组合',
        text:'开户网点'
      },
      'alipayNo':{
        pattern:/^[\S\s]{4,100}$/,
        message: '4-100位字符组成',
        text:'支付宝账号'
      },
      'alipayName': {
        pattern: /^[a-zA-Z\u4e00-\u9fa5]{2,20}$/,
        message: '2-20位字符组成，可由中文及英文自由组合',
        text:'账户姓名'
      }
    };

    function doValidate(fields, popup, allowEmpty) {
      var selectors = getAcctFieldMap();
      for (var i = 0, len = fields.length; i < len; ++i) {
        var field = fields[i];
        var rule = rules[field];

        var $ele = $('#' + selectors[field]);
        var val = $.trim($ele.val());
        if (!val) {
          if(allowEmpty) {
            return true;
          } else {
            if (popup) {
              ShopPopup.toast(rule.text + '不能为空');
            }
            return false;
          }
        }
        if (!rule.pattern.test(val)) {
          if (popup) {
            ShopPopup.toast(rule.text + rule.message);
          }
          return false
        }
      }

      return true;
    }

    return {
      doValidate: function(fields){
        return doValidate(fields, true, false);
      },

      doCheck: function(fields, allowEmpty) {
        return doValidate(fields, false, allowEmpty);
      }
    };
  }();

  function getAccountInfo(type, cb) {
    var data = {}, fieldMap = getAcctFieldMap(), formatMap = getAccountFormatMap();

    var fieldArr = getAcctFields(type);
    $.each(fieldArr, function(i, v){
      data[v] = $.trim($('#' + fieldMap[v]).val());
      data[v] = formatMap[v] ? formatMap[v](data[v]) : data[v];
    });

    if (type == ACCT_TYPE.ALI_PAY) {
      data.payType = ACCT_TYPE.ALI_PAY;
    } else {
      data.payType = 'TEMP_BANK_ACCOUNT';
    }

    if (typeof cb === 'function') {
      cb(type, fieldArr, fieldMap);
    }
    return data;
  }



  function validateAccount(type) {
    var fields = getAcctFields(type);

    return FieldValidator.doValidate(fields);
  }
  function checkAccount(type, allowEmpty) {
    var fields = getAcctFields(type);

    return FieldValidator.doCheck(fields, allowEmpty);
  }

  function validateAmount(opType) {

    if (opType != 'commission') {
      return true;
    }

    var $remaining = $('#js_draw_amount');

    if (!$.trim($remaining.val())) {
      ShopPopup.toast('请输入提取额度');
      return false;
    }

    var remaining = parseFloat($remaining.data('remaining'));
    var amount = parseFloat($remaining.val());
    amount = isNaN(amount) ? 0 : amount;
    if(amount > remaining){
      ShopPopup.toast('提取佣金不能大于当前可提取额度');
      return false;
    }
    var minAmt = parseInt($remaining.data('min_draw_amt'));
    if (amount < minAmt) {
      ShopPopup.toast('提取额度不能小于' + minAmt);
      return false;
    }

    return true;
  }

  function applyDraw() {

    var type = $('#js_acct_type').val();
    var data = getAccountInfo(type);

    ShopPopup.popupLoading('保存中...');
    Shop.post({
      url: '/member/commission/draw',
      data: $.extend(data, { amount: $.trim($('#js_draw_amount').val()) }),
      success: function(result){
        ShopPopup.toastSuccess('提交成功');
        setTimeout(function(){
          historyBack();
        }, 1000);
      },
      error: function(json) {
        ShopPopup.alert(json.error.message ? json.error.message : '提取请求失败啦', function(){}, '提取失败');

      },
      complete: function(){
        ShopPopup.popupLoadingClose();
        /* enable btn */
        $('#js_submit_btn').trigger('btn.enable');
      }
    });
  }

  function saveAcct() {
    "use strict";
    var type = $('#js_acct_type').val();

    ShopPopup.popupLoading('保存中...');
    Shop.post({
      type: 'POST',
      url: '/member/bank/account',
      data: $.extend(getAccountInfo(type), {accountType: type}),
      dataType: 'json',
      success:function(result){
        if(result.success) {
          ShopPopup.toastSuccess('保存成功');
          setTimeout(function() {
            history.go(-2);
          }, 1000);
        }
        else
          ShopPopup.toastError(result.error.message);

      },
      complete: function(){
        ShopPopup.popupLoadingClose();
        /* enable btn */
        $('#js_submit_btn').trigger('btn.enable');
      }
    });
  }
  function getUserInfo() {
    return _getDataByFields(getUserFieldMap());
  }
  function validateUserInfo() {
    var userName = $.trim($('#js_user_name').val());
    if (!userName) {
      ShopPopup.toast('请输入姓名');
      return false;
    }

    var reason = $('#js_user_reason').val().trim();
    if (!reason) {
      ShopPopup.toast('请输入申请理由');
      return false;
    }
    return true;
  }

  function isAnyNotEmpty(info) {
    var hasEmpty = 0;
    $.each(info, function(k, v){
      if (!v) {
        hasEmpty++;
      }
    });

    return hasEmpty > 0;
  }

  function isAllEmpty(info) {
    var hasEmpty = 0;
    $.each(info, function(k, v){
      if (v) {
        hasEmpty++;
      }
    });

    return hasEmpty == 0;
  }

  function applyPromoter() {

    // get account info (alipay & bank)
    var alipayInfo = getAccountInfo(ACCT_TYPE.ALI_PAY);
    delete alipayInfo.payType;
    var bankInfo = getAccountInfo(ACCT_TYPE.BANK);
    delete bankInfo.payType;

    // check account is empty string or not
    var hasEmpty4Alipay = isAnyNotEmpty(alipayInfo);
    var hashEmpty4Bank = isAnyNotEmpty(bankInfo);

    // check account with rule (empty string is valid)
    var alipayCheck = checkAccount(ACCT_TYPE.ALI_PAY, true);
    var bankCheck = checkAccount(ACCT_TYPE.BANK, true);

    // get user info of previous page
    var data = getUserInfo();

    var hasWarning = true;
    // check alipay info not empty & validation passed
    if (!hasEmpty4Alipay && alipayCheck) {
      $.extend(data, alipayInfo, {accountType: ACCT_TYPE.ALI_PAY});
      hasWarning = false;
    }
    // check bank info not empty & validation passed
    if (!hashEmpty4Bank && bankCheck) {
      $.extend(data, bankInfo, {accountType: ACCT_TYPE.BANK});
      hasWarning = false;
    }

    if (hasWarning) {
      // all fields have values & failed to validate
      if (!isAllEmpty(alipayInfo) && !validateAccount(ACCT_TYPE.ALI_PAY)) {
        $('#js_submit_btn').trigger('btn.enable');
        return;
      }
      // all fields have values & failed to validate
      if (!isAllEmpty(bankInfo) && !validateAccount(ACCT_TYPE.BANK)) {
        $('#js_submit_btn').trigger('btn.enable');
        return;
      }

      // both are empty strings, validate alipay is enough
      validateAccount(ACCT_TYPE.ALI_PAY);
      $('#js_submit_btn').trigger('btn.enable');
      return;
    }

    var opt ={
      url:'/member/promoter/apply/submit',
      data: data,
      success:function(){
        ShopPopup.toastSuccess('申请已提交');
        setTimeout(function() {
          /*window.location.href = 'member-promoter-apply.html';*/
          history.go(-2);
        }, 1000);
      },
      error: function(json) {
        ShopPopup.alert(json.error.message, function(){}, '操作失败');
      },
      complete: function() {
        ShopPopup.popupLoadingClose();
        $('#js_submit_btn').trigger('btn.enable');

      }
    };

    ShopPopup.popupLoading('保存中...');
    Shop.post(opt);
  }

  function init(opType, cb, ignoreValidation) {
    $('#js_submit_btn').on('click', function(){
      var $me = $(this);
      $me.focus();
      /* enable btn */
      $me.trigger('btn.disable');

      if (!ignoreValidation) {
        if (!validateAmount(opType)) {
          return;
        }

        var acctType = $('#js_acct_type').val();
        if (!validateAccount(acctType)) {
          return;
        }
      }

      cb();
    }).on('btn.disable', function() {
      $('#js_submit_btn').attr('disabled', true);
    }).on('btn.enable', function(){
      $('#js_submit_btn').attr('disabled', false);
    });

    var $bankNo = $('#js_acct_no');
    if ($bankNo.length) {
      $bankNo.on('keyup', function() {
        this.value = formatBankNo($.trim(this.value));
      });
      $bankNo.val(formatBankNo($.trim($bankNo.val())));
    }
  }

  function formatBankNo(val) {
    return val ? val.replace(/[^\d]/g, '').replace(/(\d{4})(?=\d)/g, "$1 ") : '';
  }
  function trimBankNo(val) {
    return val ? val.replace(/\s/g, '') : val;
  }

  function init4Promoter() {
    $("#esybtn").click(function() {
      window.location.hash='#esyDiv2';
    });

    $("#back1").click(function() {
      historyBack();
    });

    $("#back2").click(function() {
      historyBack();
    });

    $("#back3").click(function() {
      historyBack();
    });

    $(".esy-example").click(function() {
      window.location.hash='#esyDiv4';
    });

    $("#esynext1").click(function() {

      // check user info first
      if (!validateUserInfo()) {
        return false;
      }

      window.location.hash='#esyDiv3';
    });

    $("#js_acct_checkbox").change(function() {
      var btn = $('#js_submit_btn');

      if ($("#js_acct_checkbox:checked").length) {
        btn.removeAttr("disabled");
        btn.removeClass("bg-grey");
      } else {
        btn.attr("disabled", "disabled");
        btn.addClass("bg-grey");
      }
    });

  }
  function init4Gender(defVal) {
    var selectData = [
      {id: 'MALE', text: '男'},
      {id: 'FEMALE', text: '女'},
      {id: 'NOT_SET', text: '保密'}
    ];
    ShopSelect.select(
      selectData,
      $('#js_user_gender_trigger'),
      (defVal || 'NOT_SET'), /* 保密 */
      function($ele) {
        var $a = $('a', $ele);
        var value = $a.data('value'), text = $a.text();
        $('#js_user_gender').val(value);
        $('#js_user_gender_text').text(text);
      }
    );
  }

  function init4Account() {
    $(".esy-example").click(function() {
      window.location.hash='#esyDiv4';
    });
    $("#back3").click(function() {
      historyBack();
    });
  }

  return {
    init4Draw: function() {
      init('commission', applyDraw, false);
    },
    init4Acct: function() {
      init('account', saveAcct, false);
      init4Account();
    },
    init4Apply: function(opt) {
      init('account', applyPromoter, true);
      init4Promoter();
      init4Gender(opt.gender);
    }
  }

}(jQuery);