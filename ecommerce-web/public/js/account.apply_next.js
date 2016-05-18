var account = function(){
  var $khName = $('#khName'),
    $khBank = $('#khBank'),
    $khMesh = $('#khMesh'),
    $khCnum = $('#khCnum'),
    $aliCnum = $("#aliCnum"),
    $aliName = $("#aliName"),
    tgSubWarn_class = [],
    aliPaySubWarn_class = [],
    tgSubCleanUp_class = [],
    aliPayCleanUp_class = [];

  function initParams(){
    $khName = $('#khName');
    $khBank = $('#khBank');
    $khMesh = $('#khMesh');
    $khCnum = $('#khCnum');
    $aliCnum = $("#aliCnum");
    $aliName = $("#aliName");
    tgSubWarn_class = [];
    aliPaySubWarn_class = [];
    tgSubCleanUp_class = [];
    aliPayCleanUp_class = [];
    return account;
  }

  function showErrorMessage(selector,message){
    selector.siblings('.lg-error').html(message);
  }

  var check_util = function(){
    function checkkhName(){
      if($khName.val().trim() == ""){
        return false;
      }
      var pattern = /^[a-zA-Z\u4e00-\u9fa5]{2,20}$/;
      return pattern.test($khName.val().trim());
    }

    function checkkhBank(){
      if($khBank.val().trim() == ""){
        return false;
      }
      var pattern = /^[a-zA-Z\u4e00-\u9fa5]{4,100}$/;
      return pattern.test($khBank.val().trim());
    }

    function checkkhMesh(){
      if($khMesh.val().trim() == ""){
        return false;
      }
      var pattern = /^[a-zA-Z\u4e00-\u9fa5]{4,100}$/;
      return pattern.test($khMesh.val().trim());
    }

    function checkkhCnum(){
      if($khCnum.val().trim() == ""){
        return false;
      }
      var pattern = /^\d{4}(\s\d{4}){3}$|\d{4}(\s\d{4}){3}\s\d{1,4}$/;
      return pattern.test($khCnum.val().trim());
    }

    function checkaliCnum(){
      if($aliCnum.val().trim() == ""){
        return false;
      }
      var pattern = /^[\S\s]{4,100}$/;
      return pattern.test($aliCnum.val().trim());
    }

    function checkaliName(){
      if($aliName.val().trim() == ""){
        return false;
      }
      var pattern = /^[a-zA-Z\u4e00-\u9fa5]{2,20}$/;
      return pattern.test($aliName.val().trim());
    }

    return {
      checkkhName:checkkhName,
      checkkhBank:checkkhBank,
      checkkhMesh:checkkhMesh,
      checkkhCnum:checkkhCnum,
      checkaliCnum:checkaliCnum,
      checkaliName:checkaliName
    }
  }();
  function tgSub(){
    var tgSub_flag = true;
    tgSubWarn_class.length = 0;
    if(!check_util.checkkhName()){
      showErrorMessage($khName,'2-20位字符组成，可由中文及英文自由组合');
      tgSubCleanUp_class.push($khName);
      tgSubWarn_class.push($khName.parent("td"));
      tgSub_flag =  false;
    }
    if(!check_util.checkkhBank()){
      showErrorMessage($khBank,'4-100位字符组成，可由中文及英文自由组合');
      tgSubCleanUp_class.push($khBank);
      tgSubWarn_class.push($khBank.parent("td"));
      tgSub_flag = false;
    }
    if(!check_util.checkkhMesh()){
      showErrorMessage($khMesh,'4-100位字符组成，可由中文及英文自由组合');
      tgSubCleanUp_class.push($khMesh);
      tgSubWarn_class.push($khMesh.parent("td"));
      tgSub_flag = false;
    }
    if(!check_util.checkkhCnum()){
      showErrorMessage($khCnum,'16-20位数字之间');
      tgSubCleanUp_class.push($khCnum);
      tgSubWarn_class.push($khCnum.parent("td"));
      tgSub_flag = false;
    }
    return tgSub_flag;
  }

  function aliPaySub(){
    var aliPaySub_flag = true;
    aliPaySubWarn_class.length = 0;
    if(!check_util.checkaliCnum()){
      showErrorMessage($aliCnum,'4-100位字符组成');
      aliPayCleanUp_class.push($aliCnum);
      aliPaySubWarn_class.push($aliCnum.parent("td"));
      aliPaySub_flag = false;
    }
    if(!check_util.checkaliName()){
      showErrorMessage($aliName,'2-20位字符组成，可由中文及英文自由组合');
      aliPayCleanUp_class.push($aliName);
      aliPaySubWarn_class.push($aliName.parent("td"));
      aliPaySub_flag = false;
    }
    return aliPaySub_flag;
  }
  function warn(){
    if(tgSubWarn_class.length>0){
      $.each(tgSubWarn_class,function(){
        this.addClass("tdHold");
      });
    }

    if(aliPaySubWarn_class.length>0){
      $.each(aliPaySubWarn_class,function(){
        this.addClass("tdHold");
      });
    }
  }

  function cleanEmpty(){
    if(tgSubCleanUp_class.length>0){
      $.each(tgSubCleanUp_class,function(){
        this.val('');
        this.keydown();
      });
    }

    if(aliPayCleanUp_class.length>0){
      $.each(aliPayCleanUp_class,function(){
        this.val('');
        this.keydown();
      });
    }
    tgSubWarn_class = [];
    tgSubCleanUp_class = [];
    aliPaySubWarn_class = [];
    aliPayCleanUp_class = [];
  }

  function bindEvent(){
    $("#khCnum").keyup(function(event){
      this.value = this.value.replace(/[^\d]/g, '').replace(/(\d{4})(?=\d)/g, "$1 ");
    });

    $(".fanli").mouseover(function(){
      $(this).find(".pWrite").show();
    }).mouseout(function(){
      $(this).find(".pWrite").hide();
    });

    $khName.keydown(function(){
      $khName.parent().removeClass("tdHold");
    });
    $khBank.keydown(function(){
      $khBank.parent().removeClass("tdHold");
    });
    $khMesh.keydown(function(){
      $khMesh.parent().removeClass("tdHold");
    });
    $khCnum.keydown(function(){
      $khCnum.parent().removeClass("tdHold");
    });
    $aliCnum.keydown(function(){
      $aliCnum.parent().removeClass("tdHold");
    });
    $aliName.keydown(function(){
      $aliName.parent().removeClass("tdHold");
    });
  };
  bindEvent();
  return {
    tgSub:tgSub,
    aliPaySub:aliPaySub,
    warn:warn,
    cleanEmpty:cleanEmpty,
    initParams:initParams,
    bindEvent:bindEvent
  };
}();