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

"use strict";

var i18n = require('i18next');
var i18n_mw = require('i18next-express-middleware');
var i18n_be = require('i18next-node-fs-backend');

module.exports = function init(options, app) {
  i18n.use(i18n_mw.LanguageDetector)
      .use(i18n_be)
      .init(options||{});

  app.locals.t = i18n.t.bind(i18n);
  app.use(i18n_mw.handle(i18n, {}));
};

module.exports.t = i18n.t.bind(i18n);
