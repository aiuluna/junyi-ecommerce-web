
var ShopRegisterEvent = function() {

  // 注册时检查密码输入
  function checkPasswdOnBlur() {
    var $pw1 = $("#bdPassw");
    var $pw2 = $("#bdRepeat");

    var onBlur$1 = function() {
      var passw = $pw1.val(),
        repeat = $pw2.val();
      if (passw =='') {
        clearFieldMsg($pw1);
        return;
      }
      if (passw && passw.length < 6) {
        clearFieldMsg($pw1);
        showErrForInput("#bdPassw", "请输入6到16个字符的密码");
      } else {
        clearFieldMsg($pw1);
      }
      if (repeat && repeat !== passw) {
        clearFieldMsg($pw2);
        showErrForInput("#bdRepeat", "两次输入的密码不一致");
      } else {
        clearFieldMsg($pw2);
      }
    };
    var onKeyup$1 = function(){
      var passw = $pw1.val(),
        repeat = $pw2.val();
      if (repeat && repeat !== passw) {
        clearFieldMsg($pw2);
        showErrForInput("#bdRepeat", "两次输入的密码不一致");
      } else {
        clearFieldMsg($pw2);
      }
    };
    var onFocus$1 = function(){
      var $me = $(this);
      clearFieldMsg($me);
    };

    $pw1.blur(onBlur$1).keyup(onKeyup$1).focus(onFocus$1);

    var onBlur$2 = function() {
      var passw = $pw1.val(),
        repeat = $pw2.val();
      if (repeat !== passw) {
        clearFieldMsg($pw2);
        showErrForInput("#bdRepeat", "两次输入的密码不一致");
      } else {
        clearFieldMsg($pw2);
      }

    };
    var onFocus$2 = function(){
      var $me = $(this);
      clearFieldMsg($me);
      // showInfoForInput("#bdRepeat", "再次输入您的密码");
    };

    $pw2.blur(onBlur$2).focus(onFocus$2);
  }

  function checkMobileCode() {
    var selector = '#bdVcode';
    var $code = $(selector);
    var onFocus = function() {
      clearFieldMsg($code);
      if ($code.data('info')) {
        showInfoForInput(selector, $code.data('info'));
      }
    };

    var onBlur = function() {
      var code = $code.val();
      if (code === '') {
        clearFieldMsg($code);
        if ($code.data('info')) {
          showInfoForInput(selector, $code.data('info'));
        }
        return;
      }
      if (!/\d{6}/.test(code)) {
        clearFieldMsg($code);
        showErrForInput(selector, '请输入正确的短信验证码');
      } else {
        if ($code.data('info')) {
          clearFieldMsg($code);
          showInfoForInput(selector, $code.data('info'));
        }
      }
    };

    $code.focus(onFocus).blur(onBlur);

    var $code2 = $('#bdyzm');
    $code2.focus(function(){
      clearFieldMsg($code2);
    }).blur(function(){
      if ($code2.val() === '') {
        clearFieldMsg($code);
        return false;
      }
      if (!/^[A-Za-z0-9]{4}$/.test($code2.val())) {
        showErrForInput('#bdyzm', '请输入正确的验证码');
        return false;
      }
    });
  }

  function bindEvents() {
    var $loginBox = $('#js_register_box');

    // 密码控件提示
    $loginBox.on('focus', '.showPwd', function() {
      $(this).siblings(".pwd").show().focus();
      $(this).hide();
    });
    $loginBox.on('blur', '.pwd', function() {
      if ($(this).val() === "") {
        $(this).siblings(".showPwd").show();
        $(this).hide();
      }
    });

    $('#js_register_btn').click(function(){
      var $me = $(this);
      if (!$me.prop('disabled')) {
        regsiterSub();
      }
    });
    $('#js_register_agree').change(function(){
      var $me = $(this);
      if ($me.prop('checked')) {
        $('#js_register_btn').css('backgroundColor','#ff5252').css('border', '1px solid #ff5252').attr('disabled',false);
      } else {
        $('#js_register_btn').css('backgroundColor','#ccc').css('border', '1px solid #ccc').attr('disabled',true);
      }
    });

    checkMobileOnBlur();
    checkPasswdOnBlur();
    checkMobileCode();
  }

  function validateRegisterUtil() {
    var rules = [
      {
        selector:'#bdPhone',
        pattern: /^(1[34578])\d{9}$/,
        info: '请输入手机号',
        require: '请输入手机号',
        error: '请输入正确的手机号',
        errorCode: 107
      },
      {
        selector:'#bdVcode',
        pattern: /^\d{6}$/,
        info:'请输入短信验证码',
        require: '请输入短信验证码',
        error:'请输入正确的短信验证码',
        errCode : 105
      },
      {
        selector:'#bdPassw',
        pattern:/^.{6,16}$/,
        info:'6到16位字符, 区分大小写',
        require: '请输入您的密码',
        error:'请输入您的密码'
      },
      {
        selector:'#bdRepeat',
        pattern:/^.{6,16}$/,
        info:'再次输入您的密码',
        require: '请再次输入您的密码',
        error:'两次输入的密码不一致'
      },
      {
        selector:'#bdyzm',
        pattern:/^[A-Za-z0-9]{4}$/,
        info:'请输入验证码',
        require: '请输入验证码',
        error:'请输入正确的验证码',
        errCode : 106
      }
    ];

    function doValidate() {
      "use strict";
      var valid = true;
      $.each(rules, function(i, v){
        var $field = $(v.selector);
        var val = $field.val();
        if (val === '') {
          clearFieldMsg($field);
          showErrForInput(v.selector, v.require);
          valid = false && valid;
        } else {
          if (!v.pattern.test(val)) {
            clearFieldMsg($field);
            showErrForInput(v.selector, v.error);
            valid = false && valid;
          }
        }

      });
      return valid;
    }

    return {
      doValidate: doValidate
    };

  }

  //注册
  function regsiterSub() {

    var util = validateRegisterUtil();
    if (!util.doValidate()) {
      return false;
    }
    clearShowMsg();

    $.ajax({
      method: "POST",
      url: "/passport/register",
      data: {
        mobile: $('#bdPhone').val(),
        password: $('#bdPassw').val(),
        mobileCode: $('#bdVcode').val(),
        captchaKey: $("#captchaKey").val(),
        captchaCode: $('#bdyzm').val()
      },
      dataType: "json"
    }).done(function(json) {
      if (json.success) {
        if (json.data.loggedIn) {
          // 如果注册并登录成功，跳转到个人中心页面
          window.location.href = "member.html?from=register";
        } else {
          window.location.href = "passport-login.html";
        }
        return;
      }
      var err = json.error;
      switch (err.code) {
        case 105:
          clearFieldMsg($("#bdVcode"));
          showErrForInput("#bdVcode", err.message);
          break;
        case 106:
          clearFieldMsg($("#bdyzm"));
          showErrForInput("#bdyzm", err.message);
          break;
        case 107:
          clearFieldMsg($("#bdPhone"));
          showWarnForInput("#bdPhone", err.message);
          break;
        default:
          clearFieldMsg($("#bdPhone"));
          showErrForInput("#bdPhone", err.message);
      }
    });
  }

  return {
    bindEvents: bindEvents,
    checkPasswdOnBlur: checkPasswdOnBlur
  };
}();