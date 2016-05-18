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
var ShopLoginEvent = function() {
    function bindEvents(loginFunc) {
        var $loginBox = $('#js_login_box');

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
        // 输入框输入内容时清楚提示消息
        $loginBox.on('keydown', '.js-lgipt', function() {
            $(this).closest("dd").removeClass("lgHold").removeClass("lgWarn").removeClass("lgInfo");
        });

        // 两周内自动登录
        $loginBox.on('click', '#lgRememberMe', function() {
            $(".gongg", $loginBox).toggle();
        });

        // 点击登录按钮
        $loginBox.on('click', '.lgSub', function(){
            if (typeof loginFunc == 'function') {
                loginFunc();
            }
        });

        // 监听回车
        $loginBox.on('keyup', '.lgPassw,.lgSub,#lgName', function(event) {
            var keycode = event.which;
            // press enter on user_name or password or login button ?
            if (keycode == 13) {
                if (typeof loginFunc == 'function') {
                    loginFunc();
                }
            }
        });

    }

    return {
        bindEvents: bindEvents
    };
}();

$(function() {
    ShopLoginEvent.bindEvents(function() {
        loginSub();
    });
    // 手机号绑定
    var dH = $(document).height();
    $("#fullbg").height(dH);

});

function validateMobile(mobile) {
    return /^(1[34578])\d{9}$/.test(mobile.trim());
}

function showErrForInput(selector, errMsg) {
    var el = $(selector);
    el.data('error', errMsg);
    var $dd = el.closest("dd");
    $dd.addClass("lgHold");
    $(".lg-error", $dd).html(errMsg);
}

function showWarnForInput(selector, infoMsg) {
    var el = $(selector);
    el.data('warn', infoMsg);
    var $dd = el.closest("dd");
    $dd.addClass("lgWarn");
    $(".lg-warn", $dd).html(infoMsg);
}

function showInfoForInput(selector, infoMsg) {
    var el = $(selector);
    el.data('info', infoMsg);
    var $dd = el.closest("dd");
    $dd.addClass("lgInfo");
    $(".lg-info", $dd).html(infoMsg);
}

function clearShowMsg() {
    $("dd").removeClass("lgHold").removeClass("lgWarn").removeClass("lgInfo");
}
function clearFieldMsg($field) {

    var $dd = $field.closest("dd").removeClass("lgHold").removeClass("lgWarn").removeClass("lgInfo");
    $('.lgHold,.lgWarn,.lgInfo', $dd).hide();
}

//发送手机验证码
var countdown = false;
function sendYzm(action, token) {
    if (countdown) return; // 距离上次发送不足60秒
    var $phone = $("#bdPhone");
    var $code = $('#bdVcode');
    var mobile = $.trim($phone.val());
    if (!mobile) {
        showErrForInput("#bdPhone", '请输入手机号');
        return;
    }
    if (!validateMobile(mobile)) {
        showErrForInput("#bdPhone", '请输入正确的手机号');
        return;
    }
    disableBtnSendYzm();
    var data = {};
    if (token) data.token = token;
    $.ajax({
        method: "POST",  // GET请求会导致腾讯或者360安全管家，检查URL地址安全，从而产生重复请求
        url: "/passport/" + action + "/verifyCode/" + mobile,
        data: data,
        dataType: "json"
    }).done(function(json) {
        if (!json.success) {
            clearFieldMsg($phone);
            showWarnForInput("#bdPhone", json.error.message);
            enableBtnSendYzm();
            return;
        }
        clearFieldMsg($code);
        showInfoForInput("#bdVcode", "验证码已发送至您的手机(10分钟内有效)");
        $code.focus();
        startCountdownForYzm();
    }).fail(function() {
        enableBtnSendYzm();
        clearFieldMsg($code);
        showErrForInput("#bdVcode", "暂时无法发送验证码到您的手机，请稍后再试！");
    });
}

