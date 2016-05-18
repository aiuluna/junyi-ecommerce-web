$(function() {
  $(".eyeClose").click(function(){
    $(this).toggleClass("eyeOpen");
    var typeIpt = $(".password").attr("type");
    if (typeIpt == "text") {
      $(".password").attr("type", "password");
    } else if (typeIpt == "password") {
      $(".password").attr("type", "text");
    }
  });
});

var ButtonLock = function() {
  function acquire($ele, op) {
    if ($ele.data(op) === true) {
      return false;
    } else {
      $ele.data(op, true);
      return true;
    }
  }
  function release($ele, op) {
    $ele.data(op, false);
  }
  return {
    acquire: acquire,
    release: release
  };
}();

//登录
function loginSub(event, success, fail) {
  var $bdLogin = $("#bdLogin"),
      $bdPassw = $("#bdPassw"),
      login = $.trim($bdLogin.val()),
      password = $bdPassw.val();
  if (login === "") {
    ShopPopup.toast("请输入您的用户名或者手机号码");
    $bdLogin.focus();
    return;
  }
  if (password === "") {
    ShopPopup.toast("请输入密码");
    $bdPassw.focus();
    return;
  }

  var $me = $(this), opType = 'user_login';
  // check button clicked & waiting for response
  if (!ButtonLock.acquire($me, opType)) {
    return false;
  }

  $.ajax({
    method: 'POST',
    url: '/passport/login',
    data: {
      login: login,
      password: password,
      rememberMe: 'Y',
      openId: getQueryString('openId')
    },
    dataType: 'json'
  }).done(function(json) {
    if (json.success) {
      var data = json.data;
      if (data.mobileVerified === 'N') {
        // 老用户，需要先绑定手机号
        $("#bdUserId").val(data.token);
        $("#bdPhone").val(data.mobile || '');
        ShopPopup.alert('尊敬的用户，您需要先验证手机号');
        window.location.hash = '#bind';
      } else {
        loginSuccessRedirect(data.redirectUrl);
      }
    } else {
      ShopPopup.toast(json.error.message);
    }
  }).fail(function(xhr) {
    if (xhr.status == 401) {
      ShopPopup.toast("用户名或者密码错误");
    } else {
      ShopPopup.toast("服务器错误，请稍后再试！");
    }
  }).always(function(){
    ButtonLock.release($me, opType);
  });
}

function loginSuccessRedirect(redirectUrl) {
  if (redirectUrl && (redirectUrl.indexOf('product-') !== -1
      || redirectUrl.indexOf('cart.html') !== -1)) {
    // 1.商品详情页点击收藏会跳转到登录页面，返回之前的商品详情页
    // 2.购物车页面会要求登录，然后依然返回购物车页面
    window.location.href = redirectUrl;
  } else {
    // 其他情况下都返回个人中心
    window.location.href = 'member.html';
  }
}

function loginOnHashChanged() {
  var hash = window.location.hash;
  if (hash === '#bind') {
    $('#pageLogin').hide();
    $('#pageBind').show();
  } else {
    $('#pageLogin').show();
    $('#pageBind').hide();
  }
}

//手机号码绑定
function sendYzmForBind() {
  sendYzm('bind', 'bdPhone', 'bdVcode', $("#bdUserId").val());
}
function bindSub() {
  var bdPhone = $("#bdPhone"),
      bdVcode = $("#bdVcode");

  //手机号
  var mobile = $.trim(bdPhone.val());
  if (!mobile) {
    ShopPopup.toast('请输入手机号');
    bdPhone.focus();
    return;
  }
  if (!validateMobile(mobile)) {
    ShopPopup.toast('您输入的号码有误，请重新输入');
    bdPhone.focus();
    return;
  }
  //手机验证码
  var mobileCode = $.trim(bdVcode.val());
  if (!mobileCode) {
    ShopPopup.toast('请输入手机验证码');
    bdVcode.focus();
    return;
  }
  if (mobileCode.length !== 6) {
    ShopPopup.toast('您输入的手机验证码有误，请重新输入');
    bdVcode.focus();
    return;
  }

  var $me = $(this), opType = 'user_bind';
  if (!ButtonLock.acquire($me, opType)) {
    return false;
  }

  $.ajax({
    method: "POST",
    url: "/passport/bind/mobile",
    data: {
      token: $("#bdUserId").val(),
      mobile: mobile,
      mobileCode: mobileCode
    },
    dataType: "json"
  }).done(function(json) {
    if (json.success) {
      ShopPopup.alert('手机号绑定成功！', function() {
        loginSuccessRedirect(json.data.redirectUrl);
      });
    } else {
      ShopPopup.toast(json.error.message);
    }
  }).always(function(){
    ButtonLock.release($me, opType);
  });
}

