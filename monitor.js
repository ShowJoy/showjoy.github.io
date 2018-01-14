/**
 * pv, performance, exception report
 * version 1.3.0
 * created by joyxu, on 2016-7-5
 */
;
(function(global, doc) {
    var _errors = [];
    var _config = {
        rptAddr: "",    // 上报接口地址
        ignore: [],     // 忽略某个错误, 支持 Regexp 和 Function
        sampling: 1,    // 采样 (0-1] 1-全量
        url: '',        // 当前访问页面
        refer: document.referrer,      // 页面来源地址
        rtLen: 25        // resource timinge 一次上报资源个数 
    };  
    var globalError = global.onerror;

    var _isObjectByType = function(o, type) {
        return Object.prototype.toString.call(o) === "[object " + (type || "Object") + "]";
    };

    var _isObject = function(obj) {
        var type = typeof obj;
        return type === "object" && !!obj;
    };

    var _isEmpty = function(obj) {
        if (obj === null) return true;
        if (_isObjectByType(obj, "Number")) {
            return false;
        }
        return !obj;
    };

    //重写window.onerror or element.onerror
    global.onerror = function(msg, source, lineNum, colNum, errorObj) {
        var errorMsg = msg;
        try {
            if (errorObj && errorObj.stack) {
                errorMsg = _processStackMsg(errorObj);
            }
            Reporter.report({
                msg: errorMsg,
                source: source,
                lineNum: lineNum,
                colNum: colNum
            });
        } catch (e) {

        }
        globalError && globalError.apply(global, arguments);
        //防止错误暴露到浏览器
        //return true;
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
    }

    var _errorToString = function(error, index) {
        var param = [];
        var params = [];
        var stringify = [];
        if (_isObject(error)) {
            //error.level = error.level || _config.level;
            for (var key in error) {
                var value = error[key];
                if (!_isEmpty(value)) {
                    if (_isObject(value)) {
                        try {
                            value = JSON.stringify(value);
                        } catch (err) {
                            value = "[F_MONITOR detect value stringify error] " + err.toString();
                        }
                    }
                    stringify.push(key + ":" + value);
                    param.push(key + "=" + encodeURIComponent(value));
                    params.push(key + "[" + index + "]=" + encodeURIComponent(value));
                }
            }
        }

        // msg[0]=msg&target[0]=target -- combo report
        // msg:msg,target:target -- ignore
        // msg=msg&target=target -- report with out combo
        return [params.join("&"), stringify.join(","), param.join("&")];
    };

    var needReportErrors = []; //预留，以后用于合并，延迟上报
    var _go = function(now) {
        //遍历错误信息数组
        while (_errors.length) {
            //是否忽略该错误上报标志
            var shouldIgnore = false;
            var error = _errors.shift();
            var errorStr = _errorToString(error, needReportErrors.length);

            if (_isObjectByType(_config.ignore, "Array")) {
                for (var i = 0, len = _config.ignore.length; i < len; i++) {
                    var rule = _config.ignore[i];
                    if ((_isObjectByType(rule, 'RegExp') && rule.test(errorStr[1])) || (_isObjectByType(rule, 'Function') && rule(error, errorStr[1]))) {
                        shouldIgnore = true; //设置忽略该错误信息标志
                        break;
                    }
                }
            }

            if (!shouldIgnore) {
                _request(_config.reportPrefix + '&option=jsException&' + errorStr[2]);
            }
        }
    };

    //格式化errror stack
    var _processStackMsg = function(error) {
        var stack = error.stack
            .replace(/\n/gi, "")
            .split(/\bat\b/)
            .slice(0, 9)
            .join("@")
            .replace(/\?[^:]+/gi, "");
        var msg = error.toString();
        if (stack.indexOf(msg) < 0) {
            stack = msg + "@" + stack;
        }
        return stack;
    };

    //处理错误信息
    var _processError = function(obj) {
        try {
            //try{}catch(err){F_MONITOR.report(err)}抛出的异常处理
            if (obj.stack) {
                var url = obj.stack.match('https?://[^\n]+');
                url = url ? url[0] : "";

                var rowCols = url.match(":(\\d+):(\\d+)");
                if (!rowCols) {
                    rowCols = [0, 0, 0];
                }

                var stack = _processStackMsg(obj);
                return {
                    msg: stack,
                    rowNum: rowCols[1],
                    colNum: rowCols[2],
                    source: url.replace(rowCols[0], "")
                };
            } else {
                //ie 独有 error 对象信息，try-catch 捕获到错误信息传过来，造成没有msg
                if (obj.name && obj.message && obj.description) {
                    return {
                        msg: JSON.stringify(obj)
                    };
                }
                return obj;
            }
        } catch (err) {
            return obj;
        }
    };
    //生成随机字符串
    var _makeRandomStr = function() {
        return ((+new Date()).toString(36) + Math.random().toString(36).substr(2, 3));
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

    var _getTimings = function(performance) {
        var entries = [];
        // Page times come from Navigation Timing API
        entries.push(createEntryFromNavigationTiming(performance.timing));
        // Other entries come from Resource Timing API
        var resources = [];
        if(performance.getEntriesByType !== undefined) {
            resources = performance.getEntriesByType("resource");
        }
        else if(global.performance.webkitGetEntriesByType !== undefined) {
            resources = performance.webkitGetEntriesByType("resource");
        }
        for(var n = 0, l = resources.length; n < l; n++) {
            //if(!/[cgi]?monitor[\-0-9\.]*.js/.test(resources[n].name)){
                entries.push(createEntryFromResourceTiming(resources[n]));
            //}
        }
        return entries;
    }

    function cleanUrl(url){
        var tmp = url.match("([^?#]*)[?#]?(.*)");
        var option = tmp[2].match("(option=[^&]*)");
        return tmp[1].split('/').pop() + (option ? ('?' + option[1]):'');
    }

    function createEntryFromNavigationTiming(timing) {
        // TODO: Add fetchStart and duration, fix TCP timings
        return {
            type:'navigation',
            name: cleanUrl(doc.URL),
            start: 0,
            duration: +(timing.responseEnd - timing.navigationStart).toFixed(2),
            //redirectStart: timing.redirectStart === 0 ? 0 : +(timing.redirectStart - timing.navigationStart).toFixed(2),
            redirect: +(timing.redirectEnd - timing.redirectStart).toFixed(2),
            //dnsStart: +(timing.domainLookupStart - timing.navigationStart).toFixed(2),
            dns: +(timing.domainLookupEnd - timing.domainLookupStart).toFixed(2),
            //tcpStart: +(timing.connectStart - timing.navigationStart).toFixed(2),
            tcp: +((timing.secureConnectionStart > 0 ? timing.secureConnectionStart : timing.connectEnd) - timing.connectStart).toFixed(2),
            //sslStart: timing.secureConnectionStart > 0 ? +(timing.secureConnectionStart - timing.navigationStart).toFixed(2) : 0,
            ssl: timing.secureConnectionStart > 0 ? +(timing.connectEnd - timing.secureConnectionStart).toFixed(2) : 0,
            //requestStart: +(timing.requestStart - timing.navigationStart).toFixed(2),
            request: +(timing.responseStart - timing.requestStart).toFixed(2),
            //responseStart: +(timing.responseStart - timing.navigationStart).toFixed(2),
            response: +(timing.responseEnd - timing.responseStart).toFixed(2)
        }
    }

    function createEntryFromResourceTiming(resource) {
        return {
            type:resource.initiatorType,
            name: cleanUrl(resource.name),
            start: +(resource.startTime).toFixed(2),
            duration: +(resource.duration).toFixed(2),
            //redirectStart: +(resource.redirectStart).toFixed(2),
            redirect: +(resource.redirectEnd - resource.redirectStart).toFixed(2),
            //dnsStart: +(resource.domainLookupStart).toFixed(2),
            dns: +(resource.domainLookupEnd - resource.domainLookupStart).toFixed(2),
            //tcpStart: +(resource.connectStart).toFixed(2),
            tcp: +((resource.secureConnectionStart > 0 ? resource.secureConnectionStart : resource.connectEnd) - resource.connectStart).toFixed(2),
            //sslStart: resource.secureConnectionStart > 0 ? +(resource.secureConnectionStart).toFixed(2) : 0,
            ssl: resource.secureConnectionStart > 0 ? +(resource.connectEnd - resource.secureConnectionStart).toFixed(2) : 0,
            //requestStart: +(resource.requestStart).toFixed(2),
            request: +(resource.responseStart - resource.requestStart).toFixed(2),
            //responseStart: +(resource.responseStart).toFixed(2),
            // ??? - Chromium returns zero for responseEnd for 3rd party URLs, bug?
            response: resource.responseStart == 0 ? 0 : +(resource.responseEnd - resource.responseStart).toFixed(2)
        }
    }

    var Reporter = global.F_MONITOR = {
        init: function(config) {
            this.setConfig(config);

            if (_errors.length) {
                _go();
            }

            if (!this.isStart) {
                this.start();
            }

            return this;
        },
        setConfig: function(config) {
            var clientIdStr = '',
                siteIdStr = '',
                urlStr = '',
                refer = '';

            for (var key in config) {
                _config[key] = config[key];
            }

            _config.rptAddr = _config.rptAddr || _rptAddr;
            //_config.userId = _config.userId || _makeRandomStr();
            clientIdStr = '&clientId=' + _config.clientId || '';
            siteIdStr = '&siteId=' + _config.siteId || '';
            _config.url && (urlStr = '&url=' + encodeURIComponent(_config.url));
            refer = '&refer=' + encodeURIComponent(config.refer || _config.refer);

            _config.reportPrefix = _config.rptAddr + '?' + _getIdStr(_config.userId) + urlStr + refer + clientIdStr + siteIdStr + '&rt=' + _makeRandomStr();
        },
        //将错误信息push到错误缓存中，等待report上报
        push: function(obj, forcePush) {
            //采样率
            if (!forcePush && Math.random() >= _config.sampling) {
                return this;
            }
            var data = _isObject(obj) ? _processError(obj) : {
                msg: obj
            };
            _errors.push(data);
            return this;
        },
        //上报
        report: function(obj, forceReport) {
            forceReport = (typeof(forceReport) === "undefined") ? false : forceReport;
            obj && this.push(obj, forceReport);
            _go();
            return this;
        },
        /**
         *   pv,perfromance上报
         */
        //start report
        start: function() {
            this.isStart = true;
            this.pvRpt();

            //确保在body末尾添加
            this.addEvent('load', function() {
                F_MONITOR.perfTimingRpt();
                //在页面结尾处插入script 执行monitor
                var body = document.getElementsByTagName('body')[0],
                    script = document.createElement('script');
                script.type = 'text/javascript';
                script.textContent = [
                    "var func = function() {",
                    "    F_MONITOR.pvRpt();",
                    "    F_MONITOR.perfTimingRpt()};",
                    "if (typeof Mobilebone !== 'undefined' && Mobilebone.changeHashCallBack) {",
                    "    Mobilebone.changeHashCallBack = func;}",
                ].join('');

                body.appendChild(script);
            });
        },
        //上报pv
        pvRpt: function() {
            var url = _config.reportPrefix + '&option=pageview';
            _request(url);
        },
        /**
         * 上报Performance timing数据；
         * 如果某个时间点花费时间为0，则此时间点数据不上报。
         * @params {Object}
         *      siteId 站点id
         *      clientId 客户端id
         *      userId 用户id,没有自动生成
         *      url 没有不传
         */
        perfTimingRpt: function() {
            var _this = this,
                timing, performance = (global.webkitPerformance ? global.webkitPerformance : global.msPerformance),
                timingKey = ["navigationStart", "unloadEventStart", "unloadEventEnd", "redirectStart", "redirectEnd", "fetchStart", "domainLookupStart", "domainLookupEnd", "connectStart", "connectEnd", "requestStart", "responseStart", "responseEnd", "domLoading", "domInteractive", "domContentLoadedEventStart", "domContentLoadedEventEnd", "domComplete", "loadEventStart", "loadEventEnd"],
                rtKey = ["start", "redirect", "dns", "tcp", "ssl", "request", "response", "duration", "name", "type"],
                keyValue = [],
                timing0, temp;
            performance = (performance ? performance : global.performance);
            if (performance && (timing = performance.timing)) {
                if (timing.loadEventEnd <= 0) {
                    setTimeout(function() {
                        _this.perfTimingRpt();
                    }, 200);
                    return;
                }
                timing0 = timing[timingKey[0]];
                for (var i = 1, l = timingKey.length; i < l; i++) {
                    temp = timing[timingKey[i]];
                    temp = (temp ? (temp - timing0) : 0);
                    if (temp > 0) {
                        keyValue.push(i + '=' + temp);
                    }
                }

                var url = _config.reportPrefix + '&option=perftiming&' + keyValue.join('&');
                _request(url);

                //reouceTiming report
                var resourceTimingArr = _getTimings(performance), temp = []; 
                keyValue = [];
                for(i = 0, len = resourceTimingArr.length; i < len; i ++){
                    temp = [];
                    for(var j = 0, lh = rtKey.length; j < lh; j++){
                        temp.push(resourceTimingArr[i][rtKey[j]]);
                    }
                    keyValue.push((i+1) + '=' + temp.join(','));
                }
                var bid = _makeRandomStr();
                while(keyValue.length){
                    url = _config.reportPrefix + '&option=resourceTiming&bid=' + bid + '&' + keyValue.splice(0, _config.rtLen).join('&');
                    _request(url);
                }
            }
        },
        //监听事件兼容
        addEvent: function(name, func) {
            if (global.attachEvent) {
                global.attachEvent("on" + name, func);
            } else {
                global.addEventListener(name, func);
            }
        },
    };
    F_MONITOR.init(global.fmonitorConf);
})(window, window.document);
