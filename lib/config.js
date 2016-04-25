/*
 * Copyright (c) 2016 Raphaël Bois Rousseau
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software  and associated  documentation  files (the  "Software"), to
 * deal in the Software without  restriction, including  without limitation the
 * rights to use, copy, modify, merge,  publish, distribute, sublicense, and/or
 * sell copies of the Software,  and to permit persons  to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice  and this permission notice  shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED  "AS IS", WITHOUT WARRANTY  OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING  BUT NOT  LIMITED TO THE  WARRANTIES OF  MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND  NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR  COPYRIGHT  HOLDERS BE  LIABLE FOR  ANY CLAIM,  DAMAGES  OR OTHER
 * LIABILITY,  WHETHER IN AN  ACTION OF  CONTRACT, TORT  OR OTHERWISE,  ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

var fs = require('fs');
var resolve = require('path').resolve;

var merge = require('./utils').merge;

function configure(cb) {
  var nodeEnv = (process.NODE_ENV||'development').replace(/\$/g, '$$$$');
  var configDefaults = resolve(__dirname, '../config.json');
  var configPath = process.env.FILEHUB_CONFIG;
  var configEnvPath = (configPath||configDefaults).replace(/(\.json)$/, '.'+nodeEnv+'$1');

  var config = {}, paths = [ configDefaults ];
  if (configPath) paths.push(resolve(configPath));
  if (configEnvPath !== configPath) paths.push(resolve(configEnvPath));

  function readNext() {
    var p = paths.shift();
    if (!p) {
      return cb(config);
    }

    fs.readFile(p, 'utf-8', function (err, data) {
      if (!err) {
        data = JSON.parse(data);
        if (typeof data === 'object') {
          merge(true, config, data);
        }
      }
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
