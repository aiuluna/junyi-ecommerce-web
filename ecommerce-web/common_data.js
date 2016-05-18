var EventEmitter = require('events'),
    Q = require('q'),
    config = require('./config'),
    logger = require('./logger'),
    http_util = require('./util/http_util');

// ------------------------------------------------------------------------
// 这个模块用来缓存一些常用的信息，比如注册协议、帮助条款等
// TODO: 目前的缓存机制比较简单，实时性不是很高 (see config.cacheRefreshInterval)，
// 以后需要设计一个机制，由其他服务器推送改动 (基于redis pub/sub ?)
// ------------------------------------------------------------------------

var CACHE = {},
    EVENTS = new EventEmitter();

module.exports = {
  // events hub
  events: EVENTS,
  // init
  initialize: initialize,
  // getters
  getSiteConfig: function() {
    return CACHE.siteConfig;
  },
  getRegions: function() {
    return CACHE.regions;
  },
  getRegion: function(id) {
    return CACHE.regionsMap[id];
  },
  getOrderTtlOfPendingPay: function() {
    // 无配置 默认系统自动关闭30分钟内未支付的订单
    return CACHE.siteConfig.orderTtlOfPendingPay || 1800000;
  },
  getSiteContentConfig: function(key, isMobile) {
    return CACHE.siteConfig.siteContentConfigsMap[_idxIsMobile(isMobile)][key];
  },
  getSiteNoticeConfig: function(isMobile) {
    return CACHE.siteConfig.siteNoticeConfigs[_idxIsMobile(isMobile)];
  },
  getPageAdsSetting: function(key, isMobile) {
    return CACHE.siteConfig.pageAdsSettingsMap[_idxIsMobile(isMobile)][key];
  }
};

function initialize() {
  logger.info('[common_data] Initializing...');
  return Q.all([_initHotCache(), _initColdCache()])
    .then(function() {
      logger.info('[common_data] Initialized!');
    });
}

function _initHotCache() {
  var deferred = Q.defer();
  http_util.multiRequest(
      http_util.request('facade', '/homepage/config'),
      http_util.request('facade', '/product/filter/params'),
      http_util.request('facade', '/site/content/configs'),
      http_util.request('facade', '/site/notice/configs'),
      http_util.request('facade', '/page/ads/settings'),
      http_util.request('facade', '/config/order/ttl/pending/pay')
    )
    .spread(http_util.spreadMap('homepage', 'productFilter', 'siteContentConfigs', 'siteNoticeConfigs', 'pageAdsSettings', 'orderTtlOfPendingPay'))
    .done(
      function(result) {
        CACHE.siteConfig = _constructSiteConfig(result);
        EVENTS.emit('siteConfig');
        deferred.resolve();
      },
      function (err) {
        deferred.reject(err);
      }
    );
  _planToRefreshHotCache();
  return deferred.promise;
}

var cacheRefreshInterval = (config.cacheRefreshInterval || 30) * 1000,
    logInterval = 10 * 60 * 1000,  // 10分钟log一次，不然太频繁了
    logIntervalTicks = Math.round(logInterval / cacheRefreshInterval), tick = 0;
function _planToRefreshHotCache() {
  setTimeout(function() {
    if (tick % logIntervalTicks === 0) {
      logger.info('[common_data:%d] Start to refresh cache...', tick);
    }
    _initHotCache()
      .then(function() {
        if (tick % logIntervalTicks === 0) {
          logger.info('[common_data:%d] Cache refreshed!', tick++);
        }
      })
      .catch(function(err) {
        logger.error(err);
      });
  }, cacheRefreshInterval);
}

