var express = require('express'),
    auth = require('../auth'),
    logger = require('../logger'),
    common_util = require('../util/common_util'),
    http_util = require('../util/http_util'),
    image_util = require('../util/image_util'),
    order_util = require('../util/order_util'),
    needle = require('needle'),
    multiparty = require('multiparty'),
    common_data = require('../common_data'),
    extend = require('extend'),
    moment = require('moment');

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
    reqs.push(http_util.request('facade', {
      method: 'GET',
      url: '/user/view/' + userId
    }));
    spreadOpts.push({name: 'user'});
    // 2.新人注册礼包 -> regCouponCount
    if (req.query.from === 'register') {
      reqs.push(
        http_util.request('facade', {
          method: 'GET',
          url: '/user/coupon/count',
          data: {
            userId: userId,
            status: 'NOT_USED',
            obtainMethod: 'REGISTER'
          }
        })
      );
      spreadOpts.push({name: 'regCouponCount', ignoreError: true});
    }

    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(
        function(result) {
          common_util.renderEx(req, res, 'member/info', {
            title: common_util.titlePostfix('个人信息-会员中心'),
            nav: 'info',
            user: result.user,
            regCouponCount: result.regCouponCount || 0
          });
        },
        http_util.errorHandler(req, res, next)
      );
  }
);

router.get('/orders',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderEx(req, res, 'member/orders', {
      title: common_util.titlePostfix('我的订单-会员中心'),
      nav: 'orders',
      status: req.query.status,
      isMigrated: req.user.isMigrated
    });
  }
);

