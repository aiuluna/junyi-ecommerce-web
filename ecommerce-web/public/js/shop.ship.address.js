//验证
function validateIdCard() {
  var vcity = {
    11:"北京",12:"天津",13:"河北",14:"山西",15:"内蒙古",21:"辽宁",22:"吉林",23:"黑龙江",31:"上海",32:"江苏",
    33:"浙江",34:"安徽",35:"福建",36:"江西",37:"山东",41:"河南",42:"湖北",43:"湖南",44:"广东",45:"广西",46:"海南",50:"重庆",
    51:"四川",52:"贵州",53:"云南",54:"西藏",61:"陕西",62:"甘肃",63:"青海",64:"宁夏",65:"新疆",71:"台湾",81:"香港",82:"澳门",91:"国外"
  };

  var checkCard = function(obj) {
    //校验长度，类型
    if (isCardNo(obj) === false) {
      return false;
    }
    //检查省份
    if (checkProvince(obj) === false) {
      return false;
    }
    //校验生日
    if (checkBirthday(obj) === false) {
      return false;
    }
    //检验位的检测
    if (checkParity(obj) === false) {
      return false;
    }
    return true;
  };


  //检查号码是否符合规范，包括长度，类型
  var isCardNo = function(obj) {
    //身份证号码为15位或者18位，15位时全为数字，18位前17位为数字，最后一位是校验位，可能为数字或字符X
    var reg = /(^\d{15}$)|(^\d{17}(\d|X)$)/;
    if (reg.test(obj) === false) {
      return false;
    }
    return true;
  };

  //取身份证前两位,校验省份
  var checkProvince = function(obj) {
    var province = obj.substr(0, 2);
    if (!vcity[province]) {
      return false;
    }
    return true;
  };

  //检查生日是否正确
  var checkBirthday = function(obj) {
    var len = obj.length,
      arr_data, year, month, day, birthday;
    //身份证15位时，次序为省（3位）市（3位）年（2位）月（2位）日（2位）校验位（3位），皆为数字
    if (len == '15') {
      var re_fifteen = /^(\d{6})(\d{2})(\d{2})(\d{2})(\d{3})$/;
      arr_data = obj.match(re_fifteen);
      year = arr_data[2];
      month = arr_data[3];
      day = arr_data[4];
      birthday = new Date('19' + year + '/' + month + '/' + day);
      return verifyBirthday('19' + year, month, day, birthday);
    }
    //身份证18位时，次序为省（3位）市（3位）年（4位）月（2位）日（2位）校验位（4位），校验位末尾可能为X
    if (len == '18') {
      var re_eighteen = /^(\d{6})(\d{4})(\d{2})(\d{2})(\d{3})([0-9]|X)$/;
      arr_data = obj.match(re_eighteen);
      year = arr_data[2];
      month = arr_data[3];
      day = arr_data[4];
      birthday = new Date(year + '/' + month + '/' + day);
      return verifyBirthday(year, month, day, birthday);
    }
    return false;
  };

  //校验日期
  var verifyBirthday = function(year, month, day, birthday) {
    var now = new Date();
    var now_year = now.getFullYear();
    //年月日是否合理
    if (birthday.getFullYear() == year && (birthday.getMonth() + 1) == month && birthday.getDate() == day) {
      //判断年份的范围（3岁到100岁之间)
      var time = now_year - year;
      if (time >= 0 && time <= 130) {
        return true;
      }
      return false;
    }
    return false;
  };

  //校验位的检测
  var checkParity = function(obj) {
    //15位转18位
    obj = changeFivteenToEighteen(obj);
    var len = obj.length;
    if (len == '18') {
      var arrInt = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
      var arrCh = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
      var cardTemp = 0,
        i, valnum;
      for (i = 0; i < 17; i++) {
        cardTemp += obj.substr(i, 1) * arrInt[i];
      }
      valnum = arrCh[cardTemp % 11];
      if (valnum == obj.substr(17, 1)) {
        return true;
      }
      return false;
    }
    return false;
  };

  //15位转18位身份证号
  var changeFivteenToEighteen = function(obj) {
    if (obj.length == '15') {
      var arrInt = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
      var arrCh = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
      var cardTemp = 0,
        i;
      obj = obj.substr(0, 6) + '19' + obj.substr(6, obj.length - 6);
      for (i = 0; i < 17; i++) {
        cardTemp += obj.substr(i, 1) * arrInt[i];
      }
      obj += arrCh[cardTemp % 11];
      return obj;
    }
    return obj;
  };

  return {
    validate: checkCard
  };
}

