/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var Folder = require('../../manager/folder');
var notImplemented = require('../../utils').notImplemented;

function trashList(req, res) {
  notImplemented(res);
}

function trashEmpty(req, res) {
  notImplemented(res);
}

function trashGet(req, res) {
  notImplemented(res);
}

function trashDelete(req, res) {
  notImplemented(res);
}

function trashRestore(req, res) {
  notImplemented(res);
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
    { path: "/trash/:itemId",
      authAs: "contributor",
      methods: {
        get: { doc: "Get trashed resource infos",
          handle: trashGet.bind(manager.trash)
        },
        'delete': { doc: "Delete trashed resource",
          handle: trashDelete.bind(manager.trash)
        }
      }
    },
    { path: "/trash/:itemId/restore",
      authAs: "contributor",
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