router.get('/orders/view/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {

    var handler = function(data) {
      common_util.renderEx(req, res, 'member/order_view', {
        title: common_util.titlePostfix('我的订单-会员中心'),
        nav: 'orders',
        order: data,
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

router.get('/collect',
    auth.requireAuth(),
    function (req, res, next) {
      var pageNum = req.query.pageNum;
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
            common_util.renderEx(req, res, 'member/collect', {
              nav: 'collect',
              title: common_util.titlePostfix('我的收藏商品-会员中心'),
              pageVO: {
                pageSize: json.pageSize,
                pageNumber: json.pageNumber,
                totalCount: json.totalCount,
                totalPages: json.totalPages,
                prods: prodSum
              }
            });
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
                prod.imageUrl = item.imageUrl;
                prod.saleStatus = item.saleStatus;
                prod.stockStatus = item.stockStatus;
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

router.get('/receiver',
  auth.requireAuth(),
  function(req, res, next) {

    var handler = function(addresses) {
      common_util.renderEx(req, res,'member/receiver', {
        nav: 'receiver',
        title: common_util.titlePostfix('我的收货地址-会员中心'),
        addresses: addresses
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

router.get('/promoter/apply',
  auth.requireAuth(),
  function(req, res, next) {
    var user = req.user;
    if (!(user.type === 'MEMBER' && (!user.referralUserId || user.referralUserId == user.distUserId))) {
      res.redirect('member.html');
      return;
    }
    var _data = req.flash('promoter_apply');
    if(_data&&_data.length>0){
      var obj = _data[0];
      common_util.renderEx(req, res, 'member/promoter_apply_next', {
        title: common_util.titlePostfix('推广有礼-会员中心'),
        nav: 'promoter_apply',
        promoter_info:obj
      });
      return;
    }

    http_util.request('facade', {
      method: 'GET',
      url: '/promoter/apply/view/' + req.user.id
    }).done(
      http_util.resultMessageHandler(function(requestVO) {
        common_util.renderEx(req, res, 'member/promoter_apply', {
          title: common_util.titlePostfix('推广有礼-会员中心'),
          nav: 'promoter_apply',
          requestVO:requestVO
        });
      },req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/safe',
  auth.requireAuth(),
  function(req, res, next) {
    common_util.renderEx(req, res, 'member/safe', {
      title: common_util.titlePostfix('安全中心-会员中心'),
      nav: 'safe',
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
        common_util.renderEx(req, res, 'member/promote', {
          title: common_util.titlePostfix('推广有礼-会员中心'),
          nav: 'promote',
          mapVo: result
        });
      },req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/promoter/agreement',
  function(req, res, next) {
    common_util.renderEx(req, res, 'member/promoter_protocol',{
      title: '推广员协议'
    });
  }
);

//历史订单查询
router.get('/legacy_orders',
  auth.requireAuth(),
  function(req, res, next) {
    if(req.user.isMigrated&&req.user.isMigrated=='Y'){
      common_util.renderEx(req, res, 'member/legacy_orders',{
        title: common_util.titlePostfix('历史订单-会员中心'),
        nav: 'legacy_orders'
      });
    }else{
      common_util.renderEx(req, res, 'member/orders', {
        title: common_util.titlePostfix('我的订单-会员中心'),
        nav: 'orders',
        status: req.query.status,
        isMigrated: req.user.isMigrated
      });
    }
  }
);

router.get('/legacy/orders/view/:orderNo',
  auth.requireAuth(),
  function(req, res, next) {

    var handler = function(data) {
      common_util.renderEx(req, res, 'member/legacy_order_view', {
        title: common_util.titlePostfix('历史订单-会员中心'),
        nav: 'legacy_orders',
        order: data,
        order_util: order_util,
        user: req.user
      });
    };

    http_util.request('facade', {
      method: 'GET',
      url: '/legacyOrder/view/' + req.params.orderNo,
      data: { userId: req.user.id }
    }).done(
      http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );

  }
);
//邮箱验证确认页
router.get('/verify/email/:code',
  auth.requireAuth(),
  function(req, res, next) {
    http_util.request('facade', {
        method: 'POST',
        data: {
          userId:req.user.id
        },
        url: '/user/verify/email/' + req.params.code
      })
      .done(
        http_util.resultMessageHandler(function(result) {
          if(!result.id){
            common_util.renderEx(req, res, 'member/safe_email_verify', {
              title: common_util.titlePostfix('安全中心-邮箱验证'),
              nav: 'safe',
              code: result
            })
          }else{
            req.login(result, function () {
              common_util.renderEx(req, res, 'member/safe_email_verify', {
                title: common_util.titlePostfix('安全中心-邮箱验证'),
                nav: 'safe',
                code:'200'
              })
            });
          }
        },req, res, next),
        http_util.errorHandlerJSON(req, res, next)
      );
  }
);
// ------------------------------------------------------------------------
// pages - 推广员
// ------------------------------------------------------------------------

router.get('/promoter/member',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'PROMOTER') {
      res.redirect('member.html');
      return;
    }
    common_util.renderEx(req, res, 'member/promoter/member', {
      title: common_util.titlePostfix('下级会员-会员中心'),
      nav: 'promoter_member'
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
    common_util.renderEx(req, res, 'member/promoter/member_orders', {
      title: common_util.titlePostfix('会员订单-会员中心'),
      nav: 'promoter_member_orders',
      memberId: req.query.memberId
    });
  }
);

//推广员-结算账户
router.get('/promoter/account',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function (req, res, next) {
    http_util.request('facade', {
        method: 'GET',
        url: '/promoter/bank/account/' + req.user.id
      })
      .done(
        http_util.resultMessageHandler(function(result) {
          common_util.renderEx(req, res, 'member/promoter/account', {
            title: common_util.titlePostfix('结算账户-会员中心'),
            nav: 'promoter_account',
            accountVO: result
          });
        },req, res, next),
        http_util.errorHandlerJSON(req, res, next)
      );
  }
);

//推广员-我的佣金
router.get('/promoter/commission',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    http_util.request('facade', {
      method: 'GET',
      url: '/promoter/commission/my/' + req.user.id
    }).done(
      http_util.resultMessageHandler(function(result) {
        common_util.renderEx(req, res, 'member/promoter/commission', {
          title: common_util.titlePostfix('我的佣金-会员中心'),
          nav: 'promoter_commission',
          total: result.total,
          settlement: result.settlement,
          remaining: result.remaining,
          minDrawAmount: result.minDrawAmount,
          eff: result.eff
        });
      },req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
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
    common_util.renderEx(req, res, 'member/dist/promoter_audit', {
      title: common_util.titlePostfix('下级会员-会员中心'),
      nav: 'dist_promoter_audit'
    });
  }
);

router.get('/dist/promoter_commission',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'DISTRIBUTOR') {
      res.redirect('member.html');
      return;
    }
    common_util.renderEx(req, res, 'member/dist/promoter_commission', {
      title: common_util.titlePostfix('下级会员-会员中心'),
      nav: 'dist_promoter_commission'
    });
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
    common_util.renderEx(req, res, 'member/dist/promoter', {
      title: common_util.titlePostfix('下级会员-会员中心'),
      nav: 'dist_promoter'
    });
  }
);

router.get('/dist/member',
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
      timeRange: req.body.timeRange,
      promoterName: req.body.promoterName,
      pageNumber: req.body.pageNumber||1,
      pageSize: req.body.pageSize||20,
      userId: req.user.id
    };
    http_util.request('facade',{
      method: 'POST',
      url: '/distributor/member/list',
      data:data
    }).done(
      http_util.resultMessageHandler(function(page) {
        common_util.renderEx(req, res, 'member/dist/member', {
          title: common_util.titlePostfix('下级会员-分销商'),
          nav: 'dist_member',
          page: page
        });
      },req,res,next),
      http_util.errorHandlerJSON(req,res,next));
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
    common_util.renderEx(req, res, 'member/dist/member_orders', {
      title: common_util.titlePostfix('下级会员-会员中心'),
      nav: 'dist_member_orders',
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
      http_util.resultMessageHandler(function(accountVO) {
        common_util.renderEx(req, res, 'member/dist/account', {
          title: common_util.titlePostfix('结算账户-会员中心'),
          nav: 'dist_account',
          accountVO: accountVO
        });
      },req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
  }
);

router.get('/dist/commission',
  auth.requireAuth(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {

    var handler = function(data) {
      common_util.renderEx(req, res, 'member/dist/commission', {
        title: common_util.titlePostfix('我的佣金-分销商'),
        nav: 'dist_commission',
        commission: data
      });
    };
    http_util.request('facade', {
      method: 'GET',
      url: '/distributor/commission/my/' + req.user.id
    }).done(
      http_util.resultMessageHandler(handler , req, res, next),
      http_util.errorHandlerJSON(req, res, next)
    );
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
router.post('/update',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var user = {
      userId: req.user.id,
      login: req.body.login,
      name: req.body.name,
      gender:req.body.gender,
      birthDate: req.body.birthDate,
      avatarUrl: req.body.avatarUrl
    };
    if(req.user.emailVerified != 'Y' && !req.user.email){
      user.email = req.body.email;
    }
    updateUserInfo(
      user,
      function (json) {
        if(json.success){
          // 重新登录, 刷新用户会话信息
          req.login(json.data, function () {
            // 发送更新用户信息到前台
            res.json(json);
          });
        }else {
          res.json(json);
        }
      },
      http_util.errorHandlerJSON(req, res, next)
   );
  }
);

// 动态加载订单数据
router.post('/orders',
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
      http_util.pipe('facade', {
        method: 'POST',
        url: '/order/my',
        data: data
      }, res);
    }
);
// confirm
router.post('/order/confirm/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {
      userId: req.user.id
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/order/confirm/' + req.params.orderNo,
      data: data
    }, res);
  }
);

router.post('/order/cancel/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      reason: req.body.reason
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/order/cancel/' + req.params.orderNo,
      data: data
    }, res);
  }
);
router.post('/order/status/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {
      userId: req.user.id
    };
    http_util.pipe('facade', {
      method: 'GET',
      url: '/order/status/' + req.params.orderNo,
      data: data
    }, res);
  }
);

// 再次购买
router.post('/order/purchase/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      orderNo: req.params.orderNo
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/user/cart/copyBatch',
      data: data
    }, res);
  }
);

// 查看订单-物流信息 HTML
router.post('/order/express/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {

    var handler = function(list) {
      common_util.renderEx(req, res, 'member/order_express', {
        list: list
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


//会员中心-结算账户
router.post('/bank/account',
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


//推广员下级会员搜索
router.post('/promoter/member/search',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var user = req.user;
    if (user.type !== 'PROMOTER') {
      res.redirect('member.html');
      return;
    }
    var data = {
      login: req.body.login,
      name: req.body.name,
      mobile: req.body.mobile,
      timeRange: req.body.timeRange,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/promoter/members/' + req.user.id,
      data: data
    },res);
  }
);

//分销商下级会员搜索
router.post('/distributor/member/search',
  auth.requireAuthAjax(),
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
      timeRange: req.body.timeRange,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize,
      userId: user.id
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/distributor/member/list',
      data: data
    },res);
  }
);

//分销商-推广员-列表
router.post('/distributor/promoter/list',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      login: req.body.login,
      name: req.body.name,
      mobile: req.body.mobile,
      timeRange: req.body.timeRange,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize || 20
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/distributor/promoter/list',
      data: data
    }, res);
  }
);

//分销商-推广员-修改佣金比例
router.post('/distributor/promoter/update/rate',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      promoterId: req.body.promoterId,
      rate: req.body.rate
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/distributor/promoter/update/rate',
      data: data
    }, res);
  }
);

