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

module.exports = function (manager) {
  var browse = require('express').Router();
  var readable = manager.folderAccessHandler('read');

  browse.get('/', function (req, res) {
    var folders = manager.userFolders(req.user);
    res.render(req.query['list-only'] ? 'folder' : 'browse', {
      menuCtx: 'browse',
      folders: folders,
      path: [],
      pathid: '0',
      dirs: folders,
      files: []
    });
  });

  browse.get(new RegExp('^/([^./][^/]*/?)(.*)$'), readable, function (req, res) {
    var folder = req.folder,
        p = req.folderPath;

    folder.list(p.join('/'), function (err, files, dirs) {
      if (err && err.fatal) {
        return res.status(403).render('error');
      }
      res.render(req.query['list-only'] ? 'folder' : 'browse', {
        menuCtx: 'browse',
        folders: manager.userFolders(req.user),
        folder: folder,
        path: p,
        pathid: folder.getPathUid(p.join('/')),
        files: files,
        dirs: dirs,
        err: err
      });
    });
  });

  browse.get('/.trash', function (req, res) {
    manager.trash.list(req.user, function (err, items) {
      if (err && err.fatal) {
        return res.status(403).render('error');
      }
      return res.render(req.query['list-only'] ? 'folder' : 'browse', {
        menuCtx: 'browse',
        folders: manager.userFolders(req.user),
        folder: null,
        path: [],
        pathid: 'trash',
        trash: items
      });
    });
  });

  return browse;
}
