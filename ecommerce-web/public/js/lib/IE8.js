$(function(){
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
});