//分销商-会员订单-列表
router.post('/distributor/member_orders',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      memberId: req.body.memberId,
      login: req.body.login,
      mobile: req.body.mobile,
      name: req.body.name,
      consignee: req.body.consignee,
      timeRange: req.body.timeRange,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize || 20
    };
    var handler = function(json) {
      res.json({success: true, data:json});
    };
    http_util.request('facade', {
      method: 'POST',
      url: '/distributor/member/order',
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

//推广员-会员订单-列表
router.post('/promoter/member_orders',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      memberId: req.body.memberId,
      login: req.body.login,
      mobile: req.body.mobile,
      consignee: req.body.consignee,
      name: req.body.name,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize || 20
    };
    var handler = function(json) {
      res.json({success: true, data:json});
    };
    http_util.request('facade', {
      method: 'POST',
      url: '/promoter/member/order',
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

// 推广员-推广佣金列表
router.post('/promoter/commission',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var user = req.user;

    var data = {
      beginDate: req.body.beginDate,
      endDate: req.body.endDate,
      pageNumber: req.body.pageNumber || 1,
      pageSize: req.body.pageSize || 20
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/promoter/commission/order/' + req.user.id,
      data: data
    },res);
  }
);

//推广员-提取佣金列表
router.post('/promoter/commission/draw',
  auth.requireAuth(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var user = req.user;

    var data = {
      pageNumber: req.body.pageNumber || 1,
      pageSize: req.body.pageSize || 20
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/promoter/commission/draw/page/' + req.user.id,
      data: data
    },res);
  }
);
// 订单详情-HTML
router.get('/order/detail/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {
      userId: req.user.id
    };
    var handler = function(json) {
      common_util.renderEx(req, res, 'member/order_detail', {
        order: json,
        order_util: order_util,
        commissionType: req.query.commissionType
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

// 分销商-推广佣金-列表
router.post('/distributor/commission/direct',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      timeRange: req.body.timeRange,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize
    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/commission/direct',
      data: data
    }, res);
  }
);
// 分销商-推广佣金-EXCEL
router.post('/distributor/commission/direct/excel',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      timeRange: req.body.timeRange
    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/commission/direct/excel',
      data: data
    }, res);
  }
);

