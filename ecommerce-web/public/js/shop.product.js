$(function() {
	$(".jqzoom").imagezoom();
	// 商品图片
	$("#G-scroll").GScroll();
	$("#thumblist li a").mouseover(function() {
		$(this).parents("li").addClass("tb-selected").siblings().removeClass("tb-selected");
		$(".jqzoom").attr('src', $(this).find("img").attr("mid"));
		$(".jqzoom").attr('rel', $(this).find("img").attr("big"));
	});
	// 收货地址
	$("#regionSelector").click(function() {
		var cityBox = $("#js_cityBox");
		if (cityBox.length) {
			cityBox.remove();
			return;
		}
		loadRegionsJSON();
	});
	$(document).on("click", function(e) {
		var target = $(e.target);
		if (target.closest(".iptbrd").length === 0 && target.closest("#js_cityBox").length === 0) {
			$("#js_cityBox").remove();
		}
	});
	// 规格
	$(".specf span").click(function(){
		var el = $(this);
		if (el.hasClass("on")) return;
		el.addClass("on").siblings().removeClass("on");
		var skuId = el.attr("data-skuId");
		if (skuId) location.href = "product-" + skuId + ".html";
	});
	// 数量
	function checkCount() {
		$(".dt-count").each(function() {
			var num = $(this).val();
			if (num <= 1) {
				$(this).siblings(".dt-redu").attr("disabled", "disabled");
				$(this).siblings(".dt-redu").addClass("dt-reduct");
				$(this).val("1");
			} else {
				$(this).siblings(".dt-redu").removeAttr("disabled", "disabled");
				$(this).siblings(".dt-redu").removeClass("dt-reduct");
			}
		});
		//根据数量是否为1，改变减号的样式
	}
	function checkStock() {
		var allNum = parseInt($("#allNum").val(), 10);
		$(".dt-count").each(function() {
			var num = $(this).val();
			if (num >= allNum) {
				$(this).siblings(".dt-add").attr("disabled", "disabled");
				$(this).siblings(".dt-add").addClass("dt-addct");
				$(this).val(allNum);
			} else {
				$(this).siblings(".dt-add").removeAttr("disabled", "disabled");
				$(this).siblings(".dt-add").removeClass("dt-addct");
			}
		});
		//根据数量是否大于总库存数量，改变加号的样式
	}
	$(".dt-add").click(function() {
		var dtinput = $(this).siblings(".dt-count");
		var Val = dtinput.val();
		dtinput.val(parseInt(Val, 10) + 1); //数量加1
		checkCount();
		checkStock();
	});
	$(".dt-redu").click(function() {
		var dtinput = $(this).siblings(".dt-count");
		var Val = dtinput.val();
		if (Val <= 1) {
			Val = 2;
		}
		dtinput.val(parseInt(Val, 10) - 1); //数量减1
		checkCount();
		checkStock();
	});
	/*$(".dt-count").keyup(function() {
		checkCount();
		checkStock();
	});*/
	checkCount();
	checkStock();
	// 收藏
	$(".collect").click(function() {
		addToFavorite($(this));
	});
	$(".beCollect").click(function() {
		removeFromFavorite($(this));
	});
	// 加入购物车
	addToCartInit(function(btn) {
		return $('#thisImg').attr('src');
	});
	$('.buybtn').click(function() {
		var skuId = $('.enterCart').attr('data-rel');
		var quantity = 1, quantityInput = $('input.dt-count');
		if (quantityInput.length) {
			quantity = Number(quantityInput.val());
			if (isNaN(quantity) || quantity <= 0) return;
		}
		addToCart(skuId, quantity, function(data) {
			// 直接跳转到购物车页面
			window.location.href = '/cart.html';
		});
	});
});

(function($) {
	// 商品主图滚动控件
	var defaults = {
		prevBtn: '.prev',
		nextBtn: '.next-on',
		moveDiv: '.tb-thumb',
		showNum: 4,
		speed: 3000,
		moveWay: '1' // 默认 0 [循环收尾连接滚动] | 1 [到尾转回第一张]
	};
	$.fn.GScroll = function(options) {
		options = $.extend({}, defaults, options);
		return this.each(function() {
			var self = $(this),
				prevBtn = self.find(options.prevBtn),
				nextBtn = self.find(options.nextBtn),
				moveDiv = self.find(options.moveDiv),
				index = 0,
				_w = moveDiv.children().outerWidth(true),
				len = moveDiv.children().length,
				timer = null;

			prevBtn.bind('click', function() {
				if (index === 0) {
					$(this).removeClass("prev-on").addClass("prev");
					$(".next-on").removeClass("next").addClass("next-on");
					return;
				} else {
					$(".next").removeClass("next").addClass("next-on");
					if (!moveDiv.is(':animated')) {
						if (index <= 1) {
							$(this).removeClass("prev-on").addClass("prev");
						}
						moveDiv.animate({
							'marginLeft': '+=' + _w + 'px'
						});
						index--;
					}
				}
			});
			nextBtn.bind('click', function() {
				if (len <= options.showNum) {
					$(this).removeClass("next-on").addClass("next");
					return;
				} else {
					if (index == len - options.showNum) {
						return;
					} else {
						if (!moveDiv.is(':animated')) {
							if (index >= len - options.showNum - 1) {
								$(this).removeClass("next-on").addClass("next");
							}
							$(".prev").removeClass("prev").addClass("prev-on");
							index++;
							moveDiv.animate({
								'marginLeft': '-=' + _w + 'px'
							});
						}
					}
				}
			});

			function clearTime() {
				clearInterval(timer);
				timer = null;
			}
		});
	};
})(jQuery);

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
			jqEl.hide().siblings(".beCollect").attr('data-rel', favoriteId).show();
		}
		collectInProcess = false;
	}).fail(function(xhr) {
		if (xhr.status === 401) {
			// 跳出登录框
			ShopLogin.popupLogin(function() {
				addToFavorite(jqEl);
			});
		}
		collectInProcess = false;
	});
}
// 取消收藏
var beCollectInProcess = false;
function removeFromFavorite(jqEl) {
	if (beCollectInProcess) return;
	beCollectInProcess = true;

	var favoriteId = jqEl.attr('data-rel');
	$.ajax({
		method: 'POST',
		url: '/user/favorite/delete',
		data: {
			favoriteId: favoriteId
		},
		dataType: 'json'
	}).done(function(json) {
		if (json.success) {
			jqEl.hide().siblings(".collect").show();
		}
		beCollectInProcess = false;
	}).fail(function(xhr) {
		if (xhr.status === 401) {
			// 跳出登录框
			ShopLogin.popupLogin(function() {
				removeFromFavorite(jqEl);
			});
		}
		beCollectInProcess = false;
	});
}



