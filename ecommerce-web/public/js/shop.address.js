+(function($){
  var defaults = {
    state: '',
    city:'',
    county: '',
    initUrl:'',
    updateUrl: '',
    urlParam: ':id',
    addrValue: {state: -1, city: -1, county: -1}
  };
  var TYPE_KEY = '$addrType';
  var VALUE_KEY = '$addrValue';
  var LAST_KEY = '$addrLast';
  var NEXT_KEY = '$addrNext';
  var NO_VALIDATE_KEY = '$addrNoValidate';

  function Address(opt) {
    var $container = this.$container = opt.container;
    var $county = this.$county = $(opt.county, $container).data(TYPE_KEY, 'county');
    var $city = this.$city = $(opt.city, $container).data(TYPE_KEY, 'city').data(NEXT_KEY, $county);
    var $state = this.$state = $(opt.state, $container).data(TYPE_KEY, 'state').data(NEXT_KEY, $city);

    // element cache
    $addressCache.push($state, $city, $county);

    $container.on('address.recover', [opt.state].join(','), function() {
      var $this = $(this);
      var legacy = $this.data(LAST_KEY);
      if (legacy) {
        $this.trigger({
          type: 'next.address',
          parentId: legacy
        });
      }
    });
    $container.on('next.address', [opt.state, opt.city, opt.county].join(','), function(event){

      var $this = $(this);
      var addrType = $this.data(TYPE_KEY);
      var parentId = event.parentId;
      var addrValue = event.addrValue || {};
      if(parentId == -1) {
        renderItems([], $this);
        triggerChanged([], $this, addrValue, addrType);
        return;
      }

      // found in store
      var parentRegion = $addressStore[parentId];
      if (parentRegion.loaded) {
        renderItems(parentRegion.subRegions, $this);
        triggerChanged(parentRegion.subRegions, $this, addrValue, addrType);
      } else {
        var data = {};
        if (opt.paramName) {
          data[opt.paramName] = parentId;
        }
        Shop.post({
          url: opt.urlParam ? opt.updateUrl.replace(opt.urlParam, parentId) : opt.updateUrl,
          data: data,
          success:function(json) {
            // mark loaded
            parentRegion.loaded = true;
            parentRegion.subRegions = json.data;
            if (json.data && json.data.length) {
              $.each(json.data, function(i, v) {
                $addressStore[v.id] = v;
              });
            }

            renderItems(json.data, $this);
            triggerChanged(json.data, $this, addrValue, addrType);
          },
          error: function() {
            $state.trigger({
              type: 'address.recover'
            });
            ShopAlert.alert('出错了', '数据加载出错了');
          }
        });
      }

      return this;
    });

    $container.on('click', 'p', function() {
      var $item = $(this).closest('.m_zlxg');
      var type = $item.data(TYPE_KEY);
      $.each($addressCache, function(i, v) {
        var $v = $(v);
        if ($v.data(TYPE_KEY) !== type) {
          $('.m_zlxg2', $v).hide().data('expand', false);
        }
      });
      var $list = $item.find('.m_zlxg2');
      expandList($list, !$list.data('expand'));

      return false;
    });

    $container.on('click', 'li', function(event) {
      var $this = $(this);
      var id = $this.attr('value');
      var text = $this.text();

      var $addr = $this.closest('.m_zlxg');
      expandList($addr.find('.m_zlxg2'), false);
      var addrValue = event.addrValue || {};
      var currValue = $addr.data(VALUE_KEY) || {};

      if (!currValue.id || currValue.id != id) {
        $('.on', $this.parent()).removeClass('on');
        $this.addClass('on');
        $('p', $addr).attr('title', text).text(text);
        $addr.data(LAST_KEY, $addr.data(VALUE_KEY));
        $addr.data(VALUE_KEY, {id: id, name: text});
        $container.trigger('change.address', [$addr, $addr.data(VALUE_KEY)]);
      }

      $container.trigger('pass.validate.address', [$addr]);
      if ($addr.data(NEXT_KEY)) {
        $addr.data(NEXT_KEY).trigger({
          type: 'next.address',
          parentId: id,
          addrValue: addrValue
        });
      }
      return false;
    });

    function renderItems (arr, $addr) {
      var $ul = $('.m_zlxg2 ul', $addr), html = [];

      $addr.data(VALUE_KEY, null);
      $addr.data(NO_VALIDATE_KEY, arr.length == 0);


      $ul.empty().html('');
      $('p', $addr).attr('title', '').text('');
      renderDefault(html, $addr);
      if (arr && arr.length) {
        $.each(arr, function(i, v){
          html[html.length] = '<li value="'+ v.id + '">' + v.name +'</li>';
        });
      }
      $ul.empty().html(html.join(''));
    }

    function renderDefault(html, $addr) {
      switch ($addr.data(TYPE_KEY)) {
        case 'state':
          html.push('<li value="-1">' + '请选择省份' +'</li>');
          break;
        case 'city' :
          html.push('<li value="-1">' + '请选择城市' +'</li>');
          break;
        case 'county' :
          html.push('<li value="-1">' + '请选择县区' +'</li>');
          break;
      }
    }
    function triggerChanged(arr, $addr, val, type) {
      var $li;
      if (val[type]) {
        $li = $('li[value=' + val[type] + ']', $addr);
        if ($li && $li.length) {
          $li.trigger({ type:'click', addrValue: val });
          return;
        }
      } else {
        if (arr && arr.length === 1){
          $li = $('li[value=' + arr[0].id + ']', $addr);
          if ($li && $li.length) {
            $li.trigger({ type:'click', addrValue: val });
            return;
          }
        }
      }

      $li = $('li:first', $addr);
      if ($li && $li.length) {
        $li.trigger({ type:'click', addrValue: val });
      }
    }

    // load address
    Shop.post({
      url: opt.initUrl,
      success: function(json) {
        // mark loaded
        $.each(json.data, function(i,v){
          $addressStore[v.id] = v;
        });

        renderItems(json.data, $state);
        triggerChanged(json.data, $state, opt.addrValue, 'state')
      },
      error: function() {
        ShopAlert.alert('出错啦', '数据加载出错啦, 请重新刷新页面');
      }
    });
  }

  Address.prototype.setAddress = function(p) {
    var self = this, val = (p || {});
    var stateId = val.state;
    if (stateId) {
      var $li = $('li[value=' + stateId + ']', self.$state);
      if ($li && $li.length) {
        $li.trigger({type:'click', addrValue: val});
      }
    }
  };
  Address.prototype.getAddress = function() {
    var self = this;
    var stateVal = self.$state.data(VALUE_KEY);
    var cityVal = self.$city.data(VALUE_KEY);
    var countyVal = self.$county.data(VALUE_KEY);
    return {
      state: stateVal && stateVal.id && stateVal.id != -1 ? stateVal : '',
      city: cityVal && cityVal.id && cityVal.id != -1 ? cityVal : '',
      county: countyVal && countyVal.id && countyVal.id != -1 ? countyVal : ''
    };
  };

  Address.prototype.onValidationPass = function(func) {
    var self= this;
    self.$container.on('pass.validate.address', function(event, target){
      if (typeof func == 'function') {
        func(target);
      }
    });

  };
  Address.prototype.onValidationFail = function(func) {
    var self= this;
    self.$container.on('fail.validate.address', function(event, target){
      if (typeof func == 'function') {
        func(target);
      }
    });

  };

  Address.prototype.validateAddress = function(cb, rb) {
    var self = this, $container = self.$container;
    var arr = [self.$state, self.$city, self.$county];
    var passed = true;
    $.each(arr, function(i, v) {
      var val = v.data(VALUE_KEY);
      var ignore = v.data(NO_VALIDATE_KEY);
      if (val.id != -1 || (passed && ignore)) {
        $container.trigger('pass.validate.address', [v]);
      } else {
        passed = passed && false;
        $container.trigger('fail.validate.address', [v]);
      }
    });
    return passed;
  };

  function address(opt) {
    if (opt.container.data('$address')) {
      return opt.container.data('$address');
    }
    var addr = new Address(opt);
    opt.container.data('$address', addr);
    return addr;
  }

  function expandList($list, toggle) {
    if ($list && $list.length) {
      $list[toggle ? 'show' : 'hide']().data('expand', toggle ? true : false);
    }
  }
  function handler(event) {
    var $this = $(event.target);
    var $addr = $this.parent('.m_zlxg');
    if (!($addr && $addr.length > 0) ) {
      $.each($addressCache, function() {
        expandList($('.m_zlxg2', $(this)), false);
      });
    }
  }

  function bindEvents() {
    $(document.body).off('click', handler);
    $(document.body).on('click', handler);
  }

  var $addressCache = [];
  var $addressStore = {};
  $.fn.address = function(options){
    options = $.extend(defaults, options);
    this.each(function(i, form){
      options.container = $(form);
      address(options);
    });
    bindEvents();
    return this;
  }

})(jQuery);