router.post('/distributor/commission/indirect',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      timeRange: req.body.timeRange,
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize
    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/commission/indirect',
      data: data
    }, res);
  }
);

router.post('/distributor/commission/indirect/excel',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      userId: req.user.id,
      timeRange: req.body.timeRange
    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/commission/indirect/excel',
      data: data
    }, res);
  }
);

// 分销商-佣金结算-列表
router.post('/distributor/commission/settle',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize
    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/commission/settlement/' + req.user.id,
      data: data
    }, res);
  }
);

// 分销商-佣金结算详情-HTML
router.post('/distributor/commission/settle/detail/:settlementId',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var handler = function(json) {
      common_util.renderEx(req, res, 'member/dist/commission_detail', {
        record: json
      });
    };
    http_util.request('facade', {
      method: 'post',
      url: '/distributor/commission/settlement/' + req.user.id + '/' + req.params.settlementId
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

//推广员-提取佣金详情-HTML
router.post('/promoter/commission/draw/detail',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var handler = function(json) {
      common_util.renderEx(req, res, 'member/promoter/commission_draw_detail', {
        record: json,
        order_util: order_util
      });
    };
    http_util.request('facade', {
      method: 'post',
      url: '/promoter/commission/draw/request',
      data: {
        userId: req.user.id,
        drawRequestId: req.body.drawRequestId
      }
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

//我的收货地址新增
router.post('/user/address/create',
  auth.requireAuthAjax(),
  function(req,res,next){
    req.body.userId = req.user.id;
    http_util.pipe('facade',{
      method: 'POST',
      url: '/user/address/create',
      data: req.body
    },res);
  }
);

//我的收货地址删除
router.post('/user/address/delete',
  auth.requireAuthAjax(),
  function(req,res,next){
    http_util.pipe('facade',{
      method: 'POST',
      url: '/user/address/delete/'+ req.body.id
    },res);
  }
);

//我的收货地址设置默认
router.post('/user/address/default',
  auth.requireAuthAjax(),
  function(req,res,next){
    http_util.pipe('facade',{
      method: 'POST',
      url: '/user/address/default/'+ req.body.id,
      data:{userId: req.user.id}
    },res);
  }
);

//查看我的收藏地址
router.get('/user/address/view/:addressId',
  auth.requireAuthAjax(),
  function(req,res,next){
    http_util.pipe('facade',{
      method: 'GET',
      url: '/user/address/view/'+ req.params.addressId
    },res);
  }
);

//我的收货地址设置更新
router.post('/user/address/update',
  auth.requireAuthAjax(),
  function(req,res,next){
    req.body.userId = req.user.id;
    http_util.pipe('facade',{
      method: 'POST',
      url: '/user/address/update/'+ req.body.id,
      data:req.body
    },res);
  }
);

//推广员-我的佣金提取
router.post('/commission/draw',
  auth.requireAuthAjax(),
  function (req, res, next) {
    req.body.userId = req.user.id;
    http_util.pipe('facade',{
      method: 'POST',
      url: '/promoter/commission/draw',
      data: req.body
    },res);
  }
);

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
      common_util.renderEx(req, res, 'member/order_item', {
        page: page,
        order_util: order_util
      });
    };
    http_util.request('facade', {
      method: 'post',
      data: data,
      url: '/order/my'
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);
// 我的订单-统计
router.post('/orders/count',
  auth.requireAuthAjax(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'get',
      url: '/order/count/' + req.user.id
    }, res);
  }
);

// 我的订单-申请售后
router.post('/order/service/apply/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {

    var data = req.body;
    data.userId = req.user.id;
    http_util.pipe('facade', {
      method: 'post',
      data: data,
      url: '/order/service/sale/' + req.params.orderNo
    }, res);
  }
);
// 我的订单-申请售后
router.post('/order/service/express/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {

    var data = req.body;
    data.userId = req.user.id;
    http_util.pipe('facade', {
      method: 'post',
      data: data,
      url: '/order/service/express/update/' + req.params.orderNo
    }, res);
  }
);

// 我的订单-售后跟踪
router.post('/order/service/view/:orderNo',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = {userId: req.user.id};
    var handler = function(json) {
      common_util.renderEx(req, res, 'member/order_service_view', {
        service: json,
        order_util: order_util
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

// 分销商-推广员审核-列表
router.post('/distributor/promoter_audit/list',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize,
      userId:req.user.id,
      name: req.body.name,
      login: req.body.login,
      mobile: req.body.mobile,
      status: req.body.status,
      timeRange: req.body.timeRange

    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/approve/promoter/list',
      data: data
    }, res);
  }
);

router.post('/distributor/promoter_audit/view',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {};
    http_util.pipe('facade', {
      method: 'get',
      url: '/distributor/approve/promoter/' + req.body.requestId + '/' + req.user.id,
      data: data
    }, res);
  }
);

router.post('/distributor/promoter_audit/audit',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function (req, res, next) {
    var data = req.body;
    data.userId = req.user.id;
    http_util.pipe('facade', {
      timeout: 60000 /* in ms */,
      method: 'post',
      url: '/distributor/approve/promoter',
      data: data
    }, res);
  }
);

// 推广员-订单佣金-导出EXCEL
router.post('/promoter/commission/order/excel',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    var data = {
      beginDate: req.body.beginDate,
      endDate: req.body.endDate
    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/promoter/commission/order/excel/' + req.user.id,
      data: data
    }, res);
  }
);