// 限时抢购/商品活动已结束
function handleActivityCompleted() {
	$('#saleBtns').html('<span class="buyover">已抢光</span>');
}

var REGIONS_JSON = null, loadingRegions = false;

function loadRegionsJSON() {
	if (loadingRegions) return;
	if (REGIONS_JSON) {
		generateCityBox(REGIONS_JSON);
		return;
	}
	loadingRegions = true;
	$.ajax({
		method: 'GET',
		url: '/region/list',
		dataType: 'json'
	}).done(function(regions) {
		loadingRegions = false;
		REGIONS_JSON = regions;
		generateCityBox(regions);
	}).fail(function() {
		loadingRegions = false;
	});
}

function generateCityBox(regions) {
	var targetEl = $("#regionSelector"),
		provHtmls = "";
	for (var j = 0; j < regions.length; j++) {
		var name = regions[j][1];
		var regionName = "";
		if (name.indexOf("省") > 0) {
			regionName = name.substring(0, name.indexOf("省"));
		} else {
			if (name == "内蒙古自治区") {
				regionName = name.substring(0, 3);
			} else {
				regionName = name.substring(0, 2);
			}
		}
		provHtmls += "<li data-regionId='" + regions[j][0] + "'><span class='provinceName'>" + regionName + "</span></li>";
	}
	var template = '<div class="city-box" id="js_cityBox"><i class="addrbox-triup"></i><div class="provence"><ul id="js_provList">' + provHtmls + '</ul></div></div>';

	$("body").append(template);

	var _top = targetEl.offset().top + 35,
		_left = targetEl.offset().left - 115,
		_width = $(window).width();
	if (_width - _left < 450) {
		$("#js_cityBox").css({
			"top": _top + "px",
			"right": "0px"
		}).addClass("rightSelector");
	} else {
		$("#js_cityBox").css({
			"top": _top + "px",
			"left": _left + "px"
		});
	}

	var label = "false";
	$("#js_provList").on("click", ".provinceName", function() {
		function createUl(_this) {
			_this.css({
				"background": "#ff5252",
				"color": "#fff"
			});
			var regionId = _this.parent("li").attr("data-regionId");
			showChildRegion(regionId, _this);
		}
		if (label == "false") {
			label = "true";
			$(this).attr("now-item", "true");
			createUl($(this));
		} else {
			if ($(this).attr("now-item") === "" || $(this).attr("now-item") === "false" || $(this).attr("now-item") === undefined) {
				$(this).parents("#js_provList").find("span").attr("now-item", "false");
				$(this).attr("now-item", "true");
				$("#js_provList span").css({
					"background": "",
					"color": "#555"
				});
				$("#js_provCitys").remove();
				createUl($(this));
			} else {
				label = "false";
				$(this).css({
					"background": "",
					"color": "#555"
				});
				$("#js_provCitys").remove();
			}
		}
	});
	$("#js_cityBox").on("click", ".js_cityName", function(e) {
		e.stopPropagation();
		var _this = $(this);
		$("#regionSelector").val(_this.html());
		$("#js_cityBox").remove();
		calculateFreight(_this.attr("data-regionId"));
	});
}

function showChildRegion(regionId, parentEl) {
	var regions = REGIONS_JSON, children = null, i, region;
	for (i = 0; i < regions.length; ++i) {
		region = regions[i];
		if (region[0] == regionId) {
			children = region[2];
			break;
		}
	}

	var cityHtmls = "<ul id='js_provCitys'>";
	for (i = 0; i < children.length; i++) {
		region = children[i];
		cityHtmls += "<li class='js_cityName' data-regionId='" + region[0] + "'>" + region[1] + "</li>";
	}
	cityHtmls += "</ul>";
	$("#js_provCitys").remove();
	parentEl.parents("li").append(cityHtmls);
}

function calculateFreight(regionId) {
	var jqEl = $('#regionSelector');
	jqEl.attr('data-regionId', regionId);
	if (jqEl.attr('data-isFreeShipping') === 'Y') return;
	$.ajax({
		method: 'POST',
		url: '/freight/fee',
		data: {
			warehouseId: jqEl.attr('data-warehouseId'),
			shippingRegionId: regionId,
			weight: jqEl.attr('data-weight')
		},
		dataType: 'json'
	}).done(function(json) {
		if (json.success) {
			jqEl.parent().next().html('运费' + json.data + '元');
		}
	});
}