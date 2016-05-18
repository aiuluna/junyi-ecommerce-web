var ShopSetting = function($){

  function doValidate(fields, rules) {
    for (var i = 0, len = fields.length; i < len; ++i) {
      var rule = rules[fields[i]];
      var val = getValue(rule.selector);
      if (!val) {
        ShopPopup.toast(rule.info);
        return false;
      } else {
        if (!rule.pattern.test(val)) {
          ShopPopup.toast(rule.error);
          return false;
        }
      }
    }
    return true;
  }

  function getData(fields, rules){
    var data = {};
    for (var i = 0, len = fields.length; i < len; ++i) {
      var rule = rules[fields[i]];
      data[fields[i]] = getValue(rule.selector);
    }

    return data;
  }

  function clearData(fields, rules) {
    $.each(fields, function (i, v) {
      var rule = rules[v];
      $(rule.selector).val('');
    });
  }

  function getValue(selector) {
    var $field = $(selector);
    return $.trim($field.val());
  }

  var changePwdValidator = function() {

    var rules = {
      oldPassword: {
        selector: '#oldPsw',
        pattern: /^.{6,16}$/,
        info:'请输入旧的密码',
        error:'密码由6到16位字符组成, 区分大小写'
      },
      newPassword: {
        selector: '#newPsw',
        pattern: /^.{6,16}$/,
        info:'请输入新的密码',
        error:'密码由6到16位字符组成, 区分大小写'
      },
      newPassword2: {
        selector: '#repeatPsw',
        pattern: /^.{6,16}$/,
        info:'请再次输入新的密码',
        error:'密码由6到16位字符组成, 区分大小写'
      }
    };
    var  fields = ['oldPassword', 'newPassword', 'newPassword2'];

    function isPwdEquals() {
      var eq = getValue(rules.newPassword.selector) == getValue(rules.newPassword2.selector);
      if (!eq) {
        ShopPopup.toast('两次输入的新密码不一致');
      }
      return eq;
    }

    return {
      validate: function(){
        return doValidate(fields, rules) && isPwdEquals()
      },
      getData: function(){
        return getData(fields, rules);
      },
      clearData: function() {
        clearData(fields, rules);
      }
    };
  }();

  var changeMblValidator = function() {

    var rules = {
      password: {
        selector: '#js_chg_mbl_pwd',
        pattern: /^.{6,16}$/,
        info:'请输入登录密码',
        error:'密码由6到16位字符组成, 区分大小写'
      },
      mobileCode: {
        selector: '#bdVcode',
        pattern: /^\d{6}$/,
        info:'请输入短信验证码',
        error:'请输入正确的短信验证码'
      },
      mobile: {
        selector: '#bdPhone',
        pattern: /^1[34578]\d{9}$/,
        info:'请输入您想更换的手机号',
        error:'请输入正确的手机号'
      }
    };
    var  fields = ['password', 'mobile', 'mobileCode'];

    return {
      validate: function(){
        return doValidate(fields, rules);
      },
      getData: function(){
        return getData(fields, rules);
      },
      clearData: function() {
        clearData(fields, rules);
      }
    };
  }();

  function toggleButton($btn, toggle) {
    $btn.attr('disabled', toggle);
  }

  function init4ChgPwd(handler) {
    $('#js_chg_pwd').on('click', function(){
      window.location.hash = '#js_chg_pwd_page';
      /*handler();*/
      changePwdValidator.clearData();
    });

    /* 确认修改密码 */
    $('#js_chg_pwd_btn').on('click', function() {
      var $me = $(this);
      toggleButton($me, true);
      // 1. 检查密码是否匹配
      if (!changePwdValidator.validate()) {
        toggleButton($me, false);
        return;
      }

      // 2. 发送到后台, 成功后回到列表页面 | 重新登录
      ShopPopup.popupLoading('修改中...');
      Shop.post({
        url: '/passport/resetOldPwd',
        data: changePwdValidator.getData(),
        success: function(){
          changePwdValidator.clearData();
          ShopPopup.toastSuccess('修改成功');
          setTimeout(function(){
            window.location.hash = '';
            window.location.reload(true);
          }, 1000);

        },
        error:function(json) {
          if (json.error && json.error.code) {
            switch (json.error.code) {
              case 205:
                ShopPopup.toastSuccess('原始密码不正确');
                break;
              case 301:
                ShopPopup.toastSuccess('原始密码不能为空');
                break;
              case 304:
                ShopPopup.toastSuccess('当前用户不存在');
                break;
              default:
                ShopPopup.toastSuccess('修改失败, 原因是' + json.error.message);
            }
          } else {
            ShopPopup.toastSuccess('修改失败, 原因是' + json.error.message);
          }
        },
        complete: function() {
          ShopPopup.popupLoadingClose();
          toggleButton($me, false);
        }
      });
    });
  }

  function init4ChgMbl(handler) {

    $('#js_chg_mbl').on('click', function(){
      window.location.hash = '#js_chg_mbl_page';
      /*handler();*/
      changeMblValidator.clearData();
    });

    /* 修改手机, 步骤 */
    $('#js_chg_mbl_btn').on('click', function() {
      var $me = $(this);
      toggleButton($me, true);

      // 1. 检查密码是否匹配
      if (!changeMblValidator.validate()) {
        toggleButton($me, false);
        return;
      }

      ShopPopup.popupLoading('修改中...');
      Shop.post({
        url: '/passport/resetMobile',
        data: changeMblValidator.getData(),
        success: function(){
          changePwdValidator.clearData();
          window.location.hash = '';
          window.location.reload(true);
        },
        error: function(json) {
          ShopPopup.toastError(json.error.message);
        },
        complete: function() {
          ShopPopup.popupLoadingClose();
          toggleButton($me, false);
        }
      });
    });
  }

  function init(handler) {
    init4ChgMbl(handler);
    init4ChgPwd(handler);
  }
  return {
    init: init
  }

}(jQuery);