// 分销商-佣金审核-列表
router.post('/distributor/commission_audit/list',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = {
      pageNumber: req.body.pageNumber,
      pageSize: req.body.pageSize,
      userId:req.user.id,
      login: req.body.login,
      mobile: req.body.mobile,
      status: req.body.status,
      timeRange: req.body.timeRange

    };
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/approve/draw/list',
      data: data
    }, res);
  }
);

router.post('/distributor/commission_audit/view',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var forAudit = req.body.action && req.body.action == 'audit';
    var handler = function(json) {
      var tplName = forAudit ? 'member/dist/promoter_commission_audit' : 'member/dist/promoter_commission_view';
      common_util.renderEx(req, res, tplName, {
        record: json,
        user: req.user
      });
    };
    var data = {};
    http_util.request('facade', {
      method: 'get',
      url: '/distributor/approve/draw/' + req.body.requestId + '/' + req.user.id,
      data: data
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

router.post('/distributor/commission_audit/audit',
  auth.requireAuthAjax(),
  auth.requireRoles('DISTRIBUTOR'),
  function(req, res, next) {
    var data = req.body;
    data.userId = req.user.id;
    http_util.pipe('facade', {
      method: 'post',
      url: '/distributor/approve/draw',
      data: data
    }, res);
  }
);

//推广员-佣金提取-查询结算账户
router.get('/promoter/bank/account',
  auth.requireAuthAjax(),
  auth.requireRoles('PROMOTER'),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'GET',
      url: '/promoter/bank/account/' + req.user.id
    }, res);
  }
);

