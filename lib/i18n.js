/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

var i18n = require('i18next');
var i18n_mw = require('i18next-express-middleware');
var i18n_be = require('i18next-node-fs-backend');

exports = module.exports = function init(options, app) {
  i18n.use(i18n_mw.LanguageDetector)
      .use(i18n_be)
      .init(options||{});

  app.locals.t = exports.t;
  app.use(i18n_mw.handle(i18n, {}));
};

exports.t = i18n.getFixedT(null, 'partage');

exports.formatSize = function formatSize(size) {
  var s, units = 'ukmgt'.split(''), u = -1;

  do {
    s = size;
    u++;
    size = size / 1024;
  } while (u < units.length - 1 && size > 0.9);

  if (s < 10 && u) {
    s = Math.round(s * 10)/10;
  } else {
    s = Math.round(s);
  }

  return ''+s+' '+i18n.t('size.'+units[u]);
};
