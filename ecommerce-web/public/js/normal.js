$(function(){
	// global: disable ajax cache for GET requests
	$.ajaxSetup({
		cache: false
	});
	// header
	$(".liMore").hover(
		function() {
			$(this).addClass("liOn");
		}, function() {
			$(this).removeClass("liOn");
		}
	);
	$(".dropDown a").hover(
		function() {
			$(this).find(".code").show();
		},
		function() {
			$(this).find(".code").hide();
		}
	);
	// 收藏本站
	$("#addToFav").click(function() {
		var url = 'http://' + location.host,
			txt = document.title.replace(/[\/:*?"<>|]/g, '');
		try {
			window.external.addFavorite(url, txt);
		} catch (e) {
			window.alert("请尝试点击 Ctrl + D 来添加！");
		}
	});
	// shopping cart
	$(".shoppingcart").hover(
		function() {
			var jqEl = $(this);
			if (!jqEl.hasClass("cartOn")) {
				$(this).addClass("cartOn");
				loadCartList();
			}
		},
		function() {
			$(this).removeClass("cartOn");
		}
	);
	requestCartProductsCount();
	// fixedNav
	var nav = $("#navigation");
	if (nav.length) {
		var fixedTop = nav.offset();
		$(window).scroll(function() {
			var scrollH = $(window).scrollTop();
			if (scrollH >= fixedTop.top) {
				$("#fixedNav").show();
			} else {
				$("#fixedNav").hide();
			}
			if (scrollH >= 200) {
				$("#goTop").fadeIn();
			} else {
				$("#goTop").fadeOut();
			}
		});
		$("#goTop").click(function() {
			var speed = 500; //滑动的速度
			$('body,html').animate({
				scrollTop: 0
			}, speed);
			return false;
		}).hide();
	}
	// footer
	$(".ftlist li:last").css("background", "none");
	// slide
	if ($.fn.slide) {
		var picScroll = $(".picScroll-left");
		if (picScroll.length) {
			picScroll.slide({
				mainCell: ".bd ul",
				autoPage: true,
				effect: "left",
				autoPlay: false,
				vis: 4,
				prevCell: ".prev",
				nextCell: ".next",
				switchLoad:"_src",
				pnLoop:false
			});
			picScroll.each(function() {
				var $this = $(this);
				if ($this.find(".picList li").length <= 4) {
					$this.find(".hd").remove();
				} else {
					$this.hover(
						function() {
							$(this).find(".hd").show();
						},
						function() {
							$(this).find(".hd").hide();
						}
					);
				}
			});
		}
		$(".fullSlide").slide({
			titCell: ".hd ul",
			mainCell: ".bd ul",
			effect: "fade",  // 不用用fold，不然页面第一次显示的时候会闪一下
			vis: "auto",
			interTime: 4000,
			autoPlay: true,
			autoPage: true,
			trigger: "mouseover"
		});
	}
	// image lazyload
	/* 移到页面底部，加快加载速度
	if ($.fn.lazyload) {
		$("img.lazy").lazyload({
			effect: "fadeIn",
			threshold: 200,
			failure_limit: 10,
			// 替换placeholder为透明gif图片(1x1)
			placeholder: 'data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg=='
		});
	}*/

	// 顶部搜索框
	$("#topSearchInput").on('keypress', function(event){
		if (event.keyCode == 13) topSearchClick();
	}).next().click(function() {
		topSearchClick();
	});

	setTimeout(fixInputPlaceholderIE8, 0);
});

function fixInputPlaceholderIE8() {
	var myNav = navigator.userAgent.toLowerCase();
	if (myNav.indexOf('msie') < 0) return;
	if (parseInt(myNav.split('msie')[1], 10) < 9) {
		// override jquery val
		jQuery.fn.rVal = jQuery.fn.val;
		$.fn.val = function(value) {
			if (arguments.length) {
				return this.rVal(value);
			}
			// getter
			if (this[0]) {
				var ele = $(this[0]), val = ele.rVal();
				if (val === ele.attr('placeholder') && val !== ele.attr('data-oVal')) {
					return '';
				} else {
					return val;
				}
			}
			return undefined;
		};
		//input placeholder
		jQuery('[placeholder]').focus(function() {
			var input = jQuery(this),
				val = input.rVal();
			if (val === input.attr('placeholder') && val !== input.attr('data-oVal')) {
				input.rVal('');
				input.removeClass('placeholder');
			}
			input.css("color", "#000");
		}).blur(function() {
			var input = jQuery(this),
				val = input.rVal();
			if (!val || (val === input.attr('placeholder') && val !== input.attr('data-oVal'))) {
				input.addClass('placeholder');
				input.rVal(input.attr('placeholder'));
				input.css("color", "#aaa");
			}
		}).blur();
	}
}

function topSearchClick() {
	var topSearchInput = $('#topSearchInput'), q = topSearchInput.val().trim();
	if (!q) {
		q = topSearchInput.attr('placeholder');
		topSearchInput.val(q);
	}
	location.href = 'search.html?q=' + encodeURIComponent(q);
}

// 倒计时 scope : product.html | indexPage.js
function CountdownCtrl(element, deadline, callback, options) {
	var targetEl = $(element);
	if (!targetEl.length) throw new Error('Could not find element: ' + element);

	var deadlineMillis = deadline instanceof Date ? deadline.getTime() : deadline;
	if (typeof deadlineMillis !== 'number') throw new Error('Invalid deadline: ' + deadline);

	if (arguments.length > 2) {
		if (typeof callback !== 'function') {
			if (arguments.length === 3) options = callback;
			callback = null;
		}
	}
	var opts = $.extend({
			showDays: true,
			showHours: true,
			showMinutes: true,
			showSeconds: true,
			deadlineMsg: '',
			currentTimeMillis: null  // used to adjust client time
		}, options || {});

	var html = '', elRemainD, elRemainH, elRemainM, elRemainS;
	if (opts.showDays) html += '<i class="countdown-remain-d">-</i>天';
	if (opts.showHours) html += '<i class="countdown-remain-h">-</i>小时';
	if (opts.showMinutes) html += '<i class="countdown-remain-m">-</i>分';
	if (opts.showSeconds) html += '<i class="countdown-remain-s">-</i>秒';
	targetEl.html(html);
	if (opts.showDays) elRemainD = targetEl.find('.countdown-remain-d');
	if (opts.showHours) elRemainH = targetEl.find('.countdown-remain-h');
	if (opts.showMinutes) elRemainM = targetEl.find('.countdown-remain-m');
	if (opts.showSeconds) elRemainS = targetEl.find('.countdown-remain-s');

	function pad2(n) {
		if (n < 10) return '0' + n;
		return '' + n;
	}

	var callbackTriggered = false, intvId,
		adjustMillis = opts.currentTimeMillis ? opts.currentTimeMillis - Date.now() : 0;
	function tick() {
		var nMS = deadlineMillis - Date.now() - adjustMillis;
		if (nMS <= 0) {
			if (!callbackTriggered) {
				if (callback) callback(targetEl);
				callbackTriggered = true;
			}
			if (intvId) {
				clearInterval(intvId);
				intvId = null;
			}
			if (opts.deadlineMsg) {
				targetEl.html(opts.deadlineMsg);
			} else {
				if (elRemainD) elRemainD.text('00');
				if (elRemainH) elRemainH.text('00');
				if (elRemainM) elRemainM.text('00');
				if (elRemainS) elRemainS.text('00');
			}
			return;
		}
		var nD = Math.floor(nMS / (1000 * 60 * 60 * 24));
		var nH = Math.floor(nMS / (1000 * 60 * 60)) % 24;
		var nM = Math.floor(nMS / (1000 * 60)) % 60;
		var nS = Math.floor(nMS / 1000) % 60;
		if (elRemainD) elRemainD.text(nD);
		if (elRemainH) elRemainH.text(pad2(nH));
		if (elRemainM) elRemainM.text(pad2(nM));
		if (elRemainS) elRemainS.text(pad2(nS));
	}

	return {
		start: function() {
			if (callbackTriggered) return;  // 已执行过，不再执行
			setTimeout(tick, 0);
			intvId = setInterval(tick, 1000);
		},

		destroy: function() {
			if (intvId) {
				clearInterval(intvId);
				intvId = null;
			}
		}
	};
}

//貌似没用到
/*function change(){
	if (event.keyCode==13
		&& event.srcElement.type != 'button' && event.srcElement.type != 'submit'
		&& event.srcElement.type != 'reset' && event.srcElement.type != 'textarea' && event.srcElement.type != '')
	{
		event.keyCode=9;
	}
};*/

// ------------------------------------------------------------------------
// 购物车相关
// ------------------------------------------------------------------------

function requestCartProductsCount() {
	$.ajax({
		method: 'GET',
		url: '/cart/product/count',
		dataType: 'json'
	}).done(function(json) {
		if (json.success) {
			renderCartProductsCount(json.data);
		}
	});
}

function renderCartProductsCount(count) {
	if (count) {
		if (count > 99) {
			$('.head-cart .cart-num').text('···').show();
		} else {
			$('.head-cart .cart-num').text(count).show();
		}
	} else {
		$('.head-cart .cart-num').text('').hide();
	}
}

var cartListLoading = false, cartListLoaded = false;
function loadCartList() {
	if (cartListLoading || cartListLoaded) return;
	cartListLoading = true;
	$.ajax({
		method: 'GET',
		url: '/cart/product/list'
	}).done(function(content) {
		cartListLoading = false;
		cartListLoaded = true;
		$('.shoppingcart .carthover').html(content);
		// 修正显示的购物车商品数量
		renderCartProductsCount($('.cart-popover-count').eq(0).text());
	}).fail(function(xhr) {
		cartListLoading = false;
	});
}

function addToCartInit(imageUrlGetter) {
	// 加入购物车
	$(".enterCart").click(function(event) {
		var btn = $(this), skuId = btn.attr('data-rel');
		var quantity = 1, quantityInput = $('input.dt-count');
		if (quantityInput.length) {
			quantity = Number(quantityInput.val());
			if (isNaN(quantity) || quantity <= 0) return;
		}
		addToCart(skuId, quantity, function(data) {
			renderCartProductsCount(data);
			// reload cart list
			if (cartListLoaded) {
				cartListLoaded = false;
				loadCartList();
			}
			// show fly animation
			var imageUrl = imageUrlGetter(btn);
			_startFlyAnimation(event, imageUrl);
		});
	});
}

function addToCart(skuId, quantity, callback) {
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
			callback(json.data);
		} else {
			// TODO
		}
	}).fail(function(xhr) {
		// TODO
	});
}

