/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

(function ($, window, document, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  function prependSorted(container, list) {
    list.sort(function (a, b) {
      var ka = a.data('key'),
          kb = b.data('key');
      return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });
    $.fn.prepend.apply(container, list);
  }

  filehub.createClass('AccessList', {
    options: {
      api: null, /* new filehub.Api() */
      dialog: '#acl_dialog'
    },
    _init: function () {
      var self = this,
          o = self.options,
          d, ld, lst, sel;

      self.api = o.api || new filehub.Api();
      self.dialog = d = $(o.dialog);
      self.title = d.find('.modal-title');

      d.modal({ show: false });

      ld = self.aclLoading = {
        body: d.find('.acl-loading'),
        btn: d.find('.acl-btnLoading')
      };
      ld.all = $([ ld.body.get(0), ld.btn.get(0) ]);

      lst = self.aclList = {
        body: d.find('.acl-list'),
        ul: d.find('.acl-list > ul'),
        btn: d.find('.acl-btnList')
      };
      lst.all = $([ lst.body.get(0), lst.btn.get(0) ]);
      lst.user = lst.ul.children('li.user').eq(0).detach();
      lst.add = lst.ul.children('li.add').children('button');
      lst.add.on('click', function (evt) {
        evt.preventDefault();
        self.aclAll.hide();
        sel.all.show();
        d.modal('handleUpdate');
        sel.div.find('input').each(function () {
          var input = $(this);
          input.prop('checkbox', !!input.attr('checkbox'));
        });
      });

      sel = self.aclSelect = {
        body: d.find('.acl-select'),
        div: d.find('.acl-select > div'),
        btn: d.find('.acl-btnSelect')
      };
      sel.all = $([ sel.body.get(0), sel.btn.get(0) ]);

      self.aclAll = $([
        ld.body.get(0), ld.btn.get(0),
        lst.body.get(0), lst.btn.get(0),
        sel.body.get(0), sel.btn.get(0)
      ]);

      d.on('show.bs.modal', function (evt) {
        self.aclAll.hide();
        ld.all.show();
      });

      d.find('.modal-footer').on('click', 'button', function () {
        var action = $(this).data('action');
        switch (action) {
          case 'cancel':
            d.trigger('abort.fh');
            break;
          case 'cancel-select':
            self.aclAll.hide();
            lst.all.show();
            d.modal('handleUpdate');
            break;
          case 'select':
            d.trigger('select.fh');
            break;
          case 'update':
            d.trigger('update.fh');
            break;
        }
      });

      self.counter = 0;
    },
    edit: function (folderName, success, error) {
      var self = this,
          uid = ++self.counter,
          d = self.dialog;

      self.title.text(self.title.data('text').replace('{folder}', folderName));

      if (self.pendingAjax) {
        self.pendingAjax.abort();
        delete self.pendingAjax;
      }

      d.modal('show');

      d.one('abort.fh.fh'+uid, function (evt, err, jqxhr) {
        d.off('.fh'+uid);
        d.modal('hide');

        if (err) error(err, jqxhr);
      }).on('select.fh.fh'+uid, function (evt) {
        self._select();
      }).one('update.fh.fh'+uid, function (evt) {
        d.off('.fh'+uid);
        d.modal('hide');
        self._update(folderName, success, error);
      });

      self.pendingAjax = self.api.stat(folderName).done(function (foldInfos, st, jqxhr) {
        self.pendingAjax = self.api.accountsList({
          accessLevel: 'user'
        }).done(function (users, st, jqxhr) {
          var acl = (foldInfos && foldInfos.accessList) || {},
              usr = (users && users.user) || {};
          delete self.pendingAjax;
          self.populate(acl, usr);
        }).fail(function (jqxhr, st, err) {
          delete self.pendingAjax;
          d.trigger('abort.fh', err !== 'abort' ? [ JSON.parse(err), jqxhr ] : []);
        });
      }).fail(function (jqxhr, st, err) {
        delete self.pendingAjax;
        d.trigger('abort.fh', err !== 'abort' ? [ JSON.parse(err), jqxhr ] : []);
      });
    },
    populate: function (accessList, users) {
      var self = this,
          lst = self.aclList,
          sel = self.aclSelect,
          idx = 0,
          usersMap = {},
          i, u, pending, id, ckb, lbl;

      lst.ul.children('.user').remove();

      pending = [];
      for (i = 0; i < users.length; i++) {
        u = users[i].username;
        usersMap[u] = users[i];

        id = 'acl_u'+(++idx);
        ckb = $('<input id="'+id+'" type="checkbox"/>').val(u);
        usersMap[u].ckb = ckb;
        lbl = $('<label for="'+id+'"/>').text(u);
        if (accessList[u] != null) ckb.prop('defaultChecked', true);
        pending.push($('<div/>')
          .attr('data-key', u)
          .data('key', u)
          .append(ckb, '&nbsp;', lbl)
        );
      }
      if (pending.length) {
        sel.div.empty().append.apply(sel.div, pending);
      }

      self._addUser = function (username, acl) {
        var item = lst.user.clone();
        item.data('key', username);
        item.children('button').on('click', function (evt) {
          var btn = $(this);
          evt.preventDefault();
          evt.stopPropagation();
          btn.parent().remove();
          usersMap[username].ckb.prop('defaultChecked', false);
        });
        item.children('span.username').text(username);
        item.children('select').val(acl === 'rw' ? 'rw' : 'ro');
        return item;
      };

      pending = [];
      for (u in accessList) {
        if (!usersMap[u]) continue; // discard non-matching users
        pending.push(self._addUser(u, accessList[u]));
      }
      if (pending.length) {
        prependSorted(lst.ul, pending);
      }

      self.aclAll.hide();
      lst.all.show();
      self.dialog.modal('handleUpdate');
    },
    _update: function (folderName, success, error) {
      var self = this,
          acl = {};

      self.aclList.ul.children('.user').each(function () {
        var li = $(this),
            user = li.data('key');
        acl[user] = li.children('select').val() || 'ro';
      });

      self.pendingAjax = self.api.updateFolder(folderName, {
        accessList: acl
      }).done(function () {
        delete self.pendingAjax;
        success(acl);
      }).fail(function (jqxhr, st, err) {
        delete self.pendingAjax;
        if (err && err !== abort) error(JSON.parse(err), jqxhr);
      });
    },
    _select: function () {
      var self = this,
          pending = [],
          prev = self.aclList.ul.children('.user').detach().toArray(),
          head = prev.length ? $(prev[0]) : $(),
          u = head.data('key');

      // Both lists are sorted at this point so order will be preserved at all
      // time
      self.aclSelect.div.children().each(function () {
        var el = $(this),
            user = el.data('key');

        if (!el.children('input').prop('checked')) return;

        while (prev.length && user > u) {
          prev.shift();
          head = prev.length ? $(prev[0]) : $();
          u = head.data('key');
        }

        if (user === u) {
          pending.push(head);
        } else {
          pending.push(self._addUser(user));
        }

        el.children('input').prop('defaultChecked', true);
      });

      $.fn.prepend.apply(self.aclList.ul, pending);

      self.aclAll.hide();
      self.aclList.all.show();
      self.dialog.modal('handleUpdate');
    }
  });
}(jQuery, window, document));
