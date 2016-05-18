$(function() {
	// 新品推荐
	$(".id-list li:first-child").css("border-left-width", "1px");  // 为了兼容低版本IE
	$(".id-new li:first-child").css("width", "220px");  // 为了兼容低版本IE
	$(".id-list li").mouseover(function() {
		$(this).css({
			"border-left-width": "1px",
			"border-color": "#ff5252"
		});
		$(this).prev().css("border-right-width", "0");
	}).mouseout(function() {
		$(this).css({
			"border-left-width": "0",
			"border-color": "#e5e5e5"
		});
		$(this).prev().css("border-right-width", "1px");
	});
	$(".id-list li:first-child").mouseout(function() {
		$(this).css("border-left-width", "1px");
	});
	// 本周活动
	$(".this-list li:odd").css("margin-left", "10px");  // 为了兼容低版本IE
	// 限时抢购
	$(".limit-buy li").hover(function() {
		$(this).toggleClass("lmOn");
	});
	$(".flash-sale-countdown").each(function() {
		var jqEl = $(this);
		new CountdownCtrl(jqEl, jqEl.attr('data-deadline')-0, handleFlashSaleCompleted, {
				deadlineMsg: '限时抢购已结束',
				currentTimeMillis: jqEl.attr('data-current')-0
			}).start();
	});
	// 加入购物车
	addToCartInit(function(btn) {
		return btn.parent().parent().find('img.lazy').attr('src');
	});
});

function handleFlashSaleCompleted(jqEl) {
	jqEl.parents('.section').find('.buy-cart-btn').html('<span class="cant-cart">&nbsp;</span>');
}