//推广员申请
router.post('/promoter/apply/next',
  auth.requireAuthAjax(),
  function (req, res, next) {
    var user = req.user;
    if (!(user.type === 'MEMBER' && (!user.referralUserId || user.referralUserId == user.distUserId))) {
      res.json({
        error: true
      });
      return;
    }
    var _data = {
      name:req.body.name,
      gender:req.body.gender,
      reason:req.body.reason,
      mobile:req.body.mobile
    };
    req.flash('promoter_apply', _data);
    res.json({
      success: true
    });
  }
);

// 获取地址信息-所有省份
router.post('/region/list',
  auth.requireAuthAjax(),
  function(req, res, next){
    // see common_data.js
    var tree = common_data.getRegions(), arr = [];
    tree.forEach(function(region){
      var item = extend({}, region);
      // clear subs
      item.subRegions = null;
      arr[arr.length] = item;
    });

    res.json({success: true, data: arr});
  }
);
// 获取地址信息-根据id,获取下级列表
router.post('/region/item/:parentId',
  auth.requireAuthAjax(),
  function(req, res, next){
    var parentId = req.params.parentId;
    var region = common_data.getRegion(parentId);
    if (!region) {
      res.json({success: false, error:{message: 'no region info found by id ' + parentId}})
      return;
    } else {
      var subs = region.subRegions;
      if (subs && subs.length) {
        var arr = subs.map(function(sub) {
          return {
            id: sub.id,
            name: sub.name,
            type: sub.type,
            parentId: sub.parentId
          };
        });

        res.json({success: true, data: arr});
      } else {
        res.json({success: true, data: (subs || [])});
        return;
      }
    }
  }
);
router.post('/promoter/apply/submit',
  auth.requireAuthAjax(),
  function (req, res, next) {
    var user = req.user;
    if (!(user.type === 'MEMBER' && (!user.referralUserId || user.referralUserId == user.distUserId))) {
      res.json({
        error: true
      });
      return;
    }
    http_util.pipe('facade',{
      method: 'POST',
      url: '/promoter/apply/submit/'+ req.user.id,
      data:req.body
    },res);
  }
);

