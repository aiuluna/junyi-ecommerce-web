+(function($){
  var defaults={
    selector: 'form',
    fields: []
  };
  var patterns = {
    integer: /^\d+$/,
    decimal: /^(([1-9]\d{0,12})|0)(\.\d*)?$/,
    email: /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/i,
    username: /^[a-z]+((?!@).)*$/i
  };
  var rule_required = {
    name: 'required',
    checker: function(val, expected) {
      return expected != false && $.trim(val).length > 0;
    },
    message: '该字段必须输入'
  };
  var rules = [
    {
      name: 'maxlength',
      checker: function(val, expected) {
        expected = Math.max(0, parseInt(expected));
        return $.trim(val).length <= expected;
      },
      message: '最多{0}个字符'
    }, {
      name: 'minlength',
      checker: function(val, expected) {
        expected = Math.max(0, parseInt(expected));
        return $.trim(val).length >= expected;
      },
      message: '最少{0}个字符'
    }, {
      name: 'number',
      pattern: patterns['integer'],
      checker: function(val, pattern) {
        return $.trim(val) && pattern.test($.trim(val));
      },
      message: '该字段必须是整数'
    }, {
      name: 'decimal',
      pattern:  patterns['decimal'],
      checker: function(val, pattern) {
        return $.trim(val) && pattern.test($.trim(val));
      },
      message: '该字段必须是数字, 可包含小数'
    },{
      name: 'min',
      checker: function(val, expected) {
        return $.trim(val) && patterns.decimal.test($.trim(val)) && val >= parseFloat(expected);
      },
      message: '最小值为{0}'

    },{
      name: 'max',
      checker:function(val, expected) {
        return $.trim(val) && patterns.decimal.test($.trim(val)) && val <= parseFloat(expected);
      },
      message: '最大值为{0}'
    },
    {
      name:'email',
      pattern:  patterns['email'],
      checker: function(val, pattern) {
        return $.trim(val) && pattern.test($.trim(val));
      },
      message: '邮箱格式不正确'
    },
    {
      name:'username',
      pattern:  patterns['username'],
      checker: function(val, pattern) {
        return $.trim(val) && pattern.test($.trim(val));
      },
      message: '用户名由英文字母, 数字, _ 组成, 必须以英文字母开头'
    }
  ];

  var ruleMap = {
    required: rule_required
  };
  $.each(rules, function(i, v) {
    ruleMap[v.name] = v;
  });
  function validate($form) {


    function Validator($form) {

      this.$form = $form;

      var selectors = [
        'input',
        'textarea'
      ];

      var errorHandler = function($field, ruleName, ruleVal) {
        var $td = $field.closest('td');
        $td.addClass('tdHold');

        $('.lg-error', $field.parent()).show();
        var error = $field.attr('error') || ruleMap[ruleName].message;
        if (/\{\d}/.test(error)) {
          error = error.replace('{0}', ruleVal);
        }
        if (error) {
          if (!$field.data('original_title')) {
            $field.data('original_title', $field.attr('title') || ' ');
          }

          $field.attr('title', error);
          $('.lg-error', $field.parent()).text(error);
        }
      };
      var successHandler = function($field) {
        var $td = $field.closest('td');
        $td.removeClass('tdHold');
        if ($field.data('original_title')) {
          $field.attr('title', $field.data('original_title'));
        }
        $('.lg-error', $field.parent()).hide();
      };


      var valid = true;
      function doValidate($field) {

        var required = $field.attr('required');
        var val = $field.val();
        if (!$.trim(val)) {
          // check required first
          if (!required || required == 'false') {
            valid = valid && true;
            successHandler($field);
            $field.data('validated', true);
            return;
          } else {
            errorHandler($field, 'required', required);
            valid = valid && false;
            return;
          }
        }

        for (var i = 0, len = rules.length; i < len; ++i) {
          var rule = rules[i],
            ruleName = rule.name,
            checker = rule.checker,
            pattern = rule.pattern,
            realRule = $field.attr(ruleName);
          if (realRule && realRule.length >= 0 ) {

            if (!checker(val, pattern || realRule)) {
              // console.log($field, rule, $field.val());
              errorHandler($field, ruleName, realRule);
              valid = valid && false;
              break;
            } else {
              valid = valid && true;
              successHandler($field);
              $field.data('validated', true);
            }
          }
        }
      }

      this.isValid = function() {
        valid = true;
        $form.find(selectors.join(',')).trigger('keyup');
        return valid;
      };

      $form.on('keyup', selectors.join(','), function(){
        doValidate($(this));
      });
      $form.on('blur', selectors.join(','), function(){
        doValidate($(this));
      });

      return this;
    }

    var formValidator = $form.data('$validator');
    if (!formValidator) {

      formValidator = new Validator($form);
      $form.data('$validator', formValidator);
    }

    return formValidator;
  }
  $.fn.simpleValidate = function(options){
    options = $.extend({}, options);
    this.each(function(i, form){
      validate($(form));
    });
  }

})(jQuery);
