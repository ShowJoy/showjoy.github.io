var fs = require('fs'),
		pathUtil = require('path'),
		lineReader = require('line-reader'),
		Promise = require('bluebird'),
		eachLine = Promise.promisify(lineReader.eachLine);

fs.readFile('filecofig.json', function(err, data){
	if (err) {
    return console.error(err);
  }
  var dt = JSON.parse(data.toString()),
		  dir = dt['accesses']['dir'],
		  files = dt['accesses']['files'],
		  dest = dt['accesses']['dest'];
  
  files.forEach(function (file){
  	var start = +new Date();
  	var topath = dest + pathUtil.basename(file,'.log') + '.json';
  	logToJson(dir + file, topath, false, function(){
  		var end = +new Date();
  		var diff = end - start;
  		console.log(diff / (1000*60) + ' minutes');
  	});
  });
});

/**
* analysis nginx logs and transform to json file
* @path origin path
* @topath destination 
* @type boolean access:true,error:false
* @cb callback function
*/
var i = 0;
var logToJson = function(path, topath, type, cb){
	var jsonBuffer = '';
	var ws = fs.createWriteStream(topath,{flags:'a+',encoding:'utf-8'});
	eachLine(path,function (line,last){
		jsonBuffer = JSON.stringify(type ? dealAccess(line) : dealAccess2(line)) + '\n'
 		ws.write(jsonBuffer);
		i++;
		console.log('line:' + i);
	}).then(function (){
		ws.end();
		cb();
		console.log('analysis is done!');
	}).catch(function(err) {
	  console.error(err);
	});
};

//analysis line of log and extract valuable data 
var dealAccess = function (line){
		var temp = {};
		var regexp = new RegExp(/^([\.\d\-]+)\s([\.\d\-]+)\s([\.\d\-]+)\s\[([\w\:\+\s\/]+)\]\s"([\w\.\s\/\-\?\=\&\,]+)"\s([\d\-]+)\s([\-\d]+)\s"([\w\:\/\.\-]+)"\s"([\w\,\s\/\;\.\(\)\-]+)"/);
		var data = line.match(regexp);
		if(data){
			temp['ip'] = data[1] || '';
			temp['time'] = data[4] || '';
			temp['url'] = data[5] || '';
			temp['statusCode'] = data[6] || '';
			temp['bodyLen'] = data[7] || '';
			temp['referer'] = data[8] || '';
			temp['ua'] = data[9] || '';
		}
		return temp;
};

var dealAccess2 = function (line){
		var temp = {};
		//var regexp = new RegExp(/^"([\w\/\:\+\s\-]+)"\s?"([\d\.\-]+)"\s?"([\d\-]+)"\s?"([\d\.\-]+)"\s?"([\w\.\-]+)"\s?"([\w\.\s\/\-\?\=\&\,]+)"\s?"([\w\.\:\-]+)"\s?"([\w\/\.\s\,\;\(\)\-]+)"\s?"([\d\.\-]+)"\s?"([\d\.\-]+)"\s?"([\w\:\.\/\-]+)"\s?"([\d\.\-]+)"\s?"([\w\:\.\s\/\-\?\=\&\,]+)"/);
		var regexp = new RegExp(/^"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"\s?"(.+)"$/);
		var data = line.match(regexp);
		if(data){
			temp['time'] = toTimestamp(data[1] || '');
			temp['statusCode'] = data[2] || '';
			temp['bodyLen'] = data[3] || '';
			temp['ip'] = data[4] || '';
			temp['host'] = data[5] || '';
			temp['url'] = data[6] || '';
			temp['proxy'] = data[7] || '';
			temp['ua'] = data[8] || '';
			temp['requestTime'] = data[9] || '';
			temp['upstreamTime'] = data[10] || '';
			temp['location'] = data[11] || '';
			temp['upstreamStatus'] = data[12] || '';
			temp['referer'] = data[13] || '';
		}
		return temp;
};

/**
* @str 23/Nov/2015:10:57:26 +0800
* @return int timestamp
*/
var toTimestamp = function (str){
	var reg = /(\d+)\/([a-zA-Z]+)\/(\d+)\:(\d+\:\d+\:\d+\s+[+\d]+)/;
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var m = str.replace(reg, "$2");
  var index = -1;
  months.forEach(function(item,i){
  	if (m == item){
  		index = i + 1;
  		return;
  	}
	});
  var dt = str.replace(reg, "$3-" + index + "-$1 $4");
  return +new Date(dt);
};