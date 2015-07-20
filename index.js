var bouncy   = require("bouncy");
var etchosts = require("etchosts");
var got      = require("got");
var collect  = require('stream-collect');  
var lodash   = require("lodash");
var templates = require("./lib/templates");

var HOST = "manage.hosts";
var APP_NAME = "manage.hosts";

var config = {};
var hosts = [{
  domains: [HOST],
  ip: "127.0.0.1"
}];

function setHosts(done) {
  etchosts.add(APP_NAME, hosts, done);
}

function add(data, done) {
  config = lodash.assign(config, data);
  for(var key in data) {
    var val = data[key];
    hosts.push({
      domains: [key],
      ip: val.replace(/:[0-9]+/, "")
    });
  }
  setHosts(done);
}

function remove(data, done) {
  data.forEach(function(domain) {
    delete config[domain];
  });

  hosts = lodash.filter(hosts, function(item) {
    if(data.indexOf(item.domains[0]) > -1) {
      return false;
    }
    return true;
  });
  setHosts(done);
}

module.exports.start = function(port, done) {
  port = port || 80;

  var server = bouncy(function (req, res, bounce) {
    var host = req.headers.host;

    if(host === HOST) {

      if(req.method === "POST") {
        collect(req, function(body) {
          var body = JSON.parse(body);
          add(body, function() {
            res.statusCode = 200;
            res.end();
          })
        });
        return;
      } else if(req.method === "DELETE") {
        collect(req, function(body) {
          var body = JSON.parse(body);
          remove(body, function() {
            res.statusCode = 200;
            res.end();
          });
        });
        return;
      } else if(req.method === "GET") {
        res.statusCode = 200;
        res.end(templates.list({
          appName: APP_NAME,
          apps: lodash.map(config, function(redirect, href) {
            return {
              href: "http://"+href,
              redirect: redirect
            };
          })
        }));
      }
    }

    if(config.hasOwnProperty(host)) {
      bounce(config[host]);
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });

  server.listen(port, function() {
    setHosts(function() {
      done(server);
    })
  });
};

module.exports.stop = function(done) {
  etchosts.remove(APP_NAME, done);
}


module.exports.started = function(done) {
  // So we can query if it's started globally
  got("http://"+HOST, function(err) {
    done(!!err);
  });
};

module.exports.add = function(data, done) {
  // So we can query if it's started globally
  got.post("http://"+HOST, {body: JSON.stringify(data)}, function(err) {
    done(!!err);
  });
};

module.exports.remove = function(data, done) {
  if(!Array.isArray(data)) {
    data = Object.keys(data);
  }

  // So we can query if it's started globally
  got.delete("http://"+HOST, {body: JSON.stringify(data)}, function(err) {
    done(!!err);
  });
};