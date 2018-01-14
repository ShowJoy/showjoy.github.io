#! /usr/bin/env node
let process = require('child_process');
let fs = require('fs');
let http = require('http');

function getVersions() {
  return new Promise((resolve, reject) => {
    http.get('http://element.eleme.io/versions.json', (res) => {
      const { statusCode } = res;
      let error;
      if (statusCode !== 200) {
        error = new Error(`Request failure, status code: ${statusCode}`);
      }
      if (error) {
        res.resume();
        reject(error.message);
        return;
      }
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(e.message);
        }
      });
    }).on('error', (e) => {
      reject(`error: ${e.message}`);
    });
  });
}

getVersions().then(online => {
  let local = fs.readFileSync('versions.json', 'utf8');
  if (!isSame(JSON.parse(local), online)) {
    process.exec('git pull origin gh-pages && git push me master --force && npm version patch && npm publish', (code, stderr, stdout) => {
      if (code) {
        console.log(`code: ${code}`);
        return;
      }
      console.log('publish success!');
    });
  } else {
    console.log('yes');
  }
}).catch(error => {
  console.log(error);
});

function isSame(local, online) {
  for (let key in online) {
    if (!local[key]) {
      return false;
    }
  }
  return true;
}