/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

var fs = require('fs');
var resolve = require('path').resolve;

var regEscape = require('./utils').regexpEscape;
var merge = require('./utils').merge;

function configure(cb, stack) {
  var nodeEnv = (process.env.NODE_ENV||'development').replace(/\$/g, '$$$$');
  var configDefaults = resolve(__dirname, '../config.json');
  var configPath = process.env.PARTAGE_CONFIG;
  var configEnvPath = (configPath||configDefaults).replace(/(\.json)$/, '.'+nodeEnv+'$1');

  if (configPath && RegExp(regEscape(nodeEnv)+'\\.json$').test(configPath)) {
    configEnvPath = configPath;
  }

  var config = {}, paths = [ configDefaults ];
  if (configPath) paths.push(resolve(configPath));
  if (configEnvPath !== configPath) paths.push(resolve(configEnvPath));

  var loaded = [];
  function readNext() {
    var p = paths.shift();
    if (!p) {
      if (stack) config.stack = loaded;
      return cb(config);
    }

    fs.readFile(p, 'utf-8', function (err, data) {
      if (!err) {
        try {
          data = JSON.parse(data);
          if (typeof data === 'object') {
            merge(true, config, data);
          } else {
            data = {};
          }
        } catch (e) {
          console.error("%s", e);
          data = {}; err = e;
        }
      } else { data = {}; }

      if (stack) loaded.push({ path: p, data: data || {}, err: err });
      readNext();
    });
  }

  readNext();
};

module.exports = configure;

configure.lookup = function lookup(conf, path, _default) {
  var value = conf, k, i;

  path = Array.isArray(path) ? path : path.split('.');

  for (i = 0; i < path.length; i++) {
    if (typeof value !== 'object') return _default;
    k = path[i];
    value = value[k];
  }

  return value;
}
