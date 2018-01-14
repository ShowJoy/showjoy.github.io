/**
* cgi测试上报  
* Created by joyxu on 2016-07-26
*/
;(function(global){

  var _config = {
      rptAddr:'',
      clientId:'',
      siteId:'',
      userId:'',
      feSid:''
  };

  //生成userId和feSid
  var _getIdStr = function(uid) {
      var feSid = global.localStorage.getItem('fmonitor_sid');

      if (!feSid) {
          //自动生成userid
          feSid = "sid_" + _makeRandomStr();
          global.localStorage.setItem('fmonitor_sid', feSid);
      }
      return 'feSid=' + feSid + (uid ? ("&userId=" + uid) : "");
  };

   //上报地址
  var _rptAddr = (function() {
      var hostname = global.location.hostname,
          protocol = global.location.protocol;
    
      if (/^(localhost|test|gray|dev|bench).*/i.test(hostname)) {
          return protocol + '//graylog.sqyh365.cn/report.gif';
      } else {
          return protocol + '//log.sqyh365.cn/report.gif';
      }
  })();

  //生成随机字符串
  var _makeRandomStr = function() {
      return ((+new Date()).toString(36) + Math.random().toString(36).substr(2, 3));
  };

  //通过请求url的方式上报数据
  var _request = function(url) {
      var n = 'rptimg_' + _makeRandomStr(),
          img = global[n] = new Image();

      //直接img.src发送有一定概率丢失数据,当浏览器回收内存的时候这个请求是发不出去的
      img.onload = img.onerror = function() {
          global[n] = null;
      };
      img.src = url;
  };

  var _inArray = function(val, arr){
      for(var i = 0, len = arr.length; i < len; i++){
          if(arr[i] == val){
              return true;
          }
      }
      return false;
  };
  var _isEmptyObject = function (e) {  
      var t;
      for (t in e)
          return !1;
      return !0;
  };
  var timeStartObj = {}, timeEndObj = {}, configObj = {}, hasReported = [];

  var CGI = {
      setConfig: function(config){
          var clientIdStr = '',
              siteIdStr = '',
              urlStr = '';

          for (var key in config) {
              _config[key] = config[key];
          }

          _config.rptAddr = _config.rptAddr || _rptAddr;
          clientIdStr = '&clientId=' + _config.clientId || '';
          siteIdStr = '&siteId=' + _config.siteId || '';
          _config.url && (urlStr = '&url=' + encodeURIComponent(_config.url));

          _config.reportPrefix = _config.rptAddr + '?' + _getIdStr(_config.userId) + urlStr + clientIdStr + siteIdStr + '&rt=' + _makeRandomStr();
      },
      init: function(conf){
          this.setConfig(conf);
          this.detect();
      },

      detect: function(){
          var _this = this,
              $ = (typeof Zepto !== 'undefined') ? Zepto:((typeof MLBF !== 'undefined') && MLBF.require('lib.Zepto'));

          if((typeof angular !== 'undefined') && (typeof app !== 'undefined')){
              app.config([ '$httpProvider', function($httpProvider) { 
                  $httpProvider.interceptors.push('httpInterceptor'); 
              }]); 
              app.factory('httpInterceptor', [ '$q', '$injector',function($q, $injector) { 
                  var httpInterceptor = { 
                      request:function(config){
                          var url = config.url.split('?')[0];
                          timeStartObj[url] = timeStartObj[url] || +new Date();
                          configObj[url] = {};
                          return config || $q.when(config);
                      },
                      responseError: function(rejection) { 
                          _this.request({
                              url:rejection.config.url.split('?')[0],
                              status:rejection.status,
                              type:rejection.config.method
                          });  
                          return $q.reject(rejection)
                      },
                      response: function(response) {
                          _this.request({
                              url:response.config.url.split('?')[0],
                              status:response.status,
                              type:response.config.method
                          });  
                          return response || $q.when(response)
                      }
                  }
                  return httpInterceptor; 
              }]);
          }
          if(typeof jQuery !== 'undefined'){
              jQuery(document).on('ajaxSend',function(e, xhr, settings){
                  timeStartObj[settings.url] = timeStartObj[settings.url] || +new Date();
                  configObj[settings.url] = {};
                  xhr.done(function(){
                      _this.request({
                          url:settings.url,
                          status:xhr.status,
                          type:settings.type
                      });   
                  }).fail(function(){
                      _this.request({
                          url:settings.url,
                          status:xhr.status,
                          type:settings.type
                      });  
                  });
              });
          }
          if($){
              var context = $.ajaxSettings.context || document;
              $(context).on('ajaxSend', function(e, xhr, settings){
                  timeStartObj[settings.url] = timeStartObj[settings.url] || +new Date();
                  configObj[settings.url] = {};
                  var oldReadyStateChange = xhr.onreadystatechange;
                  xhr.onreadystatechange = function(){
                      if (xhr.readyState == 4) {
                          _this.request({
                              url:settings.url,
                              status:xhr.status,
                              type:settings.type
                          });                     
                      }
                      oldReadyStateChange.apply(this, arguments);
                  }
              });
          }
      },
      request:function(obj){
          var url = obj.url;
          timeEndObj[url] = timeEndObj[url] || +new Date();
          if (!configObj[url]) return false;
          configObj[url]['time'] = timeEndObj[url] - timeStartObj[url];
          configObj[url]['statusCode'] = obj.status;
          configObj[url]['api'] = encodeURIComponent(url);
          configObj[url]['method'] = obj.type;
          _request(_config.reportPrefix + '&option=cgiTiming&time=' + configObj[url].time + '&statusCode=' + configObj[url].statusCode + '&api=' + configObj[url].api + '&method=' + configObj[url].method);
          delete configObj[url];
          delete timeStartObj[url];
          delete timeEndObj[url];
      },
      //监听事件兼容
      addEvent:function(name, func) {
          if (global.attachEvent) {
              global.attachEvent("on" + name, func);
          } else {
              global.addEventListener(name, func);
          }
      }
  };

  CGI.init(global.fmonitorConf);
})(window);