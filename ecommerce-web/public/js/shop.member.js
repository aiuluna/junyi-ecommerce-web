//member-center scope : memeber
$(function() {
  var textButton = "<input type='button' value='设置头像' name='' class='textfield type-file-btn'/>";
  $(textButton).insertBefore(".fileField");
  var textBtn = "<input type='button' value='上传照片' name='' class='textfield file-btn'/>";
  $(textBtn).insertBefore(".fileField-two");
  //收获地址
  var textBtn3 = "<input type='button' value='' name='' class='textfield3'/>";
  $(textBtn3).insertBefore(".fileField3");
  //
  $(".ddTab a:first").css("background-image", "none");
  //
  $(".intab tr").each(function() {
    $(".intab tr:last-child td").css("border-bottom-width", "0");
  });
});

$(function(){
  var dH = $(document).height();
  var wH = $(window).height();
  if(dH>wH){
    $("#fullbg").height(dH);
  }else{
    $("#fullbg").height(wH);
  };

  $(".pop-close").click(function(){
    $("#fullbg,.pop").hide();
    $(".add-tab td").removeClass("tdHold");
    $(".enlarge").hide();
    $(".enlarge img").remove();
  });
  $(window).ready(function(){
    BoxAdapt();
  });
  $(window).scroll(function(){
    BoxAdapt();
  });
  $(window).resize(function(){
    BoxAdapt();
  });

  function BoxAdapt(){
    var winWidth = $(window).width();
    var winHeight = $(window).height();
    var scrHeight = $(document).scrollTop();
    var boxHeight = $(".pop").height();
    var boxWidth = $(".pop").width();
    var centerWidth = (winWidth-boxWidth)/2;
    var centerHeight = (winHeight-boxHeight)/2+scrHeight;
    $(".pop").animate({"top":centerHeight,"left":centerWidth},0);//100
    //cationDiv
    var cationHeight = $(".cationDiv").height();
    var cationWidth = $(".cationDiv").width();
    var cation_ctWidth = (winWidth-cationWidth)/2;
    var cation_ctHeight = (winHeight-cationHeight)/2+scrHeight;
    $(".cationDiv").animate({"top":cation_ctHeight,"left":cation_ctWidth},0);
    //lbsltsDiv
    var lbsHeight = $(".lbsltsDiv").height();
    var lbsWidth = $(".lbsltsDiv").width();
    var lbs_ctWidth = (winWidth-lbsWidth)/2;
    if(lbsHeight > 720){
      var lbs_ctHeight = (winHeight-720)/2+scrHeight;
    }else{
      var lbs_ctHeight = (winHeight-lbsHeight)/2+scrHeight;
    }
    $(".lbsltsDiv").animate({"top":lbs_ctHeight,"left":lbs_ctWidth},0);
    //afterDiv
    var afterHeight = $(".afterDiv").height();
    var afterWidth = $(".afterDiv").width();
    var after_ctWidth = (winWidth-afterWidth)/2;
    var after_ctHeight = (winHeight-afterHeight)/2+scrHeight;
    $(".afterDiv").animate({"top":after_ctHeight,"left":after_ctWidth},0);
    //subOrder
    var subOHeight = $(".subOrder").height();
    var subOWidth = $(".subOrder").width();
    var subO_ctWidth = (winWidth-subOWidth)/2;
    var subO_ctHeight = (winHeight-subOHeight)/2+scrHeight;
    $(".subOrder").animate({"top":subO_ctHeight,"left":subO_ctWidth},0);
  };

  $(".cationDiv .imgClose").click(function(){
    $(this).parents(".voucher").siblings(".type-file-box").show();
  });
  //
  $(".lbslts").click(function(){
    $("#fullbg,.lbsltsDiv").show();
    $(".lbsltsDiv .logistics").each(function(){
      var lbsH = $(".lbsltsDiv .logistics").height();
      if(lbsH > 500){
        $(this).slimscroll({"height":"500px"});
        return false;
      };
    });
  });

  //numDt 推广员/代理商 查看订单详情
  $(".numDt").click(function(){
    $("#fullbg,.subOrder").show();
  });

  //物流包裹
  $(".pgDiv:first").show();
  $(".pgSpan span").click(function(){
    $(this).addClass("on").siblings().removeClass("on");
    var sIndex = $(this).index();
    $(".pgDiv").eq(sIndex).show().siblings(".pgDiv").hide();
  });

  $(".enclose").click(function(){
    $(this).parent().hide();
    // $(".enlarge img").remove();
  });
  //蚂蚁发货
  $(".mbdtail .logistics").each(function(){
    var mlog = $(this).parent(".pgDiv").height()-56;
    //alert(mlog)
    if(mlog > 150){
      var cShow = $(this).siblings(".clickShow");
      var cHide = $(this).siblings(".clickHide");
      cShow.show();
      $(this).css({"height":"150px"});
      cShow.click(function(){
        $(this).siblings(".logistics").animate({"height":mlog});
        $(this).hide();
        cHide.show();
      });
      cHide.click(function(){
        $(this).siblings(".logistics").animate({"height":"150px"});
        $(this).hide();
        cShow.show();
      });
    }else{
      var cShow = $(this).siblings(".clickShow");
      cShow.hide();
    };
  });
});

