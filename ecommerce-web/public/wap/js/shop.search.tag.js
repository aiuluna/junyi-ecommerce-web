var SearchUtil = function () {
  var init = function (opt) {
    var list = opt.list,
      query = opt.query,
      clearAll = opt.clearAll,
      searchBtn = opt.searchBtn,
      searchViewBtn = opt.searchView,
      searchOpt = opt.searchOpt,
      searchWrapper = opt.searchWrapper,
      listTitle = opt.listTitle,
      searchTitle = opt.searchTitle;

    searchBtn.on('click', function () {
      SearchUtil.addKeys(searchWrapper, searchOpt);
      ShopScroll.reload();
      historyBack();
    });

    clearAll.on('click', function () {
      SearchUtil.clear(searchWrapper, query);
      ShopScroll.reload();
    });

    searchViewBtn.on('click', function () {
      window.location.hash = '#bind';
    });

    searchWrapper.on('click', '.closeico', function () {
      var span = $(this).parent();
      var searchId = span.data('searchId');
      SearchUtil.remove(searchId);
      span.remove();
      if (searchWrapper.find('.closeico').length === 0) {
       SearchUtil.clear(searchWrapper, query);
      }
      ShopScroll.reload();
    });

    var doSearch = function () {
      list.hide();
      query.show();
      listTitle.hide();
      searchTitle.show();
      searchViewBtn.hide();

    };
    var doList = function () {
      query.hide();
      list.show();
      searchTitle.hide();
      listTitle.show();
      searchViewBtn.show();
    };

    function pageOnHashChanged() {
      var hash = window.location.hash;
      if (hash === '') {
        doList();
      } else if (hash === '#bind') {
        doSearch();
      }
    }
    $(window).on('hashchange', pageOnHashChanged);
    pageOnHashChanged();

  };

  var collectData = function (opt) {
    var data = {};
    for (var key in opt) {
      var value = $(opt[key]).val();
      if (value) {
        data[key] = value;
      }
    }
    return data;
  };

  var addKeys = function ($elem, opt) {
    var data = SearchUtil.collect(opt);
    var keyElems = [];
    for (var key in data) {
      var value = data[key];
      if (value) {
        var span = $('<span>');
        $('<i class="key">' + value + '</i>').data('key', key).appendTo(span);
        $('<a href="javascript:void(0);" class="closeico">&times;</a>').appendTo(span);
        span.data('searchId', opt[key]);
        keyElems.push(span);

      }
    }
    $elem.find('span').remove();
    if (keyElems.length) {
      keyElems.forEach(function (span) {
        span.appendTo($elem);
      });
      $elem.parent().show();
    }

  };
  var getKeys = function ($elem) {
    var param = {};
    $.each($elem.find('.key'), function () {
      var key = $(this).data('key');
      var value = $(this).text();
      var data = {};
      data[key] = value;
      param = $.extend(param, data);
    });
    return param;
  };

  var clear = function ($elem, $query) {
    $elem.html('');
    $elem.parent().hide();
    $query.find('input').val('');
  };

  var remove = function (searchId) {
    $(searchId).val('');
  };


  return {
    collect:  collectData,
    addKeys:  addKeys,
    getKeys:  getKeys,
    clear:    clear,
    remove:   remove,
    init:     init
  };
}();


