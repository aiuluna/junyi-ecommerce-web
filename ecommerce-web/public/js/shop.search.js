var ShopSearch = function ($) {
  "use strict";

  var selectedParams = {};
  var result_wrapper_id = 'js_div_result';
  var pageSize = 16;
  function getResultWrapper() {
    return $('#' + result_wrapper_id);
  }
  function getPageOpt($wrapper) {
    var $ele = ($wrapper || getResultWrapper());

    var ret =  {
      totalCount: $ele.data('total_count') || 0,
      pageSize  : $ele.data('page_size') || 16,
      pageNumber: $ele.data('page_number') || 1
    };

    pageSize = ret.pageSize;

    return ret;
  }

  function getSearchParam() {
    var param = {};

    $.each(selectedParams, function (type, value) {
      param[type + 'Id'] = value.value;
    });
    /* 搜索分类通过categoryIdLevel1*/
    if(param.categoryId) {
      param.categoryIdLevel1 = param.categoryId;
      delete param.categoryId;
    }

    /* sort */
    $.each($('.on', $('#js_param_sort')), function () {
      var $me = $(this);
      param.sort = $me.data('sort').toUpperCase();
      param.dir = $me.find('i').hasClass('pup') ? 'ASC' : 'DESC';
    });

    /*price range*/
    var $priceRange = $('#js_param_price_range');
    var priceLow = $('.js-range-from', $priceRange).val();
    var priceHigh = $('.js-range-to', $priceRange).val();
    if (priceLow) {
      param.priceLow = priceLow;
    }
    if (priceHigh) {
      param.priceHigh = priceHigh;
    }

    /* activity*/
    if ($('#c1').is(':checked')) {
      param.isPromotion = 'Y';
    }
    var tag = [];
    if ($('#c2').is(':checked')) {
      tag.push('HOT_SALE');
    }
    if ($('#c3').is(':checked')) {
      tag.push('PARTICULAR');
    }
    if ($('#c4').is(':checked')) {
      tag.push('NEW');
    }
    if (tag.length) {
      param.tag = tag.join(',');
    }

    return _getSearchParamWithFallback(param);
  }

  // LxC(2016-03-16): 如果页面一开始就限定了部分搜索条件，即使用户点“x”去掉了，也要加到搜索条件上
  function _getSearchParamWithFallback(param) {
    for (var key in _searchParamFallback) {
      if (!param[key] && _searchParamFallback[key]) {
        param[key] = _searchParamFallback[key];
      }
    }
    return param;
  }

  function enableLazyLoad(selector, $context) {
    var matched = $context ? $(selector, $context) : $(selector);
    matched.lazyload({
      effect: "fadeIn",
      threshold: 200,
      failure_limit: 10
    });
  }

  function pagination(opt) {
    var pgOpt = {
      selector: '#js_pagination_bottom',
      pageNumber: opt.pageNumber,
      totalCount: opt.totalCount,
      pageSize: opt.pageSize,
      callback: function (pageNum) {
        doSearch(pageNum + 1, true);
        // set continue propagation as false
        return false;
      }
    };
    Shop.pagination(pgOpt);
    initTopPagination();
  }

  function updateSearchResult(html) {
    $('#js_search_result').empty().html(html);
  }

  function calcStart(pageNum) {
    if (!isNaN(pageNum) || parseInt(pageNum) > 0) {
      return (parseInt(pageNum) - 1) * (pageSize || 16);
    } else {
      return 0;
    }
  }

  // pageNum start from 1 not 0
  function doSearch(pageNum, scroll) {
    var param = getSearchParam();
    param.start = calcStart(pageNum);
    Shop.post({
      url: '/product/search/result',
      data: param,
      dataType: 'html',
      success: function (html) {
        updateSearchResult(html);
        var $wrapper = getResultWrapper();
        var opt = getPageOpt($wrapper);
        pagination(opt);

        $('#js_totalCount').text(opt.totalCount);
        enableLazyLoad('img.lazy', $wrapper);

        // if click on bottom pagination bar
        var $topCtnr = $('#content');
        // reset scroll
        if (scroll === true && $topCtnr.data('$scrollToHead') !== false) {
          scrollTo($('#js_search_result'), 117, 10);
        }
        $topCtnr.data('$scrollToHead', true);
      }
    });
  }

  function initSort() {
    /* sort by price, saleCount */
    $('#js_param_sort').on('click', 'span', function () {
      var $me = $(this);
      $me.addClass('on').siblings('span').removeClass('on');
      var $i = $me.children('i');
      if ($i.hasClass('pup')) {
        $i.removeClass('pup').addClass('pdown');
      } else if ($i.hasClass('pdown')) {
        $i.removeClass('pdown');
        $me.removeClass('on');
      } else {
        $i.addClass('pup');
      }
      doSearch();
    });
  }

  function initPriceRange() {
    /* price range btn */
    $('#js_param_price_btn').click(function () {
      var $priceRange = $('#js_param_price_range');
      var priceLow = $('.js-range-from', $priceRange),
        priceHigh = $('.js-range-to', $priceRange);
      var price1 = priceLow.val().trim(),
        price2 = priceHigh.val().trim();

      if (price1 && price2 && parseFloat(price1) > parseFloat(price2)) {
        priceHigh.val(price1);
        priceLow.val(price2);
      }

      doSearch();
    });

    $('#js_param_price_range').on('keyup', 'input', function () {
      var $input = $(this);
      if (isNaN($input.val().trim())) {
        $input.val('');
      } else {
        /* two precision support */
        if (/\.\d{3,}$/.test($input.val())) {
          $input.val(parseFloat($input.val()).toFixed(2));
        }
      }
    });
  }

  function initTags() {
    /* discount or tags */
    $('#js_param_discount').on('click', 'input', function () {
      doSearch();
    });
  }

  function updateSelectedHtml(conf) {
    var $selected = $('#js_param_selected');
    $selected.show();

    var type = conf.type, index = conf.index;
    var html = '<span data-type="' + type + '" data-index="' + index + '">'
      + conf.typeText +
      '<i class="red">' + conf.valueText + '</i>' +
      '<a href="javascript:void(0)" title="删除条件" class="delYx"></a>' +
      '</span>';

    var $span = $('span[data-index=' + index + ']', $selected);
    if ($span.length > 0) {
      $span.replaceWith(html).show();
    } else {
      // never happened
      $('.yixuan', $selected).append(html);
    }
  }

  function updateSelected(conf) {
    var dataType = conf.type;
    selectedParams[dataType] = conf;
    updateSelectedHtml(conf);
  }

  function removeSelected(dataType) {
    var conf = selectedParams[dataType];
    delete selectedParams[dataType];
    var selector = 'a.on[data-type=' + conf.type + '][data-id=' + conf.value + ']';
    $(selector).removeClass('on');
  }

  function init4Params() {
    /* prod class,origin,category,brand */
    var paramSelectors = ['#js_param_class', '#js_param_origin', '#js_param_category', '#js_param_brand'];
    $(paramSelectors.join(',')).on('click', 'a', function (event, notLoad) {
      var $me = $(this);
      var $wrapper = $me.closest('.js-param-field');

      $('.on', $wrapper).removeClass('on');
      $me.addClass('on');

      var wrapperId = $wrapper.attr('id');
      var conf = {
        typeText: $wrapper.prev().text(),
        valueText: $me.text(),
        type: $me.data('type'),
        value: $me.data('id'),
        index: paramSelectors.indexOf('#' + wrapperId)
      };
      updateSelected(conf);
      if (notLoad != true) {
        doSearch();
      }
    });

    var $selected = $('#js_param_selected');
    var $spans = $('.yixuan', $selected).html('');
    $.each(paramSelectors, function (i) {
      $spans.append($('<span data-index="' + i + '"></span>').hide());
    });
    $selected.on('click', '.delYx', function () {
      var $me = $(this), $span = $me.closest('span');
      removeSelected($span.data('type'));
      $span.empty().hide();

      if ($('.delYx', $selected).length <= 0) {
        $selected.hide();
      }

      doSearch();
    });
  }
  function initTopPagination() {
    var $topCtnr = $('#content');
    $('#js_pagination_top').on('click', '.js-page-prev', function(event) {
      $topCtnr.data('$scrollToHead', false);
      $('#js_pagination_bottom').data('pagination').prevPage(event);
    }).on('click', '.js-page-next', function(event) {
      $topCtnr.data('$scrollToHead', false);
      $('#js_pagination_bottom').data('pagination').nextPage(event);
    });
  }

  /* show more brands */
  function initBrandMore() {
    var $brand = $("#js_param_brand");
    var $parent = $brand.parent();
    var brandH = $brand.height();
    if(brandH <= 56){
      $(".ppMore", $parent).hide();
    } else {
      $(".ppMore", $parent).show();
      $brand.css("height","56px");
    }
    $parent.on('click', ".ppMore", function(){
      $(this).siblings(".brand").animate({height:brandH});
      $(this).hide();
      $(".ppUp", $parent).show();
    });

    $parent.on('click', ".ppUp", function(){
      $brand.animate({height:"56px"});
      $(this).hide();
      $(".ppMore", $parent).show();
    });
  }

  var _searchParamFallback = null;

  var $body = null;
  function scrollTo($ele, offset, duration) {
    $body.animate({scrollTop: ($ele.offset().top - (offset || 20))}, duration || 10);
  }

  /**
   * init events & loader after dom loaded
   */
  function init(query) {
    $body = (window.opera) ? (document.compatMode == "CSS1Compat" ? $('html') : $('body')) : $('html,body');

    // 保存一开始传入的搜索条件
    _searchParamFallback = $.extend({}, query);
    // fix: categoryId -> categoryIdLevel1 (历史遗留问题)
    _searchParamFallback['categoryIdLevel1'] = _searchParamFallback['categoryId'];
    delete _searchParamFallback['categoryId'];

    // init 4 params (class,origin,category,brand)
    init4Params();
    initBrandMore();
    // init sort fields(SALE_PRICE,SALE_COUNT)
    initSort();
    // init sale_price range
    initPriceRange();
    // init products for sales, or with tags(HOT_SALE,PARTICULAR,NEW)
    initTags();

    // render pagination as needed after page loaded
    pagination(getPageOpt(getResultWrapper()));

    // render params
    var selectors = ['#js_param_class', '#js_param_origin', '#js_param_category', '#js_param_brand'];
    var fields    = ['classId'        , 'originId'        , 'categoryId'        , 'brandId'        ];
    var initialQuery = query || {};
    $.each(selectors, function(i, v){
      var $v = $(v);
      var val = initialQuery[fields[i]];
      if (val && val.indexOf(',') === -1) {
        $('a[data-id=' + val + ']', $v).trigger('click', [ true ]);
      }
    });
  }

  return {
    init : init
  };
}(jQuery);