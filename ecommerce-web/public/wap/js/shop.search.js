$(function() {
  var $doc = $(document), $win = $(window),
      hasTouch = 'ontouchstart' in window,
      CLICK_EVT = hasTouch ? 'touchend' : 'click';
  // fix: 浏览器回退后，重置一下搜索框的内容
  var searchInput = $('#searchInput');
  searchInput.val(searchInput[0].defaultValue);
  // 搜索输入
  searchInput.on("input propertychange", function() {
    var $this = $(this);
    if (!$this.val()) {
      $this.siblings(".srcClose").hide();
    } else {
      $this.siblings(".srcClose").show();
    }
  });
  if (searchInput.val()) {
    searchInput.siblings(".srcClose").show();
  }
  $(".srcClose").on(CLICK_EVT, function() {
    $(this).hide().siblings("input").val("");
  });
  if (isWeixin) {
    // 点击输入框的时候，微信会在顶部显示一个提示条……
    searchInput.click(function() {
      var ua = navigator.userAgent.toLowerCase(),
          //isAndroid = ua.indexOf('android') != -1,
          isIos = (ua.indexOf('iphone') != -1) || (ua.indexOf('ipad') != -1),
          sHeader = $(this).parents(".header");
      setTimeout(function() {
        sHeader.css("margin-top", "40px");
      }, isIos ? 200 : 0);  // iphone手机需要留出200ms时间，不然光标会不同步
      setTimeout(function() {
        sHeader.animate({
          "margin-top": 0
        }, 500);
      }, isIos ? 3000 : 4000);  // 安卓和iphone，微信提示条消失的时间不一样
    });
  }
  // 如果是默认搜索页，不用往下执行了
  if (isDefaultPage) return;

  var searchParamFallback = $.extend({}, searchParam);

  var scSale = $(".sc-sale"), scPrice = $(".sc-price");
  // 销量排序
  scSale.click(function() {
    // 关闭价格排序
    if (!scPrice.find('i').hasClass('hidden')) {
      scPrice.find('i').addClass('sc-ico3').addClass('hidden');
    }

    var toggle = scSale.find('i');
    if (toggle.hasClass('hidden')) {
      toggle.removeClass('hidden');
      if (toggle.hasClass('sc-ico3')) {
        // 按销量从低到高排序
        searchParam.sort = 'SALE_COUNT';
        searchParam.dir = 'ASC';
      } else {
        // 按销量从高到低排序
        searchParam.sort = 'SALE_COUNT';
        searchParam.dir = 'DESC';
      }
    } else {
      if (toggle.hasClass('sc-ico3')) {
        toggle.removeClass('sc-ico3').addClass('hidden');
        // 关闭销量排序
        searchParam.sort = undefined;
        searchParam.dir = undefined;
      } else {
        toggle.addClass('sc-ico3');
        // 按销量从低到高排序
        searchParam.sort = 'SALE_COUNT';
        searchParam.dir = 'ASC';
      }
    }
    searchRefresh();
  });
  // 价格排序
  scPrice.click(function() {
    // 关闭销量排序
    if (!scSale.find('i').hasClass('hidden')) {
      scSale.find('i').removeClass('sc-ico3').addClass('hidden');
    }

    var toggle = scPrice.find('i');
    if (toggle.hasClass('hidden')) {
      toggle.removeClass('hidden');
      if (toggle.hasClass('sc-ico3')) {
        // 按价格从低到高排序
        searchParam.sort = 'SALE_PRICE';
        searchParam.dir = 'ASC';
      } else {
        // 按价格从高到低排序
        searchParam.sort = 'SALE_PRICE';
        searchParam.dir = 'DESC';
      }
    } else {
      if (!toggle.hasClass('sc-ico3')) {
        toggle.addClass('sc-ico3').addClass('hidden');
        // 关闭价格排序
        searchParam.sort = undefined;
        searchParam.dir = undefined;
      } else {
        toggle.removeClass('sc-ico3');
        // 按价格从高到低排序
        searchParam.sort = 'SALE_PRICE';
        searchParam.dir = 'DESC';
      }
    }
    searchRefresh();
  });

  // 已选择搜索条件
  initProductFilter();
  $doc.on(CLICK_EVT, '.sx-kw i', function(e) {
    var $this = $(this), key = $this.parent().attr('data-key');
    $this.parent().remove();
    if ($('.sx-kw a').length === 1) $('.sx-kw').html('').hide();
    searchParam[key] = undefined;
    searchRefresh();
    e.preventDefault();
  });
  function productFilterClearAll() {
    $('.sx-kw a').each(function() {
      var $this = $(this), key = $this.attr('data-key');
      if (key) searchParam[key] = undefined;
    });
    $('.sx-kw').html('').hide();
    searchRefresh();
  }

  var productFilter = {
    productClasses: {},
    productOrigins: {},
    productCategories: {},
    productBrands: {}
  };
  function initProductFilter() {
    var filterSelected = false, list, i, el;
    if (searchParam.classId) {
      list = $('#productClasses a');
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == searchParam.classId) {
          el.addClass('on');
          _addToSelectedFilter('classId', el.text());
          filterSelected = true;
          break;
        }
      }
    }
    if (searchParam.originId) {
      list = $('#productOrigins a');
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == searchParam.originId) {
          el.addClass('on');
          _addToSelectedFilter('originId', el.text());
          filterSelected = true;
          break;
        }
      }
    }
    if (searchParam.categoryIdLevel1) {
      list = $('#productCategories a');
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == searchParam.categoryIdLevel1) {
          el.addClass('on');
          _addToSelectedFilter('categoryIdLevel1', el.text());
          filterSelected = true;
          break;
        }
      }
    }
    if (searchParam.brandId) {
      list = $('#productBrands a');
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == searchParam.brandId) {
          el.parents('li').addClass('on');
          _addToSelectedFilter('brandId', el.text());
          filterSelected = true;
          break;
        }
      }
    }
    // at last
    if (filterSelected) {
      var filterBanner = $('.sx-kw');
      $('<a href="javascript:void(0)" class="clearAll">清空</a>').on('click', productFilterClearAll).appendTo(filterBanner);
      filterBanner.show();
    }
  }
  function _addToSelectedFilter(key, label) {
    $('<a href="javascript:void(0)" data-key="' + key + '">' + label + '<i>&times;</i></a>').appendTo($('.sx-kw'));
  }

  // 分页相关
  $win.on('hashchange', handleHashChange);

  // 筛选条件 #pageFilter
  var filterContext = {};

  $(".sx-condit a").click(function() {
    var $this = $(this),
        type = $this.attr('data-type'),
        id = $this.attr('data-id'),
        label = $this.text();
    if ($this.hasClass('on')) {
      $this.removeClass('on');
      _productFilterChanged(type, id, label, true);
    } else {
      $this.addClass('on').siblings().removeClass('on');
      _productFilterChanged(type, id, label, false);
    }
  });
  $(".sxtit").on(CLICK_EVT, function(evt) {
    var $this = $(this),
        sxcon = $this.siblings('.sx-condit');
    evt.preventDefault();
    if (sxcon.css('display') === 'none') {
      sxcon.show();
    } else {
      sxcon.hide();
    }
    $this.find("i").toggleClass("ico");
  });
  $('.sxClose').click(function() {
    window.history.back();
  });
  $('.sxbtn2').click(function() {
    // 价格区间
    var priceLow = $('#priceLow').val().trim(),
        priceHigh = $('#priceHigh').val().trim();
    if (priceLow && isNaN(priceLow)) {
      ShopPopup.toast('输入的价格区间无效');
      return;
    }
    if (priceHigh && isNaN(priceHigh)) {
      ShopPopup.toast('输入的价格区间无效');
      return;
    }
    if (priceLow && priceHigh && priceLow > priceHigh) {
      var temp = priceLow;
      priceLow = priceHigh;
      priceHigh = temp;
      $('#priceLow').val(priceLow);
      $('#priceHigh').val(priceHigh);
    }
    if (priceLow) {
      searchParam.priceLow = priceLow-0;
    } else {
      searchParam.priceLow = undefined;
    }
    if (priceHigh) {
      searchParam.priceHigh = priceHigh-0;
    } else {
      searchParam.priceHigh = undefined;
    }
    // 只看优惠商品
    if ($('#isPromotion').prop('checked')) {
      searchParam.isPromotion = 'Y';
    } else {
      searchParam.isPromotion = undefined;
    }
    // tag
    var tag = $('#tags a.on');
    if (tag.length) {
      searchParam.tag = tag.attr('data-tag');
    } else {
      searchParam.tag = undefined;
    }
    // 其他条件
    var filterBanner = $('.sx-kw'), filterSelected = false;
    filterBanner.html('').hide();
    if (filterContext.classId) {
      _addToSelectedFilter('classId', filterContext.className);
      searchParam.classId = filterContext.classId;
      filterSelected = true;
    } else {
      searchParam.classId = undefined;
    }
    if (filterContext.originId) {
      _addToSelectedFilter('originId', filterContext.originName);
      searchParam.originId = filterContext.originId;
      filterSelected = true;
    } else {
      searchParam.originId = undefined;
    }
    if (filterContext.categoryIdLevel1) {
      _addToSelectedFilter('categoryIdLevel1', filterContext.categoryName);
      searchParam.categoryIdLevel1 = filterContext.categoryIdLevel1;
      filterSelected = true;
    } else {
      searchParam.categoryIdLevel1 = undefined;
    }
    if (filterContext.brandId) {
      _addToSelectedFilter('brandId', filterContext.brandName);
      searchParam.brandId = filterContext.brandId;
      filterSelected = true;
    } else {
      searchParam.brandId = undefined;
    }
    if (filterSelected) {
      $('<a href="javascript:void(0)" class="clearAll">清空</a>').on('click', productFilterClearAll).appendTo(filterBanner);
      filterBanner.show();
    }
    window.history.back();
    setTimeout(searchRefresh, 100);
  });

  // 品牌选择 #pageBrand
  $("#braBtn").on(CLICK_EVT, function(evt) {
    evt.preventDefault();
    $(this).find("i").removeClass("ico");
    window.location.hash = '#brand';
  });
  $(".bra-list li").click(function() {
    $(this).addClass("on").siblings().removeClass("on");
  });
  $('.brsure').click(function() {
    var el = $('.bra-list li.on a');
    if (el.length) {
      var type = el.attr('data-type'),
          id = el.attr('data-id'),
          label = el.text();
      _productFilterChanged(type, id, label, false);
      $('#braHtml').html(label);
    } else {
      filterContext['brandId'] = undefined;
      $('#braHtml').html('');
    }
    window.history.back();
  });

  function _productFilterChanged(type, id, label, remove) {
    switch (type) {
      case 'class':
        if (remove) {
          filterContext['classId'] = undefined;
        } else {
          filterContext['classId'] = id;
          filterContext.className = label;
        }
        break;
      case 'origin':
        if (remove) {
          filterContext['originId'] = undefined;
        } else {
          filterContext['originId'] = id;
          filterContext.originName = label;
        }
        break;
      case 'category':
        if (remove) {
          filterContext['categoryIdLevel1'] = undefined;
        } else {
          filterContext['categoryIdLevel1'] = id;
          filterContext.categoryName = label;
        }
        break;
      case 'brand':
        if (remove) {
          filterContext['brandId'] = undefined;
        } else {
          filterContext['brandId'] = id;
          filterContext.brandName = label;
        }
        break;
      case 'tag':
        if (remove) {
          filterContext['tag'] = undefined;
        } else {
          filterContext['tag'] = id;
        }
        break;
    }
  }

  var jqProductList = $('#productList'),
      jqLoadingLabel = $('#loadingLabel'),
      jqNoResult = $('#win-middle'),
      currentPage = 1,
      totalPages = jqProductList.length ? jqProductList.attr('data-totalPages')-0 : 0;
  $win.scroll(function(){
    var dh = $doc.height();
    var wh = $win.height();
    var st = $doc.scrollTop();
    if ((dh-wh) - st <= 30) scrollLoad();
  });
  // 下拉加载内容
  function scrollLoad() {
    if (currentPage >= totalPages) return;
    _searchAjax(false, function(html, searchResultKey) {
      jqProductList.append(html);
      var pageParam = JSON.parse($('#' + searchResultKey).val());
      currentPage = pageParam.pageNumber;
      totalPages = pageParam.totalPages;
      if (currentPage >= totalPages) jqLoadingLabel.html('已显示全部内容');
    });
  }
  // 搜索条件变动，重新加载内容
  function searchRefresh() {
    _searchAjax(true, function(html, searchResultKey) {
      jqProductList.html(html);
      var pageParam = JSON.parse($('#' + searchResultKey).val());
      currentPage = pageParam.pageNumber;
      totalPages = pageParam.totalPages;
      jqLoadingLabel.html(currentPage < totalPages ? '加载中...' : '已显示全部内容');
      if (!pageParam.totalCount) {
        // 没有搜索结果
        jqProductList.hide();
        jqLoadingLabel.hide();
        jqNoResult.show();
      } else if (jqNoResult.css('display') !== 'none') {
        // 之前没有搜索结果，现在有了
        jqProductList.show();
        jqLoadingLabel.show();
        jqNoResult.hide();
      }
    });
  }

  var searchInProgress = false;
  function _searchAjax(fullLoad, successCallback) {
    if (searchInProgress) return;
    searchInProgress = true;
    if (fullLoad) {
      searchParam.start = 0;
      ShopPopup.popupLoading('加载中...');
    } else {
      searchParam.start += searchParam.size;
    }
    var searchResultKey = _nextSearchResultKey();
    searchParam.key = searchResultKey;
    $.ajax({
      method: 'POST',
      url: '/wap/search',
      data: _getSearchParamWithFallback()
    }).done(function(html) {
      searchInProgress = false;
      if (fullLoad) ShopPopup.popupLoadingClose();
      if (successCallback) successCallback(html, searchResultKey);
    }).fail(function() {
      searchInProgress = false;
      if (fullLoad) ShopPopup.popupLoadingClose();
      ShopPopup.toastError('加载失败');
    });
  }

  var id = 0;
  function _nextSearchResultKey() {
    return '_sr_' + (++id);
  }
  // LxC(2016-03-16): 如果页面一开始就限定了部分搜索条件，即使用户点“x”去掉了，也要加到搜索条件上
  function _getSearchParamWithFallback() {
    for (var key in searchParamFallback) {
      if (!searchParam[key] && searchParamFallback[key]) {
        searchParam[key] = searchParamFallback[key];
      }
    }
    return searchParam;
  }

  var prevHash = '';
  function handleHashChange() {
    var hash = window.location.hash;
    if (hash === '#filter') {
      $('#pageSearch').hide();
      $('#fixedNav').hide();
      $('#pageFilter').show();
      $('#pageBrand').hide();
      if (prevHash !== '#brand') {
        // init
        filterContext = $.extend({}, searchParam);
        // 打开页面的时候，重置页面上之前选中的值
        _resetSubPages();
      }
    } else if (hash === '#brand') {
      $('#pageSearch').hide();
      $('#fixedNav').hide();
      $('#pageFilter').hide();
      $('#pageBrand').show();
      // init page -> 见上面，放在前一个页面初始化里面了
    } else {
      $('#pageSearch').show();
      $('#fixedNav').show();
      $('#pageFilter').hide();
      $('#pageBrand').hide();
    }
    prevHash = hash;
  }

  // 打开页面的时候，重置页面上之前选中的值
  function _resetSubPages() {
    var list, i, el;
    $('.sxtit i').removeClass('ico');
    $('.sxtit').siblings('.sx-condit').hide();
    list = $('#productClasses a');
    list.removeClass('on');
    if (filterContext.classId) {
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == filterContext.classId) {
          el.addClass('on');
          filterContext.className = el.text();
          break;
        }
      }
    }
    list = $('#productOrigins a');
    list.removeClass('on');
    if (filterContext.originId) {
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == filterContext.originId) {
          el.addClass('on');
          filterContext.originName = el.text();
          break;
        }
      }
    }
    list = $('#productCategories a');
    list.removeClass('on');
    if (filterContext.categoryIdLevel1) {
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == filterContext.categoryIdLevel1) {
          el.addClass('on');
          filterContext.categoryName = el.text();
          break;
        }
      }
    }
    // 品牌比较特殊，因为在另外一个页面，不过也放在这里初始化掉了
    $('.bra-list li.on').removeClass('on');
    list = $('.bra-list a');
    list.removeClass('on');
    if (filterContext.brandId) {
      for (i = 0; i < list.length; ++i) {
        el = list.eq(i);
        if (el.attr('data-id') == filterContext.brandId) {
          el.parents('li').addClass('on');
          filterContext.brandName = el.text();
          $('#braHtml').text(el.text());
          break;
        }
      }
    } else {
      $('#braHtml').text('');
    }
  }
});

function doSearch() {
  var searchInput = $('#searchInput'), q = searchInput.val().trim();
  if (!q) {
    q = searchInput.attr('placeholder');
    searchInput.val(q);
  }
  window.location.href = 'search.html?q=' + encodeURIComponent(q);
}

function openFilterPage() {
  window.location.hash = '#filter';
}