function startCountdownForYzm() {
    var count = 60;
    var btnSendYzm = $("#btnSendYzm");
    //countdown = true;
    btnSendYzm.css("background-color", "#ccc");

    function timerForYzm() {
        if (count === 0) {
            //countdown = false;

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
    var btnSendYzm = $("#btnSendYzm");
    btnSendYzm.css("background-color", "#ccc").text('发送中...');
}

function enableBtnSendYzm() {
    countdown = false;
    var btnSendYzm = $("#btnSendYzm");
    btnSendYzm.css("background-color", "#ff5252").text("发送验证码");
}
// 刷新captcha
function refreshCaptcha() {
    var img = $("#bdyzm").next().children(),
        src = img.attr("src");
    img.attr("src", src.replace(/\?r=\d*/, '?r=' + Date.now()));
}

//登录
function loginSub(event, success, fail) {
    var $lgName = $("#lgName"), $lgPwd = $("#lgPwd"),
        login = $.trim($lgName.val()),
        password = $lgPwd.val();
    clearShowMsg();
    if (login === "") {
        showErrForInput("#lgName", "请输入您的用户名或者手机号码");
        $lgName.focus();
        return;
    }
    if (password === "") {
        showErrForInput("#lgPwd", "请输入密码");
        $lgPwd.focus();
        return;
    }
    clearShowMsg();

    $.ajax({
        method: 'POST',
        url: '/passport/login',
        data: {
            login: login,
            password: password,
            rememberMe: $('#lgRememberMe').prop('checked') ? 'Y' : 'N'
        },
        dataType: 'json'
    }).done(function(json) {
        if (json.success) {
            var data = json.data;

            // from popup
            if (success) {
                if (data.mobileVerified === 'N') {
                    if (typeof fail == 'function') {
                        fail(data);
                    }
                    /*
                    setTimeout(function() {
                        ShopAlert.alert('登录失败', '请验证手机号码', function () {
                            setTimeout(function() {
                                window.location.href = 'passport-login.html';
                            }, 100);
                        });
                    }, 100);
                    */

                } else {
                    // 这种情况下更新页面左上角，“您好，{name}！  退出”
                    $('.topleft').html('<a href="member.html" class="red">您好，' + data.name +
                        '！</a>&nbsp;&nbsp;<a href="passport-logout.html" class="grey">退出</a>');
                    if (typeof success == 'function') {
                        success();
                    }
                }
            } else {
                if (data.mobileVerified === 'N') {
                    $("#fullbg").show();
                    $("#phoneBd").show();
                    $("#bdUserId").val(data.token);
                    $("#bdPhone").val(data.mobile || '');
                    // 老用户绑定检查手机号是否已经注册过了
                    checkMobileOnBlur();
                } else {
                    window.location.href = data.redirectUrl || "/"; // 跳转到之前的页面
                }
            }
        } else {
            showErrForInput("#lgName", json.error.message);
        }
    }).fail(function(xhr) {
        if (xhr.status == 401) {
            showErrForInput("#lgName", "用户名或者密码错误");
        } else {
            showErrForInput("#lgName", "服务器错误，请稍后再试！");
        }
    });
}

function sendYzmForBind() {
    sendYzm('bind', $("#bdUserId").val());
}

//手机号码绑定
function bindSub(success, always) {
    var bdPhone = $("#bdPhone");
    var releaseLock = function() {
        if (typeof  always == 'function') {
            always();
        }
    };

    //手机号
    clearFieldMsg(bdPhone);
    var mobile = $.trim(bdPhone.val());
    if (mobile === '') {
        showErrForInput("#bdPhone", "请输入手机号");
        releaseLock();
        return;
    }
    if (!validateMobile(mobile)) {
        showErrForInput("#bdPhone", "请输入正确的手机号");
        releaseLock();
        return;
    }
    //手机验证码
    var bdVcode = $("#bdVcode");
    clearFieldMsg(bdVcode);
    var code = $.trim(bdVcode.val());
    if (code === '') {
        showErrForInput("#bdVcode", "请输入手机验证码");
        releaseLock();
        return;
    }
    if (!/\d{6}/.test(bdVcode.val())) {
        clearFieldMsg(bdVcode);
        showErrForInput("#bdVcode", "请输入正确的手机验证码");
        bdVcode.focus();
        releaseLock();
        return;
    }

    $.ajax({
        method: "POST",
        url: "/passport/bind/mobile",
        data: {
            token: $("#bdUserId").val(),
            mobile: bdPhone.val(),
            mobileCode: bdVcode.val()
        },
        dataType: "json"
    }).done(function(json) {
        if (json.success) {
            if (typeof success === 'function') {
                success(json);
            } else {
                window.location.href = json.data.redirectUrl || "/"; // 跳转到之前的页面
            }
            return;
        }
        var err = json.error;
        switch (err.code) {
            case 203:
                clearFieldMsg(bdVcode);
                showErrForInput("#bdVcode", err.message);
                break;
            case 204:
                clearFieldMsg(bdPhone);
                showWarnForInput("#bdPhone", err.message);
                break;
            default:
                clearFieldMsg(bdPhone);
                showErrForInput("#bdPhone", err.message);
        }
    }).always(function(){
        releaseLock();
    });
}

// 注册检查手机号是否已经注册过了
function checkMobileOnBlur() {
    var $phone = $("#bdPhone");
    $phone.focus(function() {
        var $me = $(this);
        clearFieldMsg($me);
    });

    $phone.blur(function() {
        var $me = $(this);
        var selector = '#bdPhone';
        var mobile = $.trim($me.val());
        $me.val(mobile);
        clearFieldMsg($me);

        if (!$.trim(mobile)) {
            return;
        }

        if (!validateMobile(mobile)) {
            showErrForInput(selector, "请输入正确的手机号");
            return;
        }
        $.ajax({
            method: 'POST',
            url: '/passport/check/mobile',
            data: {
                mobile: mobile
            },
            dataType: 'json'
        }).done(function(json) {
            if (json.success && json.data) {
                showWarnForInput(selector, "您输入的号码已经被注册，请重新输入");
            }
        });
    });
}

// 重置密码检查手机号是否已经注册过了
function checkMobileOnBlurForResetPwd() {
    $("#bdPhone").blur(function() {
        var bdPhone = $(this);
        var mobile = bdPhone.val().trim();
        bdPhone.val(mobile);
        if (mobile === '') {
            showErrForInput("#bdPhone", "请输入手机号");
            return;
        }
        if (!validateMobile(mobile)) {
            showErrForInput("#bdPhone", "请输入正确的手机号");
            return;
        }
        $.ajax({
            method: 'POST',
            url: '/passport/check/mobile',
            data: {
                mobile: mobile
            },
            dataType: 'json'
        }).done(function(json) {
            if (!json.success || !json.data) {
                showWarnForInput("#bdPhone", "您输入的手机号尚未被注册，请重新输入");
            }
        });
    });
}
// 忘记密码
function resetPwdSub() {
    //手机号
    var bdPhone = $("#bdPhone");
    if (!validateMobile(bdPhone.val())) {
        showErrForInput("#bdPhone", "您输入的手机号有误，请重新输入");
        bdPhone.focus();
        return;
    }
    //手机验证码
    var bdVcode = $("#bdVcode");
    if (bdVcode.val().length !== 6) {
        showErrForInput("#bdVcode", "请输入手机验证码");
        bdVcode.focus();
        return;
    }
    // 密码
    var $bdPassw = $("#bdPassw"),
        $bdRepeat = $("#bdRepeat");
    var passw = $bdPassw.val(),
        repeat = $bdRepeat.val();
    if (passw.length < 6) {
        showErrForInput("#bdPassw", "您输入的密码长度不够，请重新输入");
        $bdPassw.focus();
        return;
    }
    if (repeat !== passw) {
        showErrForInput("#bdRepeat", "您输入的密码两次不一致，请重新输入");
        $bdRepeat.focus();
        return;
    }
    // 图形验证码
    var bdyzm = $("#bdyzm");
    if (bdyzm.val().length !== 4) {
        showErrForInput("#bdyzm", "请输入验证码");
        bdyzm.focus();
        return;
    }

    $.ajax({
        method: "POST",
        url: "/passport/resetPwd",
        data: {
            mobile: bdPhone.val(),
            password: passw,
            mobileCode: bdVcode.val(),
            captchaKey: $("#captchaKey").val(),
            captchaCode: bdyzm.val()
        },
        dataType: "json"
    }).done(function(json) {
        if (json.success) {
            // TODO popup info
            window.location.href = "/passport-login.html";
            return;
        }
        var err = json.error;
        switch (err.code) {
            case 304:
                showWarnForInput("#bdPhone", err.message);
                break;
            case 305:
                showErrForInput("#bdVcode", err.message);
                break;
            case 306:
                showErrForInput("#bdyzm", err.message);
                break;
            default:
                showErrForInput("#bdPhone", err.message);
        }
    });
}

//noinspection JSUnusedGlobalSymbols
var ShopLogin = function() {

    // copied from login.html with minor changes
    // 1. add x close anchor
    function getPopupTemplate() {
        var arr = [];
        arr.push(
          '<a href="javascript:void(0)" class="pop-close s-alert-close">×</a>',
          '<div id="js_login_box" class="loginBox" style="margin-top: 16px;">',
          '  <div><a href="passport-signup.html" class="red fr">快速注册</a><h3 class="f18">用户登录</h3></div>',
          '  <dl class="formDl">',
          '   <dd>',
          '     <p class="clearfix">',
          '       <span class="lgico1"></span>',
          '       <input type="text" class="js-lgipt" value="" name="login" placeholder="用户名/手机号码/邮箱" id="lgName" tabIndex="1"/>',
          '     </p>',
          '     <p class="lg-error"></p>',
          '   </dd>',
          '   <dd>',
          '      <p class="clearfix">',
          '        <span class="lgico2"></span>',
          '        <input id="showPwd" class="showPwd js-lgipt lgPassw" type="text" value="请输入密码" tabindex="2"/>',
          '        <input id="lgPwd" value="" class="pwd js-lgipt lgPassw" name="password" type="password" tabindex="2" style="display:none"/>',
          '     </p>',
          '     <p class="lg-error"></p>',
          '   </dd>',
          '  </dl>',
          '  <div class="f12 pre">',
          '    <a href="passport-forgot.html" class="grey fr">忘记密码？</a>',
          '    <label><input type="checkbox" value="" name="" id="lgRememberMe" tabindex="3"/>两周内自动登录</label>',
          '    <p class="gongg">公共场所不建议自动登录，以防账号丢失</p>',
          '  </div>',
          '  <input type="submit" value="登&nbsp;&nbsp;&nbsp;&nbsp;录" name="" class="lgSub"/>',
          '</div>'
        );
        return arr.join('');
    }

    function popupLogin(callback) {
        // check full login page or not
        var $loginBox = $('#js_login_box');
        if ($loginBox && $loginBox.length) {
            return;
        }

        // popup callback
        var func = function(event, callback) {
            // call login with given callback
            loginSub(event, function() {
                // login succeed
                // close popup first
                if ($popup) {
                    $popup.destroy();
                }
                // call callback passed in
                if (typeof callback == 'function') {
                    callback();
                }
            }, function(data) {
                // login fail, but not integrated (mobile binding)
                if (data.mobileVerified === 'N') {
                    popupBind(data, function() {
                        // call callback passed in
                        if (typeof callback == 'function') {
                            callback();
                        }
                    });
                }

                if ($popup) {
                    $popup.destroy();
                }
            });
        };

        var $popup = ShopAlert.dialog({
            html:getPopupTemplate(),
            autoClose: false,
            className: 's-alert-w-login',
            after: function($dialog) {
                // 沿用原有的登录界面事件绑定
                ShopLoginEvent.bindEvents(function(event) {
                    func(event, callback);
                });

                // 监听回车/ESC
                $dialog.on('keyup', function(event) {
                    var $me = $(this);
                    var id = $me.attr('id');
                    var keycode = event.which;
                    // press esc
                    if (keycode == 27) {
                        $popup.destroy();
                    }
                });
            }
        });
    }


    function getBindPopupTemplate() {
        var arr = [];
        arr.push(
          '<div id="js_bind_popup" class="loginBox" style="margin-top: 0;">',
          '<div>',
          '<a href="help-503.html" target="_blank" class="red fr">为什么要绑定手机？</a>',
          '<h3 class="f18">手机号码验证绑定</h3>',
          '</div>',
          '<dl class="lgDl" id="bindBox">',
          '<dd>',
          '<input type="hidden" name="userId" value="" id="bdUserId"/>',
          '<input type="text" value="" name="" id="bdPhone" class="lgipt" placeholder="请输入手机号"/>',
          '<p class="lg-error"></p>',
          '<p class="lg-warn"></p>',
          '</dd>',
          '<dd>',
          '<input type="text" value="" name="" id="bdVcode" class="lgipt wd180" placeholder="请输入短信验证码"/>',
          '<a href="javascript:void(0)" class="send" onclick="sendYzmForBind()" id="btnSendYzm">发送验证码</a>',
          '<p class="lg-error"></p>',
          '<p class="lg-info"></p>',
          '</dd>',
          '<dd style="padding-bottom:0;">',
          '<input type="submit" value="确&nbsp;&nbsp;&nbsp;&nbsp;认" name="" class="lgSub" id="js_bind_btn""/>',
          '</dd>',
          '</dl>',
          '</div>'
        );

        return arr.join('');
    }

    function bindEventForBinding($popup, callback) {
        $("#js_bind_popup #bdPhone").blur(function() {
            var bdPhone = $(this);
            var mobile = bdPhone.val().trim();
            bdPhone.val(mobile);

            clearFieldMsg(bdPhone);
            if (mobile === '') {
                showErrForInput("#bdPhone", "请输入手机号");
                return;
            }
            if (!validateMobile(mobile)) {
                showErrForInput("#bdPhone", "请输入正确的手机号");
                return;
            }
        });

        $("#js_bind_popup #bdVcode").blur(function() {
            var bdVcode = $(this);
            var code = $.trim(bdVcode.val());
            bdVcode.val(code);

            clearFieldMsg(bdVcode);
            if (code === '') {
                showErrForInput("#bdVcode", "请输入手机验证码");
                return;
            }
            if (!/\d{6}/.test(bdVcode.val())) {
                clearFieldMsg(bdVcode);
                showErrForInput("#bdVcode", "请输入正确的手机验证码");
                bdVcode.focus();
                return;
            }
        });

    }

    function popupBind(data, callback) {
        setTimeout(function() {
            var $popup = ShopAlert.dialog({
                html:getBindPopupTemplate(),
                autoClose: false,
                className: 's-alert-w-login',
                after: function($dialog) {
                    // 沿用原有的登录界面事件绑定
                    $('#bdPhone').val(data.mobile);
                    $('#bdUserId').val(data.token);

                    bindEventForBinding($popup, callback);

                    $('#js_bind_btn').on('click', function() {
                        var $me = $(this);
                        if (!ButtonLock.acquire($me, 'binding')) {
                            return false;
                        }
                        bindSub(function(){
                            callback();
                            if ($popup) {
                                $popup.destroy();
                            }
                        }, function() {
                            ButtonLock.release($me, 'binding');
                        });
                    });
                }
            });
        }, 100);
    }

    return {
        popupLogin: popupLogin
    };
}();