router.post('/image/upload/avatar',
  auth.requireAuthAjax({dataType:'text'}),
  function(req, res, next) {
    upload_file(req,res,next,'/image/upload/avatar', function(err, resp) {
      if (!resp.success) {

        res.end(JSON.stringify(resp));
        return;
      }
      // 如果图片更新成功, 重新登录更新session数据
      var user = req.user;
          user.avatarUrl = resp.data.url;
          //birthDate格式,缺少userId
          user.userId = req.user.id;
          user.birthDate = moment(user.birthDate).format('YYYY-MM-DD');
      delete user.login;
      delete user.email;
/*      var handler = function (user) {
        // 重新登录, 刷新用户会话信息
        req.login(user, function () {
          // 发送更新用户信息到前台
          res.end(JSON.stringify(resp));
        });
      };
      updateUserInfo(
        user,
        http_util.resultMessageHandler(
          handler,
          req,
          res,
          next
        ),
        function() {
          res.end(JSON.stringify({success: false, error: {message : '更新用户信息失败'}}));
        }
      )*/
      updateUserInfo(
        user,
        function (json) {
          if(json.success){
            // 重新登录, 刷新用户会话信息
            req.login(json.data, function () {
              // 发送更新用户信息到前台
              res.end(JSON.stringify(resp));
            });
          }else {
            res.json(json);
          }
        },function() {
          res.end(JSON.stringify({success: false, error: {message : '更新用户信息失败'}}));
        }
      )
    });
  }
);
router.post('/image/upload/idcard',
  auth.requireAuthAjax({dataType:'text'}),
  function(req, res, next) {
    upload_file(req, res, next,'/image/upload/idcard');
  }
);
router.post('/image/upload/voucher',
  auth.requireAuthAjax({dataType:'text'}),
  function(req,res,next) {
    upload_file(req, res, next, '/image/upload/voucher');
  }
);
function upload_file(req, res, next, url, success, error) {
  // TODO which folder used
  // TODO remove file once request finished
  // TODO check extension of file
  // TODO check file size exceeded expected?
  var form = new multiparty.Form();
  /*
  form.on('field', function(name, value) {

  });
  */
  form.on('error', function(){
    res.end(JSON.stringify({success: false, error: {message: '上传文件失败'}}));
  });
  form.on('file', function(name, file) {
    do_upload_file(req, url, file.path, function(err, data){
      if(err) {
        if (error) {
          error(err, data);
        } else {
          res.end(JSON.stringify({success: false, error: {message: '上传文件失败'}}));
        }
      } else {
        if (success) {
          success(err, data);
        } else {
          res.end(JSON.stringify(data));
        }
      }
    })
  });

  form.parse(req);
}

function do_upload_file(req, url, filePath, cb) {
  var uploadUrl = image_util.getUploadUrl(url);

  var opts = {
    timeout:  1000 * 10,
    multipart: true,
      file: { file: filePath, content_type: 'image/jpg' },
      userId: req.user.id
  };

  var params = {
    file: { file: filePath, content_type: 'image/jpg' },
    userId: req.user.id
  };

  needle.post(uploadUrl, params, opts, function(err, data) {
    if (err)
      return cb(err );

    cb(null, data.body);
  });
}

router.get('/express/company/list',
  auth.requireAuthAjax(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'GET',
      url: '/express/company/list'
    }, res);
  }
);

