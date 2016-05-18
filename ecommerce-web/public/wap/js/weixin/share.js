function wxShareInit(config) {
  getJsApiTicket(function(ticket) {
    if (!ticket) return;
    _doWxShareInit(config || {}, ticket);
  });
}

function getJsApiTicket(callback) {
  $.ajax({
    method: 'GET',
    url: '/wap/weixin/getJsApiTicket',
    dataType: 'json'
  }).done(function(json) {
    if (json.success) {
      callback(json.data);
    } else if (console && console.log) {
      console.log('Error getJsApiTicket: ' + json.error.message);
    }
  });
}

function _doWxShareInit(config, ticket) {
  var title = config.title || document.title,
      link = config.link,
      imgUrl = config.imgUrl || 'http://img1.mayihg.com/logo-share.png?imageView2/2/w/300',
      desc = config.desc || '我在蚂蚁海购长草了，赶快来看看吧！';
  if (!link) {
    link = window.location.href;
    var hashIdx = link.indexOf('#');
    if (hashIdx > 0) link = link.substr(0, hashIdx);
  }

  var ret = sign(ticket.jsApiTicket, link);
  wx.config({
    debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
    appId: ticket.appId, // 必填，公众号的唯一标识
    timestamp: ret.timestamp, // 必填，生成签名的时间戳
    nonceStr: ret.nonceStr, // 必填，生成签名的随机串
    signature: ret.signature, // 必填，签名
    jsApiList: [
      'onMenuShareTimeline',
      'onMenuShareAppMessage',
      'onMenuShareQQ'
    ]
  });
  //通过ready接口处理成功验证
  wx.ready(function() {
    // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后
    wx.checkJsApi({
      jsApiList: [
        'onMenuShareTimeline',
        'onMenuShareAppMessage',
        'onMenuShareQQ'
      ],
      success: function(res) {
        // 以键值对的形式返回，可用的api值true，不可用为false
        // 如：{"checkResult":{"chooseImage":true},"errMsg":"checkJsApi:ok"}
      }
    });
    //获取“分享到朋友圈”按钮点击状态及自定义分享内容接口
    wx.onMenuShareTimeline({
      title: title, // 分享标题
      link: link, // 分享链接
      imgUrl: imgUrl, // 分享图标
      success: function() {
        // 用户确认分享后执行的回调函数
      },
      cancel: function() {
        // 用户取消分享后执行的回调函数
      }
    });

    //获取“分享给朋友”按钮点击状态及自定义分享内容接口
    wx.onMenuShareAppMessage({
      title: title, // 分享标题
      desc: desc, // 分享描述
      link: link, // 分享链接
      imgUrl: imgUrl, // 分享图标
      type: 'link', // 分享类型,music、video或link，不填默认为link
      dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
      success: function() {
        // 用户确认分享后执行的回调函数
      },
      cancel: function() {
        // 用户取消分享后执行的回调函数
      }
    });

    //获取“分享到QQ”按钮点击状态及自定义分享内容接口
    wx.onMenuShareQQ({
      title: title, // 分享标题
      desc: desc, // 分享描述
      link: link, // 分享链接
      imgUrl: imgUrl, // 分享图标
      success: function() {
        // 用户确认分享后执行的回调函数
      },
      cancel: function() {
        // 用户取消分享后执行的回调函数
      }
    });
  });
}

/**
 * @synopsis 签名算法 
 *
 * @param jsapi_ticket 用于签名的 jsapi_ticket
 * @param url 用于签名的 url ，注意必须与调用 JSAPI 时的页面 URL 完全一致
 *
 * @returns
 */
var sign = function(jsapi_ticket, url) {
  var ret = {
    jsapi_ticket: jsapi_ticket,
    nonceStr: createNonceStr(),
    timestamp: createTimestamp(),
    url: url
  };
  var string = raw(ret);
  shaObj = new jsSHA(string, 'TEXT');
  ret.signature = shaObj.getHash('SHA-1', 'HEX');
  return ret;
};

var createNonceStr = function() {
  return Math.random().toString(36).substr(2, 15);
};

var createTimestamp = function() {
  return Math.round(Date.now() / 1000) + '';
};

var raw = function(args) {
  var keys = Object.keys(args);
  keys = keys.sort();
  var newArgs = {};
  keys.forEach(function(key) {
    newArgs[key.toLowerCase()] = args[key];
  });

  var string = '';
  for (var k in newArgs) {
    string += '&' + k + '=' + newArgs[k];
  }
  string = string.substr(1);
  return string;
};
