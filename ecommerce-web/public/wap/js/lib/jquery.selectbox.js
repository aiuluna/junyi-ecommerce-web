//select
(function(JQ) {
  var defaults = {
    selectClassName: '.select',
    selectList: '.selectList',
    selectVal: '.selectVal'
  };
  var cache = [];
  JQ.fn.selectBox = function(options) {
    options = JQ.extend({}, defaults, options);
    this.each(function() {
      var self = JQ(this);
      var _select = self.find(options['selectClassName']);
      var list = self.find(options['selectList']);
      var Val = self.find(options['selectVal']);
      var timer = null;
      cache.push(list);
      var func = function() {
        list.hide();
        JQ(document).unbind('click', func);
      };
      _select.bind('click', function(event) {
        JQ.each(cache, function(i, n) {
          n.hide();
        });
        list.show();
        JQ(document).bind('click', func);
        event.stopPropagation();
      });
      list.find('li').bind('click', function(event) {
        _select.val(JQ(this).text());
        Val.attr("value", JQ(this).val());
        list.hide();
        event.stopPropagation();
      }).bind('mouseover mouseout', function(event) {
        if (event.type == 'mouseover') {
          list.show();
        } else {
          list.hide();
        }
      });
    });
  };
})(jQuery);