//注册
var regAgreed = false;
function handleRegAgreementClick(cb) {
  if (cb.checked) {
    $('#btnSignup').removeClass('disabled');
    regAgreed = true;
  } else {
    $('#btnSignup').addClass('disabled');
    regAgreed = false;
  }
}
function regsiterSub() {
  if (!regAgreed) return;

  var bdPhone = $("#bdPhone"),
      bdVcode = $("#bdVcode"),
      bdPassw = $("#bdPassw");
  //手机号
  var mobile = $.trim(bdPhone.val());
  if (!mobile) {
    ShopPopup.toast('请输入手机号');
    bdPhone.focus();
    return;
  }
  if (!validateMobile(mobile)) {
    ShopPopup.toast('您输入的号码有误，请重新输入');
    bdPhone.focus();
    return;
  }
  //手机验证码
  var mobileCode = $.trim(bdVcode.val());
  if (!mobileCode) {
    ShopPopup.toast('请输入手机验证码');
    bdVcode.focus();
    return;
  }
  if (mobileCode.length !== 6) {
    ShopPopup.toast('您输入的手机验证码有误，请重新输入');
    bdVcode.focus();
    return;
  }
  //密码
  var password = $.trim(bdPassw.val());
  if (!password) {
    ShopPopup.toast('请输入密码');
    bdPassw.focus();
    return;
  }
  if (bdPassw.val().length < 6) {
    ShopPopup.toast('密码长度不能小于6位，请重新输入');
    bdPassw.focus();
    return;
  }

  var $me = $(this), opType = 'user_register';
  if (!ButtonLock.acquire($me, opType)) {
    return false;
  }

  $.ajax({
    method: "POST",
    url: "/wap/passport/register",
    data: {
      mobile: mobile,
      password: password,
      mobileCode: mobileCode
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
    } else {
      ShopPopup.toast(json.error.message);
    }
  }).always(function(){
    ButtonLock.release($me, opType);
  });
}

// 忘记密码
function resetPwdSub() {
  var bdPhone = $("#bdPhone"),
      bdVcode = $("#bdVcode"),
      bdPassw = $("#bdPassw");
  //手机号
  var mobile = $.trim(bdPhone.val());
  if (!mobile) {
    ShopPopup.toast('请输入手机号');
    bdPhone.focus();
    return;
  }
  if (!validateMobile(mobile)) {
    ShopPopup.toast('您输入的号码有误，请重新输入');
    bdPhone.focus();
    return;
  }
  //手机验证码
  var mobileCode = $.trim(bdVcode.val());
  if (!mobileCode) {
    ShopPopup.toast('请输入手机验证码');
    bdVcode.focus();
    return;
  }
  if (mobileCode.length !== 6) {
    ShopPopup.toast('您输入的手机验证码有误，请重新输入');
    bdVcode.focus();
    return;
  }
  //密码
  var password = $.trim(bdPassw.val());
  if (!password) {
    ShopPopup.toast('请输入密码');
    bdPassw.focus();
    return;
  }
  if (bdPassw.val().length < 6) {
    ShopPopup.toast('密码长度不能小于6位，请重新输入');
    bdPassw.focus();
    return;
  }

  var $me = $(this), opType = 'user_reset_pwd';
  if (!ButtonLock.acquire($me, opType)) {
    return false;
  }

  $.ajax({
    method: "POST",
    url: "/wap/passport/resetPwd",
    data: {
      mobile: mobile,
      password: password,
      mobileCode: mobileCode
    },
    dataType: "json"
  }).done(function(json) {
    if (json.success) {
      // TODO popup info
      window.location.href = "passport-login.html";
    } else {
      ShopPopup.toast(json.error.message);
    }
  }).always(function(){
    ButtonLock.release($me, opType);
  });
}

//发送手机验证码
var countdown = false;
function sendYzm(action, phoneId, codeId, token) {
  if (countdown) return; // 距离上次发送不足60秒
  var $phone = phoneId ? $('#' + phoneId) : $("#bdPhone");
  var $code = codeId ? $('#' + codeId) : $('#bdVcode');
  var mobile = $.trim($phone.val());
  if (!mobile) {
    ShopPopup.toast('请输入手机号');
    return;
  }
  if (!validateMobile(mobile)) {
    ShopPopup.toast('您输入的号码有误，请重新输入');
    return;
  }
  disableBtnSendYzm();
  var data = {};
  if (token) data.token = token;
  $.ajax({
    method: "POST", // GET请求会导致腾讯或者360安全管家，检查URL地址安全，从而产生重复请求
    url: "/passport/" + action + "/verifyCode/" + mobile,
    data: data,
    dataType: "json"
  }).done(function(json) {
    if (!json.success) {
      ShopPopup.toast(json.error.message);
      enableBtnSendYzm();
      return;
    }
    ShopPopup.toast("验证码已发送至您的手机(10分钟内有效)");
    $code.focus();
    startCountdownForYzm();
  }).fail(function() {
    enableBtnSendYzm();
    ShopPopup.toast("暂时无法发送验证码到您的手机，请稍后再试！");
  });
}

function startCountdownForYzm() {
  var count = 60;
  var btnSendYzm = $("#btnSendYzm");

  function timerForYzm() {
    if (count === 0) {
      enableBtnSendYzm();
      return;
    }
    btnSendYzm.text(count + "秒后重试");
    count--;
    setTimeout(timerForYzm, 1000);
  }
  timerForYzm();
}

function disableBtnSendYzm() {
  countdown = true;
  $("#btnSendYzm").addClass('lastM').text('发送中...');
}

function enableBtnSendYzm() {
  countdown = false;
  $("#btnSendYzm").removeClass('lastM').text("发送验证码");
}

function validateMobile(mobile) {
  return /^(1[34578])\d{9}$/.test(mobile.trim());
}

function getQueryString(name) {
  var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
  var r = window.location.search.substr(1).match(reg);
  if (r) return unescape(r[2]);
  return null;
}