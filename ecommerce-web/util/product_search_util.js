var Q = require('q'),
    http_util = require('./http_util'),
    common_data = require('../common_data');

module.exports = {
	hasSearchParam: hasSearchParam,
  isEmptySearchParam: isEmptySearchParam,
  collectSearchParam: collectSearchParam,
  calcSearchStart: calcSearchStart,
  emptyPageInfo: emptyPageInfo,
  initSearch: initSearch,
  constructSearchFilter: constructSearchFilter
};

var searchFieldsIntrinsic = ['originId', 'brandId', 'categoryIdLevel1', 'classId'];

/**
 * check all params defined in {@link #searchFieldsIntrinsic} is empty or not
 * @param param param object
 * @returns {boolean} true if all are empty
 */
function _hasSearchParam(param) {
  var field, value;
  for (var i = 0, len = searchFieldsIntrinsic.length; i < len; ++i) {
    field = searchFieldsIntrinsic[i];
    value = param[field];
    // has value and is not empty
    if (value && value.trim()) return true;
  }
  return false;
}

/**
 * 检查 search 页面 URL 参数是否为空(串)
 * @param req
 * @returns {boolean}
 */
function hasSearchParam(req) {
  return _hasSearchParam(req.query);
}

/**
 * 检查查询参数是否为空(当前只检查5个字段)
 * ['originId', 'brandId', 'categoryIdLevel1', 'classId', 'productName']
 * @see #searchFieldsIntrinsic
 * @param param param object from client
 * @returns {boolean} true if all are empty
 */
function isEmptySearchParam(param) {
  var productName = param.productName ? param.productName.trim() : null;
  // 4个常见变量不存在 & productName 为空(串)
  return !productName && !_hasSearchParam(param);
}

function collectSearchParam(req) {
  var filtered = {},
      query = req.query, field, value;
  for (var i = 0, len = searchFieldsIntrinsic.length; i < len; ++i) {
    field = searchFieldsIntrinsic[i];
    value = query[field];
    if (value) filtered[field] = value;
  }
  return filtered;
}

function calcSearchStart(start, size) {
  if (isNaN(start) || start <= 0) {
    return 0;
  }
  return start % size === 0 ? start : Math.floor( start / size ) * size;
}

function emptyPageInfo(size) {
  return {
    pageData: [],
    pageSize: size,
    pageNumber: 1,
    totalCount: 0,
    totalPages: 1
  };
}

/**
 * 初始化搜索的时候，如果搜索结果为空，这个方法根据传入的搜索条件判断是否要发起模糊搜索，
 * 设置<code>fulltextWildcardSearch</code> -> <code>Y</code>
 */
function initSearch(searchParam) {
  var deferred = Q.defer();
  if (typeof searchParam.fulltextWildcardSearch !== 'undefined') {
    // reset to 'N' initially
    searchParam.fulltextWildcardSearch = 'N';
  }
  http_util.request('queen', {
      method: 'POST',
      url: '/product/search',
      data: searchParam
    })
    .done(
      function(result) {
        if (result.success) {
          var page = result.data;
          if (!page.totalCount && _shouldTryFulltextWildcardSearch(searchParam.productName)) {
            // 尝试模糊搜索
            searchParam.fulltextWildcardSearch = 'Y';
            http_util.request('queen', {
                method: 'POST',
                url: '/product/search',
                data: searchParam
              })
              .done(
                function(result) {
                  _searchResultResolve(deferred, result, searchParam);
                },
                function(err) {
                  deferred.reject(err);
                }
              );
            return;
          }
        }
        _searchResultResolve(deferred, result, searchParam);
      },
      function(err) {
        deferred.reject(err);
      }
    );
  return deferred.promise;
}

function _searchResultResolve(deferred, result, searchParam) {
  if (result.success) {
    var page = result.data;
    result.data = {
      page: page,
      searchParam: searchParam
    };
  }
  deferred.resolve(result);
}

var _alphanumberRe = /^[a-zA-Z0-9]+$/;
function _shouldTryFulltextWildcardSearch(productName) {
  productName = productName ? productName.trim() : null;
  if (productName) {
    // 如果productName是连续的英文单词或者1-2个字长的中文
    if (_alphanumberRe.test(productName)) {
      return true;
    }
    if (productName.length <= 2) {
      return true;
    }
  }
  return false;
}

function constructSearchFilter(searchFilter) {
  if (!searchFilter) return {};

  var productFilter = common_data.getSiteConfig().productFilter,
      searchFilterMap = _filterAsMap(searchFilter),
      cleanSearchFilter = {};
  // 这里必须保证两边的接口一致
  ['productClasses', 'productBrands', 'productOrigins', 'productCategories'].forEach(function(key) {
    var pfv = productFilter[key], sfv = searchFilterMap[key];
    cleanSearchFilter[key] = [];
    if (pfv && pfv.length && sfv) {
      pfv.forEach(function(item){
        if (sfv[item.id]) {
          cleanSearchFilter[key].push(item);
        }
      });
    }
  });
  return cleanSearchFilter;
}

function _filterAsMap(searchFilter) {
  var map = {};
  if (searchFilter) {
    for (var p in searchFilter) {
      var arr = searchFilter[p];
      if (arr && arr.length) {
        var innerMap = {};
        arr.forEach(function(id) {
          innerMap[id] = 1;
        });
        map[p] = innerMap;
      }
    }
  }
  return map;
}