var ShopShipAddress = function($){
  "use strict";

  function validateAddress($dialog) {

    $('input,textarea', $dialog).trigger('address.validate');
    $('#js_addr_select', $dialog).trigger('address.validate');
    return $('td.tdHold', $dialog).length <= 0;
  }

  function initFieldValidation($context) {
    var fields = [{
      selector: '.cName',
      required: true
    }, {
      selector: '.cPhone',
      required: true,
      validator: function(val) {
        return /^1[34578]{1}\d{9}$/.test(val);
      }
    }, {
      selector: '.cAdd'
    }, {
      selector: '.cID',
      required: true,
      validator: function(val) {
        return validateIdCard().validate(val);
      }
    }, {
      selector: '.js-zip-code',
      required: false,
      validator: function (val) {
        return !val || (val && /^\d{6}$/.test(val));
      }
    }, {
      selector: '.js-phone-zone',
      group: '.js-phone',
      required: false,
      validator: function (val) {
        return !val || (val && /^\d{3,4}$/.test(val));
      }
    }, {
      selector: '.js-phone-number',
      group: '.js-phone',
      required: false,
      validator: function (val) {
        return !val || (val && /^\d{7,8}$/.test(val));
      }
    }, {
      selector: '.js-phone-ext',
      group: '.js-phone',
      required: false,
      validator: function (val) {
        return !val || (val && /^\d{0,4}$/.test(val));
      }
    }
    ];

    var success = function($field, v) {
      var $group = $(v.group, $context);
      if($group) {
        $field.addClass('success');
        var success = $(v.group+'.success', $context);
        if(success.length == $group.length) {
          $field.parent().removeClass("tdHold");
        }
      } else {
        $field.parent().removeClass("tdHold");
      }
    };
    var fail = function($field) {
      $field.removeClass('success');
      $field.parent().addClass("tdHold");
      // $field.focus();
    };
    var validate = function($field, v) {
      var val = $field.val();
      if ($.trim(val)) {
        if (v.validator) {
          if (v.validator($.trim(val))) {
            success($field, v);
          } else {
            fail($field);
          }
        } else {
          success($field, v);
        }
      } else {
        if (v.required == false) {
          success($field, v);
        } else {
          fail($field);
        }
      }
    };

    $.each(fields, function(i, v) {
      var $field = $(v.selector, $context);
      var validator = function() {
        validate($field, v);
      };
      $field.on('blur', validator);
      $field.on('keyup', validator);
      $field.on('address.validate', validator);
    });
  }

  function initAddressSelect(data) {
    var $jsAddrSelect = $('#js_addr_select');
    $jsAddrSelect.address({
      state: '.js-addr-province',
      city: '.js-addr-city',
      county: '.js-addr-county',
      initUrl: '/member/region/list',
      updateUrl: '/member/region/item/{id}',
      urlParam: '{id}',
      paramName: 'parentId',
      addrValue: {
        state: data.provinceId || -1,
        city: data.cityId || -1,
        county: data.countyId || -1
      }
    });
    var vldr = $jsAddrSelect.data('$address');
    vldr.onValidationFail(function($field) {
      $field.css('borderColor', 'red');
    });
    vldr.onValidationPass(function($field) {
      $field.css('borderColor', '#e5e5e5');
    });

    $jsAddrSelect.on('address.validate', function() {
      var passed = vldr.validateAddress();
      if (passed) {
        $jsAddrSelect.closest('td').removeClass('tdHold');
      } else {
        $jsAddrSelect.closest('td').addClass('tdHold');
      }
    });
    $jsAddrSelect.on('change.address', function(event, $addr, val) {
      var id = val.id;
      $jsAddrSelect.closest('td').removeClass('tdHold');
      if (id != -1) {
        $addr.css('borderColor', '#e5e5e5');
      }
    });
  }

  return {
    validateAddress: validateAddress,
    initAddressSelect: initAddressSelect,
    initFieldValidation: initFieldValidation
  };

}(jQuery);