//select
(function($) {
  var defaults = {
    selectClassName: '.select',
    selectList: '.selectList',
    selectVal: '.selectVal',
    selectHandler: function(value, display) {}
  };
  var cache = [];
  $.fn.selectBox = function(options) {
    options = $.extend({}, defaults, options);
    this.each(function() {
      var $self = $(this);
      var $select = $self.find(options['selectClassName']);
      var $list = $self.find(options['selectList']);
      var $val = $self.find(options['selectVal']);
      var timer = null;
      cache.push($list);
      var func = function() {
        $list.hide();
        $(document).unbind('click', func);
      };
      $select.bind('click', function(event) {
        $.each(cache, function(i, n) {
          n.hide();
        });
        if ($list.children().length) $list.show();
        $(document).bind('click', func);
        event.stopPropagation();
      });

      $list.on('click', 'li', function(event) {
        var $li = $(this);
        $select.val($li.text());
        $val.attr("value", $li.attr('value'));
        $list.hide();
        event.stopPropagation();
        if (typeof options.selectHandler == 'function') {
          options.selectHandler($li.attr('value'), $li.text());
        }
      })/*.on('mouseover mouseout', 'li', function(event) {
        if (event.type == 'mouseover') {
          $list.show();
        } else {
          $list.hide();
        }
      })*/;
    });
  };
})(jQuery);