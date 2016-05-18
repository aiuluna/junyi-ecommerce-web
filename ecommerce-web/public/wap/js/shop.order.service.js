var ShopOrderService = function($){
  "use strict";

  var selectors = {
    requestReason: {selector: '#js_service_apply_reason'},
    requestComment: {selector: '#js_service_apply_comment'},
    /*refundExpName: {selector: '#js_service_apply_express_name'},*/
    refundExpName: {selector: '#js_express_name'},
    refundExpCode: {selector: '#js_service_apply_express_code'},
    refundExpNo: {selector: '#js_service_apply_express_no'},
    imageUrl: {
      selector: '.js-service-apply-image', renderer: function (v) {
        return $.isArray(v) ? JSON.stringify(v) : JSON.stringify([v]);
      }
    }
  };

  function validateForm() {
    var $reason = $('#js_service_apply_reason');
    if ($reason.val() == '') {
      ShopPopup.toast('请选择售后原因');
      return false;
    }

    return true;
  }

  function collectInputValues ($inputs) {
    var values = [];
    $.each($inputs, function () {
      var val = $.trim($(this).val());
      if (val) {
        values[values.length] = val;
      }
    });
    return values;
  }

  function getFormData ($form) {
    var data = {};
    $.each(selectors, function (k, v) {
      var $ele = $(v.selector, $form), len = $ele.length, renderer = v.renderer || function (v) {
          return v;
        };
      if (len) {
        if (len > 1) {
          data[k] = renderer(collectInputValues($ele));
        } else {
          var val = $.trim($ele.val());
          if (val) {
            data[k] = renderer(val);
          }
        }
      } else {
        /*
         ShopAlert.alert('Error', 'No Field Found By Selector:' + v);
         */
      }
    });
    return data;
  }

  function saveFormData (orderNo) {
    ShopPopup.popupLoading('数据保存中...');
    Shop.post({
      url: '/member/order/service/apply/' + orderNo,
      data: $.extend({orderNo: orderNo}, getFormData($(document.body))),
      complete: function () {
        ShopPopup.popupLoadingClose();
      },
      success: function () {
        history.back();
      },
      error: function () {
        ShopPopup.toastError('保存数据失败啦');
      }
    });
  }

  function initSubmitBtn(uploader) {
    /* // add events for validations & file upload*/
    /* // 1. 可以选择多个图片, 统一上传*/
    /* // 2. 提示用户图片尚未上传*/

    // service apply
    $('#js_service_submit_btn').on('click', function () {
      var $this = $(this),
        orderNo = $this.data('order_no');

      if (!validateForm()) {
        return;
      }

      if (uploader.getFiles('inited').length) {
        uploader.upload();
      } else {
        saveFormData(orderNo);
      }
    });

    uploader.on('startUpload', function(){
      ShopPopup.popupLoading('凭证上传中...');
    });
    uploader.on('uploadFinished', function(){
      var btn = $('#js_service_submit_btn');
      saveFormData(btn.data('order_no'));
    });
    uploader.on('uploadSuccess', function(file, res){
      $('#js_voucher_wrapper').append('<input type="hidden" class="js-service-apply-image" value="' + res.data.url + '"/>');
    });
    uploader.on('uploadError', function(){
      uploader.stop(true);
      ShopPopup.popupLoadingClose();
      ShopPopup.toastError('上传凭证失败啦');
    });

  }

  function initServiceApply() {
    var $select = $('#js_service_reason_select');
    $select.mobiscroll().select({
      theme: 'ios',
      lang: 'zh',
      display: 'bottom',
      headerText:'请选择售后原因:',
      inputClass: 'hidden',
      mode: 'fixed',
      onBeforeClose: function(val, btn){
        if (btn == 'set') {
          $('.js-service-reason-text', $button).text(val);
          $('#js_service_apply_reason').val(val);
        }
      }
    });

    var $button = $('#js_service_reason_btn');
    $button.click(function() {
      $select.mobiscroll('show');
    });

    var uploader = WebUploader.create({

      // 选完文件后，是否自动上传。
      auto: false,

      // 文件接收服务端。
      server: '/member/image/upload/voucher',

      // 选择文件的按钮。可选。
      // 内部根据当前运行是创建，可能是input元素，也可能是flash.
      pick: {
        id: '#js_voucher_pick',
        multiple: false,
        innerHTML:'&ensp;'
      },

      // 只允许选择图片文件。
      accept: {
        title: 'Images',
        extensions: 'gif,jpg,jpeg,png',
        mimeTypes: 'image/*'
      }
    });

    var $list = $('#js_voucher_wrapper');

    $list.on('click', '.js-file-item', function() {
      var exist, $del2 = $('.js-file-del', $list);
      if ($del2.length) {
        exist = $del2.data('file_id');
        $del2.remove();
      }
      var $me = $(this), fileId = $me.data('file_id');
      if (exist && exist == fileId) {

      } else {
        var $del = $('<span class="js-file-del" style="width: 60px; height: 45px;"><a href="javascript:;" class="btnL" style="position:absolute; display: inline-block; width: 60px; height: 45px;">删除</a></span>');
        $del.data('file_id', fileId);
        $del.css({
          position: 'absolute',
          top: ($me.offset().top - $del.height()) + 'px',
          left: $me.offset().left + 'px'
        });
        $del.insertAfter($me);
      }

    }).on('click', '.js-file-del', function(){
      var $me = $(this), fileId = $me.data('file_id');
      var yes = confirm('是否删除凭证?');
      if (yes) {
        var files = uploader.getFiles('inited');
        uploader.removeFile(uploader.getFile(fileId), true);
        $me.prev('.js-file-item').remove();
        $pick.show();
      }
      $me.remove();
    });

    var $pick = $('#js_voucher_pick');
    // 当有文件添加进来的时候
    uploader.on( 'fileQueued', function( file ) {
      var $li = $('<span class="js-file-item"><img></span>'),
        $img = $li.find('img');
      $li.data('file_id', file.id);
      $pick.closest('span').before( $li );

      // 创建缩略图
      // 如果为非图片文件，可以不用调用此方法。
      // thumbnailWidth x thumbnailHeight 为 100 x 100
      uploader.makeThumb( file, function( error, src ) {
        if ( error ) {
          $img.replaceWith('<span>不能预览</span>');
          return;
        }

        $img.attr( 'src', src );
      }, 100, 100 );

      // 如果超过文件数目 >= 3
      var files = uploader.getFiles('inited');
      if (files.length >= 3) {
        $pick.hide();
      } else {
        $pick.show();
      }
    });

    initSubmitBtn(uploader);
  }



  return {

    initServiceApply: initServiceApply

  };

}(jQuery);