function _startFlyAnimation(event, imageUrl) {
	var flyer = $('<img class="u-flyer" src="' + imageUrl + '">');
	var scrollTop = $(window).scrollTop();
	var offset = $(".head-cart").offset();
	if ($("#fixedNav").css("display") == "block") {
		flyer.fly({
			start: {
				left: event.pageX - 40,
				top: event.pageY - scrollTop - 40
			},
			end: {
				left: offset.left + 20,
				top: 0,
				width: 0,
				height: 0
			},
			onEnd: function() {
				this.destory();
			}
		});
	} else {
		flyer.fly({
			start: {
				left: event.pageX - 40,
				top: event.pageY - scrollTop - 40
			},
			end: {
				left: offset.left + 20,
				top: offset.top - scrollTop,
				width: 0,
				height: 0
			},
			onEnd: function() {
				this.destory();
			}
		});
	}
}

// scope : popover_list.html
function deleteProductFromCart(el) {
	var jqEl = $(el), skuId = jqEl.attr('data-rel');
	$.ajax({
		method: 'POST',
		url: '/cart/product/delete',
		data: {
			skuId: skuId
		},
		dataType: 'json'
	}).done(function(json) {
		if (json.success) {
			renderCartProductsCount(json.data);
			// reload cart list
			if (cartListLoaded) {
				cartListLoaded = false;
				loadCartList();
			}
		} else {
			// TODO
		}
	}).fail(function() {
		// TODO
	});
}

// 猜你喜欢
function recommendProductsSwitch() {
	$.ajax({
		method: 'POST',
		url: '/product/recommend'
	}).done(function(content) {
		if (content) {
			$('#recommendProductsDiv').html(content)
				.find("img.lazy").lazyload({
					effect: "fadeIn",
					threshold: 200,
					failure_limit: 10
				});
		}
	}).fail(function() {
		// TODO
	});
}

// 如果用户是“代理商”或者“推广员”，为页面上的href添加referral标签
function userReferralHook(referralUserId) {
	$('a').each(function() {
		var $this = $(this), href = $this.attr('href');
		if (!href) return;
		var doHook = false;
		if (href === '/') {
			doHook = true;
		} else {
			var s = href;
			if (href[0] === '/') s = href.substring(1);
			doHook = /^topic-|^product-/.test(s);
		}
		if (doHook) {
			if (href.indexOf('?') < 0) {
				$this.attr('href', href + '?referral=' + referralUserId);
			} else {
				$this.attr('href', href + '&referral=' + referralUserId);
			}
		}
	});
}