/**
 * This jQuery plugin displays pagination links inside the selected elements.
 *
 * @author Gabriel Birke (birke *at* d-scribe *dot* de)
 * @version 1.2
 * @param {int} maxentries Number of entries to paginate
 * @param {Object} opts Several options (see README for documentation)
 * @return {Object} jQuery Object
 *
 * 该插件根据UI提供的样式添加了定制代码, 并非原先的实现.
 */
jQuery.fn.pagination = function (maxentries, opts) {
  opts = jQuery.extend({
    items_per_page: 10,
    num_display_entries: 10,
    current_page: 0,
    num_edge_entries: 0,
    link_to: "#",
    prev_text: "Prev",
    prev_class: 'prevIco prev',
    next_text: "Next",
    next_class: 'nextIco next',
    ellipse_text: "...",
    prev_show_always: true,
    next_show_always: true,
    current_class: 'current',
    total_show : true,
    input_show : true,
    disabled_class: 'disabled',
    execute: false,
    callback: function () { return false; }
  }, opts || {});

  return this.each(function() {

  	var current_page;
    /**
     * 计算最大分页显示数目
     */
    function numPages() {
      return Math.ceil( maxentries / opts.items_per_page);
    }
    /**
     * 极端分页的起始和结束点，这取决于current_page 和 num_display_entries.
     * @返回 {数组(Array)}
     */
    function getInterval() {
      var ne_half = Math.ceil(opts.num_display_entries / 2);
      var np = numPages();
      var upper_limit = np - opts.num_display_entries;
      var start = current_page > ne_half ? Math.max(Math.min(current_page - ne_half, upper_limit), 0) : 0;
      var end = current_page > ne_half ? Math.min(current_page + ne_half, np) : Math.min(opts.num_display_entries, np);
      return [start,end];
  }

    /**
     * 分页链接事件处理函数
     * @参数 {int} page_id 为新页码
     */
    function pageSelected(page_id, evt){
      current_page = page_id;
      drawLinks();
      var continuePropagation = opts.callback(page_id, panel);
      if (!continuePropagation && evt) {
        if (evt.stopPropagation) {
          evt.stopPropagation();
        }
        else {
          evt.cancelBubble = true;
        }
      }
      return continuePropagation;
    }
    /**
     * 此函数将分页链接插入到容器元素中
     */
    function drawLinks() {
      panel.empty();
      panel.append(jQuery('<span class="pageNum"></span>'));
      var panelRight,
        panelLeft = jQuery('.pageNum', panel);

      if (opts.input_show) {
        panel.append(jQuery('<span class="grey"></span>'));
        panelRight = jQuery('.grey', panel);
      }

      var interval = getInterval();
      var np = numPages();

      //辅助函数用来产生一个单链接(如果不是当前页则产生span标签)
      // page_id starts from 0
      var appendItem = function(page_id, appendopts, type){
        page_id = page_id < 0 ? 0 :( page_id < np ? page_id : np - 1); // 规范page id值
        appendopts = jQuery.extend({ text : page_id + 1, classes:""}, appendopts||{});
        var lnk = jQuery('<a data-page_id=' + page_id + ">"+(appendopts.text)+"</a>")
          .attr('href', opts.link_to.replace(/__id__/,page_id));
        if (type !== 'prev' && type !== 'next' && page_id == current_page) {
          lnk.addClass(opts.current_class)
        }

        if ((current_page === 0 && type == 'prev')
          || (current_page === np - 1 && type == 'next')
        ) {
          lnk.attr('data-disabled', true);
          lnk.addClass(opts.disabled_class);
        }

        if(page_id == np - 1) {
          lnk.addClass('numLast');
        }
        // 修正第一个anchor border 缺失, (该部分代码不应该出现在这里, 应该pagination的构成与css 结合避免该问题)
        if (page_id == 0) {
          lnk.addClass('numOne');
        }


        if(appendopts.classes){
          lnk.addClass(appendopts.classes);
        }
        panelLeft.append(lnk);
      };

      var drawRightPart = function() {
        if (opts.input_show) {
          panelRight.append('<span class="grey">' +
            '<span>跳转至</span>' +
            '<input type="text" value="' + (current_page + 1) + '" name="" class="wNum">' +
            '<a href="javascript:;" class="pageSub">确定</a></span>'
          );
        }
      };

      var bindEvents = function () {

        var clickHandler = function(event) {
          var me = jQuery(this);
          var pageId = me.data('page_id');
          var disabled = me.data('disabled');
          // disabled or not
          if (disabled != true) {
            pageSelected(pageId, event)
          }
        };

        var getNumberText = function() {
          var targetPage = jQuery('.wNum', panelRight);
          var nextPage = targetPage.val();
          if (jQuery.trim(nextPage)) {
            if (/\d+/.test(nextPage)) {
              if (nextPage <= np - 1) {
                return nextPage - 1;
              } else {
                return np - 1;
              }
            }
          } else {
            return -1;
          }
        };

        var submitHandler = function (event) {
          var nextNum = getNumberText();
          if (nextNum >= 0) {
            pageSelected(nextNum, event)
          }
        };

        var keyUpHandler = function (event) {
          var targetPage = jQuery('.wNum', panelRight);
          var nextNum = getNumberText();
          if(nextNum >= 0) {
            targetPage.val(nextNum + 1);

            var keycode = event.which;
            if (keycode == 13) {
              submitHandler(event);
            }
          } else {
            targetPage.val('');
          }
        };

        // unbind event first
        panel.off();
        panel.on('click', '.pageNum a', clickHandler);

        if (opts.input_show) {
          panel.on('click', 'a.pageSub', submitHandler);
          panel.on('keyup', 'input.wNum', keyUpHandler);
        }
      };

      // 产生"Previous"-链接
      if(opts.prev_text && (current_page > 0 || opts.prev_show_always)){
        appendItem(current_page-1,{text:opts.prev_text, classes: opts.prev_class}, 'prev');
      }
      // 产生起始点
      if (interval[0] > 0 && opts.num_edge_entries > 0)
      {
        var end = Math.min(opts.num_edge_entries, interval[0]);
        for(var i = 0; i<end; i++) {
          appendItem(i);
        }
        if(opts.num_edge_entries < interval[0] && opts.ellipse_text)
        {
          jQuery("<span><i>" + opts.ellipse_text + "</i></span>").appendTo(panelLeft);
        }
      }
      // 产生内部的些链接
      for(var i=interval[0]; i<interval[1]; i++) {
        appendItem(i);
      }
      // 产生结束点
      if (interval[1] < np && opts.num_edge_entries > 0)
      {
        if(np-opts.num_edge_entries > interval[1]&& opts.ellipse_text)
        {
          jQuery("<span><i>" + opts.ellipse_text + "</i></span>").appendTo(panelLeft);
        }
        var begin = Math.max(np-opts.num_edge_entries, interval[1]);
        for(var i=begin; i<np; i++) {
          appendItem(i);
        }
      }
      // 产生 "Next"-链接
      if(opts.next_text && (current_page < np-1 || opts.next_show_always)){
        appendItem(current_page+1,{text:opts.next_text, classes:opts.next_class}, 'next');
      }

      // 产生总页数
      if (opts.total_show) {
        panelLeft.append('<span>共 ' + numPages() + ' 页</span>')
      }

      drawRightPart();
      bindEvents();
    }

    //从选项中提取current_page
    current_page = opts.current_page;
    //创建一个显示条数和每页显示条数值
    maxentries = (!maxentries || maxentries < 0) ? 1 : maxentries;
    opts.items_per_page = (!opts.items_per_page || opts.items_per_page < 0)?1:opts.items_per_page;
    //存储DOM元素，以方便从所有的内部结构中获取
    var panel = jQuery(this);

    // 获得附加功能的元素
    this.selectPage = function(page_id){ pageSelected(page_id);}
    this.prevPage = function(event){
      if (current_page > 0) {
        pageSelected(current_page - 1, event);
        return true;
      }
      else {
        return false;
      }
    };
    this.getCurrentPage = function(event) {
      return current_page;
    };
    this.nextPage = function(event){
      if(current_page < numPages() - 1) {
        pageSelected(current_page+1, event);
        return true;
      }
      else {
        return false;
      }
    };
    // 所有初始化完成，绘制链接
    drawLinks();

    // 回调函数
    if(opts.execute) {
      opts.callback(current_page, this);
    }

    $(this).data('pagination', this);
  });
}


