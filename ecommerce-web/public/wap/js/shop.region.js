var RegionUtil = function () {
  var $province, $city, $county;
  var init = function (opt) {
    $province = $(opt.province);
    $city = $(opt.city);
    $county = $(opt.county);

    $province.on('change', function () {
      var $elem = $(this);
      var parentId = $elem.val();
      children(parentId, 'city');
    });

    $city.on('change', function () {
      var $elem = $(this);
      var parentId = $elem.val();
      children(parentId, 'county');
    });
  };

  var setAddress = function (opt) {
    opt = opt || {};
    $province.data('id', opt.province || -1);
    $city.data('id', opt.city || -1);
    $county.data('id', opt.county || -1);
    provinces();
  };

  function removeOptions($element) {
    $element.find('option').filter(function (index) {
      return index > 0;
    }).remove();
  }

  var generateSelect = function ($element, data) {
    removeOptions($element);
    data.forEach(function (item) {
      var option = $('<option>')
        .attr('value', item.id)
        .text(item.name).appendTo($element);
    });
    var id = $element.data('id') || -1;
    $element.find('option[value=' + id + ']').attr("selected", "selected");
    $element.data('id', ''); //remove the value
    $element.trigger('change');
  };

  function provinces() {
    var success = function (result) {
      generateSelect($province, result.data);
    };
    var opt = {
      url: '/member/region/list',
      success: success
    };
    Shop.post(opt);
  }

  function children(parentId, isCity) {

    var $elem;
    if (isCity === 'city') {
      $elem = $city;
    } else {
      $elem = $county;
    }

    if (!parentId) {
      removeOptions($elem);
      $elem.trigger('change');
      return;
    }

    var success = function (result) {
      generateSelect($elem, result.data);
    };
    var opt = {
      url: '/member/region/item/' + parentId,
      success: success
    };
    Shop.post(opt);
  }

  function allSelected() {
    var $elems = [$province, $city, $county];

    var allSelected = true;
    $.each($elems, function (index, $elem) {
      var id = $elem.val();
      var op_length = $elem.find('option').length;
      if (!id && op_length > 1) {
        allSelected =  false;
      }
    });
    return allSelected;
  }

  function getRegion(data, $elem, regionId, regionName) {
    var $option = $elem.find('option:selected');
    data[regionId] = $option.val();
    data[regionName] = $option.text();
    return data;
  }

  function getAddress() {
    var data = {};
    if (allSelected()) {
      getRegion(data, $province, "provinceId", "provinceName");
      getRegion(data, $city, "cityId", "cityName");
      getRegion(data, $county, "countyId", "countyName");
    }
    return data;
  }

  return {
    init: init,
    setAddress: setAddress,
    provinces: provinces,
    children: children,
    allSelected: allSelected,
    getAddress: getAddress
  }
}();


