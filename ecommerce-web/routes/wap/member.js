var express = require('express'),
    auth = require('../../auth'),
    logger = require('../../logger'),
    common_util = require('../../util/common_util'),
    http_util = require('../../util/http_util'),
    image_util = require('../../util/image_util'),
    order_util = require('../../util/order_util'),
    needle = require('needle'),
    multiparty = require('multiparty'),
    common_data = require('../../common_data'),
    extend = require('extend'),
    moment = require('moment'),
    Q = require('q');

var router = express.Router();

// ------------------------------------------------------------------------
// pages - common
// ------------------------------------------------------------------------

router.get('/',
  auth.requireAuth(),
  // 这里不能直接从cookie中获取用户信息, 除非每次更新都会更新session中内容
  function(req, res, next) {
    var userId = req.user.id;
    var reqs = [], spreadOpts = [];
    // 1 用户信息 -> user
    reqs.push(doHttpMethod('GET', '/user/view/' + userId, {}));
    spreadOpts.push({name: 'user'});
    // 2.收藏商品数量 -> favorite
    reqs.push(doHttpMethod('GET', '/user/favorite/list/count/' + userId, {}));
    spreadOpts.push({name: 'favorite', ignoreError: true});
    // 3.我的佣金 -> commission
    if (req.user.type === 'PROMOTER' || req.user.type === 'DISTRIBUTOR') {
      var prefix = req.user.type === 'PROMOTER' ? '/promoter' : '/distributor';
      reqs.push(doHttpMethod('GET', prefix + '/commission/my/' + userId, {}));
      spreadOpts.push({name: 'commission', ignoreError: true});
    }
    // 4.新人注册礼包 -> regCouponCount
    if (req.query.from === 'register') {
      reqs.push(
        doHttpMethod('GET', '/user/coupon/count', {
          userId: userId,
          status: 'NOT_USED',
          obtainMethod: 'REGISTER'
        })
      );
      spreadOpts.push({name: 'regCouponCount', ignoreError: true});
    }

    function handler(result) {
      common_util.renderMobile(req, res, 'member/index', {
        title: '会员中心',
        user: result.user,
        favorite: result.favorite,
        commission: result.commission,
        regCouponCount: result.regCouponCount || 0,
        _footerNav: 'member'
      });
    }
    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(handler, http_util.errorHandler(req, res, next));
  }
);

function doHttpMethod(method, url, params) {
  var deferred = Q.defer();
  // 用户已经登录
  http_util.request('facade', {
    method: method,
    data: params,
    url: url
  }).done(
    function(result) {
      if (result.success) {
        deferred.resolve(result.data);
      } else {
        deferred.reject(result.error.message);
      }
    },
    function(err) {
      deferred.reject(err);
    }
  );
  return deferred.promise;
}
router.get('/dist/index',
  auth.requireAuth(),
  function(req, res, next) {

    var reqs = [], spreadOpts = [];
    // 1 用户信息 -> user
    reqs.push(doHttpMethod('GET', '/user/view/' + req.user.id, {}));
    spreadOpts.push({ name: 'user', ignoreError: true });
    // 2.我的佣金 -> commission
    reqs.push(doHttpMethod('GET', '/distributor/commission/my/' + req.user.id, {}));
    spreadOpts.push({
      name: 'commission',
      ignoreError: true
    });

    var handler = function(result) {
        common_util.renderMobile(req, res, 'member/dist/index', {
          title: '会员中心',
          user: result.user,
          commission: result.commission,
          _footerNav: 'member'
        });
    };
    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done( handler, http_util.errorHandler(req, res, next) );
  }
);

router.get('/promoter/index',
  auth.requireAuth(),
  function(req, res, next) {

    var reqs = [], spreadOpts = [];
    // 1 用户信息 -> user
    reqs.push(doHttpMethod('GET', '/user/view/' + req.user.id, {}));
    spreadOpts.push({ name: 'user', ignoreError: true });
    // 2.我的佣金 -> commission
    reqs.push(doHttpMethod('GET', '/promoter/commission/my/' + req.user.id, {}));
    spreadOpts.push({ name: 'commission', ignoreError: true });

    var handler = function(result) {
      common_util.renderMobile(req, res, 'member/promoter/index', {
        title: '会员中心',
        user: result.user,
        commission: result.commission,
        _footerNav: 'member'
      });
    };
    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done( handler, http_util.errorHandler(req, res, next) );
  }
);

