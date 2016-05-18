var express = require('express'),
    logger = require('../logger'),
    common_util = require('../util/common_util'),
    http_util = require('../util/http_util');

var router = express.Router();

router.get('/:id', function(req, res, next) {
  var id = req.params.id,
      title = hardcodedHelpMappings[id];
  if (!title) {
    // 如果找不到对应的id，往下走
    return next();
  }
  common_util.renderEx(req, res, 'help/' + id, {
    title: common_util.titlePostfix(title),
    nav: id
  });
});

var hardcodedHelpMappings = {
  '101': '购物流程-新手指南',
  '102': '支付方式-新手指南',
  '103': '通关税费-新手指南',
  '104': '常见问题-新手指南',
  '105': '《中华人民共和国进境物品归类表》',
  '201': '退货政策-售后服务',
  '202': '退货流程-售后服务',
  '203': '退款说明-售后服务',
  '301': '配送方式-物流配送',
  '302': '运费说明-物流配送',
  '303': '物流跟踪-物流配送',
  '401': '蚂蚁海购-关于我们',
  '402': '联系我们-关于我们',
  '403': '诚聘英才-关于我们',
  '404': '服务声明-关于我们',
  '501': '注册协议',
  '502': '推广员协议',
  '503': '绑定说明',
  '504': '关注蚂蚁'
};

module.exports = router;
