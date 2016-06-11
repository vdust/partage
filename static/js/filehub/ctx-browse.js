/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!filehub) throw Error("filehub is not defined.");

  function updateUrl(url, state) {
    if (filehub.support.pushState) {
      window.history.pushState(state, "", url);
    } else {
      location.assign(url); // Should stop script execution
    }
  }

  filehub.register('browse', function () {
    var View = filehub.View;
    var poppingState;
    var browse = new View({
    }).on('refresh', function (uid, item) {
      if (!poppingState) {
        updateUrl(item.data('url'), {
          ctx: this.context,
          url: item.data('url'),
          uid: uid
        });
      }

      var navlist = [], tree;

      do {
        navlist.unshift({
          label: item.children('.tree-label').text(),
          cls: 'subdir',
          data: { uid: item.data('uid') }
        });

        tree = item.closest('.tree');
        item = tree.prev('.tree-item');
      } while (item.length);

      this.nav.update(navlist);
    }).on('load', function (uid, item, callback) {
      var self = this;

      $.get(item.data('url')+'?list-only=1', function (html) {
        var list = $('<div/>').html(html).children('.list-box');

        if (list.length) {
          callback(null, list);
        } else {
          callback({ statusCode: 404, textStatus: 'error', error: 'Not Found' });
        }
      }).fail(function (jqxhr, textStatus, error) {
        callback({ statusCode: jqxhr.statusCode(), textStatus: textStatus, error: error });
      });
    }).on('activate', function (listrow) {
      switch(listrow.data('type')) {
        case 'folder':
          this.sidePanel.select(listrow.data('uid'));
          break;
        default:
          // TODO: download/preview files
      }
    });

    $(window).on('popstate', function (evt) {
      var state = evt.originalEvent.state;

      if (state && state.ctx === browse.context) {
        poppingState = true;
        browse.sidePanel.select(state.uid);
        poppingState = false;
      }
    });

    return browse;
  });
})(jQuery, window);