router.get('/about',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderMobile(req, res, 'member/about_us', {
      title: '关于我们',
      _footerNav: 'member'
    });
  }
);

router.get('/info',
  auth.requireAuth(),
  // 这里不能直接从cookie中获取用户信息, 除非每次更新都会更新session中内容
  function(req, res, next) {
    http_util.request('facade', {
      method: 'GET',
      url: '/user/view/' + req.user.id
    }).done(
      http_util.resultMessageHandler(function(user) {
        common_util.renderMobile(req, res, 'member/info', {
          title: '个人信息-会员中心',
          _footerNav: 'member',
          user: user
        });
      }, req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/setting',
  auth.requireAuth(),
  // 这里不能直接从cookie中获取用户信息, 除非每次更新都会更新session中内容
  function(req, res, next) {
    common_util.renderMobile(req, res, 'member/setting', {
      title: '设置-会员中心',
      _bodyClass: 'bg_white',
      _footerNav: 'member',
      user: req.user,
      order_util: order_util
    });
  }
);

/**
 * pages for orders
 */
router.get('/orders/list',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderMobile(req, res, 'member/orders', {
      title: (req.query.status == 'CANCELLED' ? '已关闭订单' : '我的订单'),
      _footerNav: 'member',
      status: req.query.status
    });
  }
);

router.get('/orders/view/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {

    var handler = function(data) {
      common_util.renderMobile(req, res, 'member/order_view', {
        title: '订单详情-我的订单',
        _footerNav: 'member',
        order: data,
        _expireInfo: order_util.getOrderExpireInfo(data),
        order_util: order_util,
        user: req.user
      });
    };

    http_util.request('facade', {
      method: 'GET',
      url: '/order/view/' + req.params.orderNo,
      data: { userId: req.user.id }
    }).done(
      http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

// 佣金订单详情(推广员/代理商专用)
router.get('/order/detail/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {
      userId: req.user.id
    };
    var handler = function(json) {
      common_util.renderMobile(req, res, 'member/order_detail', {
        title: '订单详情',
        _footerNav: 'member',
        order: json,
        order_util: order_util,
        commissionType: req.query.commissionType,
        user: req.user
      });
    };
    http_util.request('facade', {
      method: 'get',
      url: '/order/view/' + req.params.orderNo,
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

// 我的订单-售后跟踪
router.get('/order/service/view/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    var data = {userId: req.user.id};
    var handler = function(json) {
      common_util.renderMobile(req, res, 'member/order_service_view', {
        service: json,
        order_util: order_util,
        title: '申请售后',
        _footerNav: 'member'
      });
    };
    http_util.request('facade', {
      method: 'get',
      url: '/order/service/sale/' + req.params.orderNo,
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

// 我的订单-申请售后
router.get('/order/service/apply/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {
    var data = {userId: req.user.id};
    var handler = function(json) {
      /* had service already */
      if (!json.id) {
        common_util.renderMobile(req, res, 'member/order_service_apply', {
          service: json,
          order_util: order_util,
          title: '申请售后',
          _footerNav: 'member'
        });
      } else {
        res.redirect('member-order-service-view-' + req.params.orderNo + '.html');
      }
    };
    http_util.request('facade', {
      method: 'get',
      url: '/order/service/sale/' + req.params.orderNo,
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

router.get('/collect',
    auth.requireAuth(),
    function (req, res, next) {
      common_util.renderMobile(req, res, 'member/collect', {
        _footerNav: 'member',
        title: '我的收藏商品'
      });
    }
);

router.get('/address',
  auth.requireAuth(),
  function(req, res, next) {

    var handler = function(addresses) {
      common_util.renderMobile(req, res,'member/address', {
        _footerNav: 'member',
        title: ('我的收货地址'),
        addresses: addresses,
        order_util: order_util
      });
    };

    http_util.request('facade', {
        method: 'GET',
        url: '/user/address/list/' + req.user.id
    }).done(
        http_util.resultMessageHandler(handler, req, res, next),
        http_util.errorHandler(req, res, next)
    );
  }
);



router.get('/safe',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderMobile(req, res, 'member/safe', {
      title: ('安全中心'),
      _footerNav: 'member',
      order_util:order_util
    });
  }
);

router.get('/promote',
  auth.requireAuth(),
  function(req, res, next) {
    var user = req.user;
    if (user.type === 'MEMBER') {
      res.redirect('member.html');
      return;
    }
    http_util.request('facade', {
      method: 'GET',
      url: '/promoter/link/' + req.user.id
    })
    .done(
      http_util.resultMessageHandler(function(result) {
        common_util.renderMobile(req, res, 'member/promote', {
          title: ('推广有礼'),
          _footerNav: 'member',
          member: result
        });
      },req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);
router.get('/promoter/apply',
  auth.requireAuth(),
  function(req, res, next) {
    var user = req.user;
    /* 已经不是普通会员啦 */
    if (user.type !== 'MEMBER') {
      res.redirect('/member-promote.html');
      return;
    }

    var handler = function(data) {
      /**
       * 当前用户已经不是普通会员, 应该提示用户重新登录
       */
      common_util.renderMobile(req, res, 'member/promoter_apply', {
        title: ('推广有礼'),
        _footerNav: 'member',
        requestVO: data
      });
    };

    http_util.request('facade', {
      method: 'GET',
      url: '/promoter/apply/view/' + req.user.id
    }).done(
      http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/promoter/agreement',
  function(req, res, next) {
    common_util.renderMobile(req, res, 'member/promoter_protocol',{
      title: '推广员协议',
      _footerNav: 'member'
    });
  }
);

// ------------------------------------------------------------------------
// pages - 推广员
// ------------------------------------------------------------------------

router.get('/promoter/members',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var user = req.user;
    common_util.renderMobile(req, res, 'member/promoter/member_list', {
      title: ('下级会员'),
      _footerNav: 'member'
    });
  }
);

router.get('/promoter/member_orders',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'PROMOTER') {
      res.redirect('member.html');
      return;
    }
    common_util.renderMobile(req, res, 'member/promoter/member_orders', {
      title: ('会员订单'),
      _footerNav: 'member',
      memberId: req.query.memberId
    });
  }
);

//推广员-结算账户
router.get('/promoter/account',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function (req, res, next) {
    common_util.renderMobile(req, res, 'member/promoter/account/index', {
      title: ('结算账户'),
      _footerNav: 'member'
    });
  }
);

//推广员-我的佣金
router.get('/promoter/commission',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {

      common_util.renderMobile(req, res, 'member/promoter/commission_index', {
        title: ('我的佣金'),
        _footerNav: 'member'
      });
  }
);
//推广员-佣金纪录
router.get('/promoter/commission/list',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {

    common_util.renderMobile(req, res, 'member/promoter/commission_list', {
      title: ('佣金纪录'),
      _footerNav: 'member'
    });
  }
);

//推广员-佣金提取
router.get('/promoter/commission/draw/apply',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {

    var reqs = [], spreadOpts = [];
    // 1 用户信息 -> user
    reqs.push(doHttpMethod('GET', '/promoter/bank/account/' + req.user.id, {}));
    spreadOpts.push({ name: 'account', ignoreError: true });

    // 2.我的佣金 -> commission
    reqs.push(doHttpMethod('GET', '/promoter/commission/my/' + req.user.id, {}));
    spreadOpts.push({
      name: 'commission',
      ignoreError: true
    });

    var handler = function(result) {

      common_util.renderMobile(req, res, 'member/promoter/commission_draw_apply', {
        title: ('佣金提取'),
        _footerNav: 'member',
        commission: result.commission,
        account: result.account
      });
    };
    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done( handler, http_util.errorHandler(req, res, next) );
  }
);

//推广员-佣金提取纪录
router.get('/promoter/commission/draw/list',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {

    common_util.renderMobile(req, res, 'member/promoter/commission_draw_list', {
      title: ('佣金提取纪录'),
      _footerNav: 'member'
    });
  }
);

//推广员-佣金纪录
router.get('/promoter/commission/draw/view',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {

    common_util.renderMobile(req, res, 'member/promoter/commission_draw_view', {
      title: ('佣金提取纪录-详情'),
      _footerNav: 'member'
    });
  }
);

// ------------------------------------------------------------------------
// pages - 代理商
// ------------------------------------------------------------------------

router.get('/dist/promoter_audit',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    common_util.renderMobile(req, res, 'member/dist/promoter_apply_list', {
      title: '推广员审核',
      _footerNav: 'member'
    });
  }
);

router.get('/dist/promoter_audit/view/:requestId',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    var handler = function(request) {
      var forAudit = req.query.action == 'audit';
      var pageTemplate = forAudit? 'member/dist/promoter_apply_audit': 'member/dist/promoter_apply_view';
      common_util.renderMobile(req, res, pageTemplate, {
        title: ('推广员审核'),
        _footerNav: 'member',
        request: request,
        order_util: order_util
      });
    };

    http_util.request('facade', {
      method: 'GET',
      url:'/distributor/approve/promoter/'+req.params.requestId+'/'+req.user.id,
      data: {userId: req.user.id}
    }).done(
      http_util.resultMessageHandler(handler,req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/dist/promoter',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    common_util.renderMobile(req, res, 'member/dist/promoter_list', {
      title: ('下级推广员'),
      _footerNav: 'member'
    });
  }
);

router.get('/dist/promoter/:promoterId',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    var handler = function(result) {
      common_util.renderMobile(req, res, 'member/dist/promoter_view', {
        title: '下级推广员',
        _footerNav: 'member',
        promoter: result
      });
    };
    http_util.request('facade', {
      method: 'POST',
      url: '/distributor/promoter/view/'+req.params.promoterId,
      data: {userId: req.user.id}
    }).done(
      http_util.resultMessageHandler(handler,req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/dist/members',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    var data = {
      login: req.body.login,
      name: req.body.name,
      mobile: req.body.mobile,
      promoterName: req.body.promoterName,
      pageNumber: req.body.pageNumber||1,
      pageSize: req.body.pageSize||20,
      userId: req.user.id
    };
    common_util.renderMobile(req, res, 'member/dist/member_list', {
      title: ('下级会员'),
      _footerNav: 'member'
    });
  }
);

router.get('/dist/member_orders',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    common_util.renderMobile(req, res, 'member/dist/member_orders', {
      title: ('会员订单'),
      _footerNav: 'member',
      memberId: req.query.memberId
    });
  }
);

//查询分销商-结算账户
router.get('/dist/account',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    http_util.request('facade', {
      method: 'GET',
      url: '/distributor/bank/account/' + req.user.id
    }).done(
        http_util.resultMessageHandler(function(acct) {
          common_util.renderMobile(req, res, 'member/dist/account', {
            title: ('结算账户'),
            _footerNav: 'member',
            account: acct
          });
        },req, res, next),
        http_util.errorHandlerJSON(req, res, next)
    );
  }
);

//推广员未审核记录条数和未审核佣金条数
router.post('/approve/count',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function (req, res, next) {
    var data = {
      userId: req.user? req.user.id : "",
    };

    http_util.pipe('facade', {
      method: 'POST',
      url: '/distributor/approve/count',
      data: data
    }, res);
  }
);

//分销商-我的佣金
router.get('/dist/commission',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {

    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    common_util.renderMobile(req, res, 'member/dist/commission_index', {
      title: ('我的佣金'),
      _footerNav: 'member'
    });
  }
);

//分销商-我的佣金-推广佣金
router.get('/dist/commission/direct',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {

    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    common_util.renderMobile(req, res, 'member/dist/commission_direct_list', {
      title: ('我的佣金-推广佣金'),
      _footerNav: 'member'
    });
  }
);

//分销商-我的佣金-非推广佣金
router.get('/dist/commission/indirect',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {

    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    common_util.renderMobile(req, res, 'member/dist/commission_indirect_list', {
      title: ('我的佣金-非推广佣金'),
      _footerNav: 'member'
    });
  }
);


//分销商-我的佣金-佣金结算记录
router.get('/dist/commission/settle',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {

    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }

    common_util.renderMobile(req, res, 'member/dist/commission_settle_list', {
      title: ('我的佣金-佣金结算记录'),
      _footerNav: 'member'
    });
  }
);

// ------------------------------------------------------------------------
// APIs
// ------------------------------------------------------------------------

// 个人信息更新

function updateUserInfo(user, success, error) {
  // 发送更新请求到后台 (avatar url 更新和手机更新暂未包含)
  http_util.request('facade', {
    method: 'POST',
    url: '/user/update/info',
    data: user
  }).done(success, error);
}

// 查看订单-物流信息 HTML
router.get('/order/express/view/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {

    var handler = function(list) {
      common_util.renderMobile(req, res, 'member/order_express_view', {
        list: list,
        _footerNav: 'member',
        title:'我的订单-物流信息'
      });
    };

    var data = {
      userId: req.user.id
    };
    http_util.request('facade', {
      method: 'GET',
      url: '/order/express/view/' + req.params.orderNo,
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);


// 分销商-佣金结算详情-HTML
router.get('/dist/commission/settle/detail/:settlementId',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var handler = function(json) {
      common_util.renderMobile(req, res, 'member/dist/commission_settle_view', {
        title: '佣金结算详情',
        _footerNav: 'member',
        record: json,
        order_util:order_util
      });
    };
    http_util.request('facade', {
      method: 'post',
      url: '/distributor/commission/settlement/' + req.user.id + '/' + req.params.settlementId
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

//推广员-佣金提取详情-HTML
router.get('/promoter/commission/draw/detail/:requestId',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var handler = function(json) {
      common_util.renderMobile(req, res, 'member/promoter/commission_draw_detail', {
        record: json,
        order_util: order_util,
        title: '佣金提取详情',
        _footerNav: 'member'
      });
    };
    http_util.request('facade', {
      method: 'post',
      url: '/promoter/commission/draw/request',
      data: {
        userId: req.user.id,
        drawRequestId: req.params.requestId
      }
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

function toPageJson(data) {
  return {success: true, data: data};

}

/**
 * 获取收藏商品列表
 */
router.post('/collect',
  auth.requireAuth(),
  function (req, res, next) {
    var pageNum = req.query.pageNumber;
    pageNum = (pageNum && pageNum > 0) ? pageNum : 1;
    http_util.request('facade', {
      method: 'GET',
      url: '/user/favorite/list/' + req.user.id,
      data: {
        pageNumber: pageNum,
        pageSize: 20
      }
    }).done(
      http_util.resultMessageHandler(function (json) {

          var sendData = function(json, prodSum) {

            json.pageData = prodSum;
            res.json(toPageJson(json));
          };
          var loadData = function(json) {
            http_util.request('queen', {
              method: 'GET',
              url: '/product/summary/list/' + json.pageData.join(',')
            }).done(http_util.resultMessageHandler(function (productSumList) {
              var prodSum = [];
              productSumList.forEach(function (item) {
                var prod = {};
                prod.skuId = item.skuId;
                prod.productName = item.skuName;
                prod.marketPrice = item.marketPrice;
                prod.salePrice = item.promotionPrice || item.salePrice;
                if (item.imageUrl) {
                  prod.imageUrl = image_util.getImageUrl(item.imageUrl);
                }
                prod.saleStatus = item.saleStatus;
                prod.stockStatus = item.stockStatus;
                prod.activityLabel = item.activityLabel;
                prod.activityType = item.activityType;
                prod.activityName = item.activityName;
                prod.activityTypeName = item.activityTypeName;
                prod.tag = item.tag;
                if (item.activityType)
                  prod.isPromotion = true;
                else
                  prod.isPromotion = false;

                prodSum.push(prod);
              });

              sendData(json, prodSum);
            }, req, res, next));
          };

          if (json.totalCount == 0) {
            sendData(json, []);
          } else {
            loadData(json);
          }

        }, req, res, next,
        http_util.errorHandler(req, res, next))
    );
  }
);

// 分销商-佣金审核-列表
router.get('/dist/commission_audit',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    common_util.renderMobile(req, res, 'member/dist/commission_draw_list', {
      title: '佣金提取审核',
      user: user,
      _footerNav: 'member'
    });
  }
);

router.get('/dist/commission_audit/view/:requestId',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var forAudit = req.query.action && req.query.action == 'audit';
    var handler = function(json) {
      var tplName = forAudit ? 'member/dist/commission_draw_audit' : 'member/dist/commission_draw_view';
      common_util.renderMobile(req, res, tplName, {
        title: "佣金提取审核",
        record: json,
        user: req.user,
        order_util: order_util
      });
    };
    var data = {};
    http_util.request('facade', {
      method: 'get',
      url: '/distributor/approve/draw/' + req.params.requestId + '/' + req.user.id,
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

//推广员-佣金提取-查询结算账户
router.get('/promoter/bank/account',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {

    var isAlipay = (req.query.type && 'alipay'.toUpperCase() == req.query.type.toUpperCase());
    var viewName = isAlipay ? 'member/promoter/account/alipay' : 'member/promoter/account/bank';
    var title = '结算账户-' + (isAlipay ? '支付宝账户' : '银行账户');
    var handler = function(json) {
      common_util.renderMobile(req, res, viewName, {
        title: title,
        account: json
      });
    };
    http_util.request('facade', {
      method: 'GET',
      url: '/promoter/bank/account/' + req.user.id
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

router.get('/express/company/list',
  auth.requireAuthAjax(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'GET',
      url: '/express/company/list'
    }, res);
  }
);


/**
 * 获取订单列表信息, wap有使用, 请勿删除
 */
// 我的订单-列表
router.post('/orders/list',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = req.body;
    data.userId = req.user.id;
    if (data.status == 'ALL') {
      delete data.status;
    }
    if (data.timeRange < 0) {
      data.timeRange = 0;
    }

    var handler = function(page) {
      page.pageData && page.pageData.forEach(function( order ){
        var itemCount = 0;
        if ( order.items ) {
          order.items.forEach(function( item ){
            itemCount += item.quantity || 0;
            var imageUrl = item.skuImageUrl;
            if (imageUrl) {
              item.skuImageUrl = image_util.getImageUrl(item.skuImageUrl, 90, 90);
            }
          });
        }
        order.itemCount = itemCount;

        // expireInfo
        order._expireInfo = order_util.getOrderExpireInfo(order);
      });
      res.json(toPageJson(page));
    };
    http_util.request('facade', {
      method: 'post',
      data: data,
      url: '/order/my'
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

/**
 * 获取用户收货地址列表
 */
router.post('/user/address/list',
  auth.requireAuth(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'GET',
      url: '/user/address/list/' + req.user.id
    }, res)
  }
);


//分销商银行账户更新
router.post('/distributor/account/update',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    var data = req.body;
    data.userId = req.user.id;

    http_util.pipe('facade', {
      method: 'POST',
      url: '/distributor/bank/account/update',
      data: data
    },res);
  }
);

//会员中心-结算账户
router.post('/promoter/bank/account',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function (req, res, next) {
    req.body.userId = req.user.id;
    http_util.pipe('facade', {
      method: 'POST',
      url: '/promoter/bank/account',
      data: req.body
    }, res);
  }
);

//会员中心-我的优惠券
router.get('/coupon/my',
  auth.requireAuth(),
  function (req, res, next) {
    common_util.renderMobile(req, res, 'member/my_coupon', {
      title: '会员中心-我的优惠券'
    });
  }
);

//会员中心-领券中心
router.get('/coupon/center',
  auth.requireAuth(),
  function (req, res, next) {
    common_util.renderMobile(req, res, 'member/coupon_center', {
      title: '会员中心-领取优惠券'
    });
  }
);

module.exports = router;
