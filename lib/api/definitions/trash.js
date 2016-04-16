/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var notImplemented = require('../../error').notImplemented;

var Folder = require('../../manager/folder');
var Trash = require('../../manager/trash');


function trashList(req, res, next) {
  this.scan(req.user, function (err, items) {
    if (err) next(err);
    res.status(200).send(items);
  });
}

function trashEmpty(req, res, next) {
  this.empty(req.user, function (err) {
    if (err) next(err);
    res.status(204).end();
  });
}

function trashGet(req, res, next) {
  this.stat(req.user, req.params.uid, function (err, infos) {
    if (err) return next(err);
    res.status(200).send(infos);
  });
}

function trashDelete(req, res) {
  this.remove(req.user, req.params.uid, function (err) {
    if (err) return next(err);
    res.status(204).end();
  });
}

function trashRestore(req, res) {
  this.trash(req.user, req.params.uid, function (err, resource) {
    if (err) return next(err);
    res.status(200).send(resource.toJSON(req.user));
  });
}

module.exports = function (manager) {
  return [
    { path: "/trash",
      authAs: "contributor",
      methods: {
        get: { doc: "List trashed resources",
          handle: trashList.bind(manager.trash)
        },
        'delete': { doc: "Empty trash",
          handle: trashEmpty.bind(manager.trash)
        }
      }
    },
    { path: "/trash/:uid",
      authAs: "contributor",
      params: {
        uid: { doc: "Trashed item id",
          validate: trash.checkUid }
      },
      methods: {
        get: { doc: "Get trashed resource infos",
          handle: trashGet.bind(manager.trash)
        },
        'delete': { doc: "Delete trashed resource",
          handle: trashDelete.bind(manager.trash)
        }
      }
    },
    { path: "/trash/:uid/restore",
      authAs: "contributor",
      params: {
        uid: { doc: "Trashed item id",
          validate: trash.checkUid }
      },
      methods: {
        post: { doc: "Restore trashed resource",
          body: {
            path: { doc: "Restore at this location instead of original location",
              validate: Folder.checkPath },
            recursive: { doc: "Create missing parent directory (excluding root folder)",
              type: 'flag' },
            rename: { doc: "Rename the restored resource if target location exists.",
              type: 'flag' },
            replace: { doc: "Replace resource at target location if it exists.",
              type: 'flag' }
          },
          handle: trashRestore.bind(manager.trash)
        }
      }
    }
  ];
};