function _constructSiteConfig(result) {
  var homepageConfig = result.homepage,
      productFilter = result.productFilter,
      productOriginsMap = {};
  if (productFilter && productFilter.productOrigins) {
    productFilter.productOrigins.forEach(function(origin) {
      productOriginsMap[origin.id] = origin;
    });
  }

  result.brandsMap = _createBrandsMap(homepageConfig.brands, productOriginsMap);
  result.topicActivitiesMap = _createTopicActivitiesMap(homepageConfig.topicActivities);
  result.topicCategoriesMap = _createTopicCategoriesMap(homepageConfig.topicCategories);
  result.topicOriginsMap = _createTopicOriginsMap(homepageConfig.topicOrigins);
  result.homeSetting = homepageConfig.homeSetting;

  result.mobile = {
    brandsMap: _createBrandsMap(homepageConfig.mobile.brands, productOriginsMap),
    topicActivitiesMap: _createTopicActivitiesMap(homepageConfig.mobile.topicActivities),
    topicCategoriesMap: _createTopicCategoriesMap(homepageConfig.mobile.topicCategories),
    topicOriginsMap: _createTopicOriginsMap(homepageConfig.mobile.topicOrigins),
    homeSetting: homepageConfig.mobile.homeSetting
  };

  var activityMap = {};
  if (homepageConfig.activityMap) {
    for (var activityType in homepageConfig.activityMap) {
      var activities = homepageConfig.activityMap[activityType];
      var map = _createActivityMap(activities);
      activityMap[activityType] = map;
    }
  }
  result.activityMap = activityMap;

  var siteContentConfigsMap = [{}, {}];
  if (result.siteContentConfigs) {
    result.siteContentConfigs.forEach(function(config) {
      var idx = _idxIsMobile(config.isMobile === 'Y');
      siteContentConfigsMap[idx][config.type] = config;
    });
  }
  result.siteContentConfigsMap = siteContentConfigsMap;

  var pageAdsSettingsMap = [{}, {}];
  if (result.pageAdsSettings) {
    result.pageAdsSettings.forEach(function(setting) {
      var idx = _idxIsMobile(setting.isMobile === 'Y');
      pageAdsSettingsMap[idx][setting.adsType] = setting;
    });
  }
  result.pageAdsSettingsMap = pageAdsSettingsMap;

  return result;
}

function _createBrandsMap(brands, productOriginsMap) {
  var brandsMap = {};
  if (brands) {
    brands.forEach(function(brand) {
      if(brand.productBrand && brand.productBrand.originId) {
        brand.productBrand.productOrigin = productOriginsMap[brand.productBrand.originId];
      }
      brandsMap[brand.id] = brand;
    });
  }
  return brandsMap;
}

function _createTopicActivitiesMap(topicActivities) {
  var topicActivitiesMap = {};
  if (topicActivities) {
    topicActivities.forEach(function(ta) {
      topicActivitiesMap[ta.id] = ta;
    });
  }
  return topicActivitiesMap;
}

function _createTopicCategoriesMap(topicCategories) {
  var topicCategoriesMap = {};
  if (topicCategories) {
    topicCategories.forEach(function(tc) {
      topicCategoriesMap[tc.id] = tc;
    });
  }
  return topicCategoriesMap;
}

function _createTopicOriginsMap(topicOrigins) {
  var topicOriginsMap = {};
  if (topicOrigins) {
    topicOrigins.forEach(function(to) {
      topicOriginsMap[to.id] = to;
    });
  }
  return topicOriginsMap;
}

function _createActivityMap(activities) {
  var activityMap = {};
  if(activities) {
    activities.forEach(function(act) {
      activityMap[act.id] = act;
    });
  }
  return activityMap;
}

function _idxIsMobile(isMobile) {
  return isMobile ? 1 : 0;
}


// 目前只有region数据作为常量，不需要时常刷新
function _initColdCache() {
  var deferred = Q.defer();
  http_util.multiRequest(
      http_util.request('facade', '/region/list')
    )
    .spread(http_util.spreadMap('regions'))
    .done(
      function(result) {
        mapRegions(result.regions);
        EVENTS.emit('regions');
        deferred.resolve();
      },
      function (err) {
        deferred.reject(err);
      }
    );
  _planToRefreshColdCache();
  return deferred.promise;
}

function _planToRefreshColdCache() {
  setTimeout(function() {
    logger.info('[common_data] Start to refresh cold cache...');
    _initColdCache()
      .then(function() {
        logger.info('[common_data] Cold cache refreshed!');
      })
      .catch(function(err) {
        logger.error(err);
      });
  }, 60 * 60 * 1000 /* 1 hour */);
}

function mapRegions(regions) {
  var regionsMap = CACHE.regionsMap = {};
  regions.forEach(function(region) {
    regionsMap[region.id] = region;
  });
  var regionsTree = CACHE.regions = [];
  regions.forEach(function(region) {
    if (region.type === 1) regionsTree.push(region);
    if (region.parentId) {
      var parentRegion = regionsMap[region.parentId];
      if (!parentRegion) return;
      if (!parentRegion.subRegions) parentRegion.subRegions = [];
      parentRegion.subRegions.push(region);
    }
  });
}
