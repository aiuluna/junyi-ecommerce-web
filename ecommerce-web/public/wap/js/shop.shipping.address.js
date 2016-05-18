
//验证
var IdCardValidate = (function () {
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
})();

var AddressValidate = function() {
  function validateMobile(mobile) {
    return /^(1[34578])\d{9}$/.test(mobile.trim());
  }

  function validateIdCard(idCardNo) {
    return IdCardValidate.validate(idCardNo);
  }

  function validateLength(text, min, max) {
    return text && (text.length >= min) && (!max || text.length <= max);
  }

  return {
    validateMobile: validateMobile,
    validateIdCard: validateIdCard,
    validateLength: validateLength
  }
}();


var ShopShippingAddress = function() {


  var $addressListPage, $addressEditPage, $updateTitle, $addTitle, $wrapper;
  var $addressDefaultBtn;
  function init(opt) {
    $addressListPage =  opt.listPage;
    $addressEditPage = opt.editPage;
    $updateTitle = opt.updateTitle;
    $addTitle = opt.addTitle;
    $wrapper = opt.wrapper;
    RegionUtil.init({province: '#province', city: '#city', county: '#county'});
    $addressDefaultBtn = $('.js_address_default');
    $addressDefaultBtn.parent().click(function() {
      $(this).toggleClass("becon");
    });
  }

  function clearForm() {
    var $addr = $addressEditPage;
    $('input, textarea', $addr).val('');
    $addressDefaultBtn.removeClass('becon');
  }

  var _ajax = (function () {

    function updateAddress() {

      var success = function (result) {

        setTimeout(function () {
          history.back();
          if($wrapper) {
            console.log($wrapper);
            $wrapper.data('u_id', result.data.id);
          }

          ShopPopup.popupLoadingClose();
        }, 500);
      };
      var updateData = data.collect();
      if(updateData) {
        ShopPopup.popupLoading('保存中...');
        var opt = {
          data: updateData,
          url: '/member/user/address/' + (updateData.id ? 'update' : 'create'),
          success: success
        };
        Shop.post(opt);
      }
    }

    function viewAddress(id) {

      var success = function (result) {
        data.render(result.data.userShippingAddress);
      };
      var opt = {
        url: '/member/user/address/view/' + id,
        success: success
      };
      Shop.get(opt);
    }

    function removeAddress() {
      var success = function () {
        setTimeout(function () {
          history.back();
          ShopPopup.popupLoadingClose();
        }, 500);
      };
      var updateData = data.collect();
      ShopPopup.popupLoading('删除中...');
      var opt = {
        data: {id: updateData.id},
        url: '/member/user/address/delete',
        success: success
      };
      Shop.post(opt);
    }

    return {
      update: updateAddress,
      view: viewAddress,
      remove: removeAddress
    }
  })();


  var data = (function () {
    function collectData() {
      function setVal(data, dataKey, selector) {
        var val = $.trim($(selector).val());
        if (val) {
          data[dataKey] = val;
        }
      }

      var data = RegionUtil.getAddress();
      setVal(data, 'id', '.cId');
      setVal(data, 'shipTo', '.cName');
      setVal(data, 'mobile', '.cPhone');
      setVal(data, 'idCardNo', '.cIdCardNo');
      setVal(data, 'address', '.cAddr');

      data.isDefault = $('.js_address_default').hasClass('becon') ? 'Y' : 'N';

      var message = '';
      if(!data.shipTo) {
        message = "收货人必填";
      } else if(!AddressValidate.validateLength(data.shipTo, 2)) {
        message = "收货人至少两个字符";
      } else if(!data.mobile) {
        message = "手机号码必填";
      } else if(!AddressValidate.validateMobile(data.mobile)){
        message = "手机号码验证失败";
      } else if(!data.idCardNo) {
        message = "身份证号码必填";
      } else if(!AddressValidate.validateIdCard(data.idCardNo)){
        message = "身份证号码验证失败";
      } else if(!RegionUtil.allSelected()) {
        message = "所在区域信息不全";
      } else if(!data.address) {
        message = "详细地址必填";
      }
      if(message) {
        ShopPopup.toast(message);
        return;
      }
      return data;
    }

    var renderData = function (data) {
      $('.cId').val(data.id);
      $('.cName').val(data.shipTo);
      $('.cPhone').val(data.mobile);
      $('.cIdCardNo').val(data.idCardNo);
      $('.cAddr').val(data.address);

      data.isDefault === 'Y' ? $('.becico').addClass('becon') : $('.becico').removeClass('becon');

      RegionUtil.setAddress({province: data.provinceId, city: data.cityId, county: data.countyId});
    };
    return {
      collect: collectData,
      render: renderData
    }
  })();

  var view = (function () {
    function addAction() {
      ShopShippingAddress.clear();
      $updateTitle.hide();
      $addTitle.show();
      $addressListPage.hide();
      $addressEditPage.show();
      $('.js_address_update_btn').hide();
      $('.js_address_add_btn').show();
      RegionUtil.setAddress({})
    }

    function updateAction() {
      $updateTitle.show();
      $addTitle.hide();
      $addressListPage.hide();
      $addressEditPage.show();
      $('.js_address_add_btn').hide();
      $('.js_address_update_btn').show();
    }

    function listView() {
      $updateTitle.show();
      $addTitle.hide();
      $addressEditPage.hide();
      $addressListPage.show();
    }
    return {
      addView: addAction,
      updateView: updateAction,
      listView: listView
    }
  })();




  return {
    init: init,
    clear: clearForm,
    ajax: _ajax,
    view: view
  }
}();