//用户中心我的收藏，根据skuId删除
router.get('/user/favorite/delete/:skuId',
  auth.requireAuthAjax(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'GET',
      url: '/user/favorite/delete/'+req.user.id+'/'+req.params.skuId
    }, res);
  }
);

// 我的老系统订单-列表
router.post('/legacy/orders/list',
  auth.requireAuthAjax(),
  function(req, res, next) {
    var data = req.body;
    data.userId = req.user.id;
    if (data.status == 'ALL') {
      delete data.status;
    }

    var handler = function(page) {
      common_util.renderEx(req, res, 'member/legacy_order_item', {
        page: page,
        order_util: order_util
      });
    };
    http_util.request('facade', {
      method: 'post',
      data: data,
      url: '/legacyOrder/my'
    }).done(http_util.resultMessageHandler(handler, req, res, next),
      http_util.errorHandler(req, res, next));
  }
);

//会员中心-我的优惠券

router.get('/coupon/my',
  auth.requireAuth(),
  function (req, res, next) {
    common_util.renderEx(req, res, 'member/my_coupon', {
      title: common_util.titlePostfix('会员中心-我的优惠券'),
      nav: 'coupons'
    });
  }
);

router.post('/coupon/my',
  auth.requireAuthAjax(),
  function (req, res, next) {
    var data = {
      userId: req.user.id,
      status: req.body.status,
      pageNumber: req.body.pageNumber||1,
      pageSize: req.body.pageSize||10
    };
    http_util.pipe('facade', {
      method: 'POST',
      url: '/user/coupon/my',
      data: data
    }, res);
  }
);

router.get('/coupon/center',
  auth.requireAuth(),
  function (req, res, next) {
    common_util.renderEx(req, res, 'member/coupon_center', {
      title: common_util.titlePostfix('会员中心-领取优惠券'),
      nav: 'coupons'
    });
  }
);

router.post('/coupon/center',
  auth.requireAuthAjax(),
  function (req, res, next) {
    var data = {
      userId: req.user.id,
      withoutPaging:true
    };
    var reqs = [], spreadOpts = [];
    reqs.push(http_util.request('facade', {url : '/user/coupon/my', method:'POST', data: data}));
    spreadOpts.push({ name: 'userCoupons', ignoreError: true });

    reqs.push(http_util.request('facade', {url : '/user/coupon/batch/list', method:'POST', data: data}));
    spreadOpts.push({ name: 'batches', ignoreError: true });

    http_util.multiRequest(reqs)
      .spread(http_util.spreadMap(spreadOpts))
      .done(
        function(result) {
          var userCouponsMap = {};
          result['userCoupons'].pageData.forEach(function(coupon) {
            userCouponsMap[coupon.batchId] = userCouponsMap[coupon.batchId] || 0;
            userCouponsMap[coupon.batchId]++;
          });
          result['batches'].pageData.forEach(function(batch) {
            if(userCouponsMap[batch.id]) {
              batch.handout = userCouponsMap[batch.id];
            }
          });
          res.json({data:result['batches'], success: true});
        },
        http_util.errorHandler(req, res, next)
      );
  }
);

//安全中心邮箱页面
router.get('/safe/email',
  auth.requireAuth(),
  function (req, res, next) {
    common_util.renderEx(req, res, 'member/safe_email', {
      title: common_util.titlePostfix('会员中心-邮箱'),
      nav: 'safe'
    });
  }
);

router.get('/safe/sendEmailVerified/:email',
  auth.requireAuthAjax(),
  function(req, res, next) {
    http_util.pipe('facade', {
      method: 'post',
      data: {
        userId:req.user.id,
        email:req.params.email
      },
      timeout:60000,
      url: '/user/send/verifyCode'
    }, res);
  }
);

//用户更新时信息check
router.post('/check/userExt', function(req, res, next) {
  http_util.pipe('facade', {
    method: 'POST',
    url: '/user/check/userExt',
    data: {
      login: req.body.login,
      email: req.body.email
    }
  }, res);
});

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

module.exports = router;
