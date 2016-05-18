$(function() {
  // 商品主图轮播
  TouchSlide({
    slideCell:"#focus",
    titCell:".hd ul",
    mainCell:".bd ul",
    effect:"left",
    autoPlay:true,
    autoPage:true,
    switchLoad:"_src"
  });
  // shortDescription 收起/展开全部
  if ($('.dtline4').height() > 60) {
    doSlideUp();
    $(".sildedown").click(doSlideDown);
    $(".sildeup").click(doSlideUp);
  } else {
    $(".sildeup").hide();
  }
  // 显示抢购显示倒计时
  installCountdownCtrls();
  // 收藏
  $(".dt-collect").click(function() {
    var $this = $(this);
    if ($this.hasClass('on')) {
      removeFromFavorite($this);
    } else {
      addToFavorite($this);
    }
  });
  // 加入购物车
  $(".enterCart").click(function() {
    var $this = $(this), skuId = $this.attr('data-rel');
    addToCart(skuId, 1, function(cartCount) {
      $('.dt-cart i').html(cartCount).show();
    });
  });
  // 立即购买
  $(".buybtn").click(function() {
    var skuId = $(".enterCart").attr('data-rel');
    ShopPopup.popupLoading('页面跳转中...');
    addToCart(skuId, 1,
      function(cartCount) {
        ShopPopup.popupLoadingClose();
        window.location.href = 'cart.html';
      },
      function(message) {
        ShopPopup.popupLoadingClose();
        if (!message || (typeof message !== 'string')) message = '网络错误，请稍后重试';
        ShopPopup.alert(message);
      }
    );
  });
});

function doSlideDown() {
  var el = $(".sildedown");
  el.siblings(".sildeup").show();
  el.siblings(".dtline4").css({
    "height": "auto",
    "overflow": "auto",
    "display": "block"
  });
  el.hide();
}
function doSlideUp() {
  var el = $(".sildeup");
  el.siblings(".sildedown").show();
  el.siblings(".dtline4").css({
    "height": "60px",
    "overflow": "hidden",
    "display": "-webkit-box"
  });
  el.hide();
}

// 收藏
var collectInProcess = false;
function addToFavorite(jqEl) {
  if (collectInProcess) return;
  collectInProcess = true;

  var rels = jqEl.attr('data-rel').split(':');
  $.ajax({
    method: 'POST',
    url: '/user/favorite/add',
    data: {
      skuId: rels[0],
      salePrice: rels[1]
    },
    dataType: 'json'
  }).done(function(json) {
    if (json.success) {
      var favoriteId = json.data.id;
      jqEl.addClass('on').attr('data-fav', favoriteId);
    }
    collectInProcess = false;
  }).fail(function(xhr) {
    if (xhr.status === 401) {
      // 跳转到登录页面
      window.location.href = 'passport-login.html';
    }
    collectInProcess = false;
  });
}
// 取消收藏
var beCollectInProcess = false;
function removeFromFavorite(jqEl) {
  if (beCollectInProcess) return;
  beCollectInProcess = true;

  var favoriteId = jqEl.attr('data-fav');
  $.ajax({
    method: 'POST',
    url: '/user/favorite/delete',
    data: {
      favoriteId: favoriteId
    },
    dataType: 'json'
  }).done(function(json) {
    if (json.success) {
      jqEl.removeClass('on').attr('data-fav', '');
    }
    beCollectInProcess = false;
  }).fail(function(xhr) {
    if (xhr.status === 401) {
      // 跳转到登录页面
      window.location.href = 'passport-login.html';
    }
    beCollectInProcess = false;
  });
}

// 加入购物车
function addToCart(skuId, quantity, successCallback, errorCallback) {
  $.ajax({
    method: 'POST',
    url: '/cart/product/add',
    data: {
      skuId: skuId,
      quantity: quantity
    },
    dataType: 'json'
  }).done(function(json) {
    if (json.success) {
      if (successCallback) successCallback(json.data);
    } else {
      if (errorCallback) errorCallback(json.error.message);
    }
  }).fail(function(xhr) {
    if (errorCallback) errorCallback(xhr.status);
  });
}