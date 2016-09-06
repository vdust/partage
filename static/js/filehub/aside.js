/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  var Aside = filehub.createClass('Aside', {
    options: {
      idPrefix: 't-',
      aside: '#view-aside',
      expandSelector: '.fa',
      expandClasses: 'fa-caret-right fa-caret-down' // 'collapsed expanded'
    },
    _init: function () {
      var self = this,
          opts = self.options;

      self.aside = $(opts.aside);
      self.buttonBox = self.aside.children('.button-box');
      self.treeBox = self.aside.children('.tree-box');

      self.treeIdPrefix = self.treeBox.data('id-prefix') || 't-';

      self.aside.on('contextmenu', function (e) {
        e.preventDefault();
      });
      self.buttonBox.on('click', 'button', function (evt) {
        var button = $(this);

        if (button.prop('disabled')) return;

        self.trigger('button', [ button ]);
      });

      self.treeBox.on('click', '.tree-item-subtree > .tree-expand', function (evt) {
        var fa = $(this).children(opts.expandSelector);
        fa.toggleClass(opts.expandClasses);
        $(this).closest('.tree-item').next('.tree').slideToggle(300);
      }).on('click', '.tree-item', function (evt) {
        var item = $(this);

        if ($(evt.target).closest('.tree-expand').length || item.hasClass('active')) {
          return;
        }

        self.select(null, item);
      });
    },
    enable: function (enable) {
      var buttons = this.buttonBox.find('button');

      if (arguments.length === 0) enable = true;

      buttons.prop('disabled', !enable);
    },
    resize: function (width) {
      this.aside.width(width);
    },
    width: function () {
      return this.aside.width();
    },
    getItem: function (uid) {
      if (!uid) {
        return this.treeBox.children('.tree').children().first();
      }
      return $('#'+this.options.idPrefix + uid);
    },
    select: function (uid, item) {
      var self = this,
          opts = self.options;

      if (!uid && !item) {
        item = self.treeBox.find('.tree-item:eq(0)');
      } else if (!uid) {
        uid = item.data('uid');
      } else if (!item) {
        item = $('#' + opts.idPrefix + uid);
      }

      if (!item.hasClass('active')) {
        self.treeBox.find('.active').treeItemActive(false);
        if (item.hasClass('tree-item')) {
          item.treeItemActive(true);
          var p = item.closest('.tree');
          while (p.length && !p.is(':visible')) {
            p = p.prev('.tree-item');
            p.children('.tree-expand').click();
            p = p.parent('.tree');
          }
        }
        self.trigger('select', [ uid, item ]);
      }
    },
    /**
     * tree is a list of nodes child of rootUid
     */
    update: function (rootUid, items) {
      var self = this,
          opts = self.options,
          root = $('#' + opts.idPrefix + rootUid),
          tree = root.next('.tree'),
          expand = opts.expandClasses.split(/ +/),
          depth, stack = [], current;

      if (!root.length || !items || !items.length) {
        tree.remove();
        root.children('.tree-expand').html('<span/>');
        return;
      }

      if (!tree.length) {
        tree = $('<div class="tree"/>').insertAfter(root).hide();
        root.children('.tree-expand')
            .append($('<span class="fa"/>').addClass(expand[0]));
      } else {
        tree.empty();
      }
      depth = root.children('.tree-pad').length + 1;

      stack.push({ items: items, i: 0, tree: tree });
      while (stack.length) {
        current = stack.pop();
        for (; current.i < current.items.length; current.i++) {
          var item = current.items[current.i];
          var el = $('<div/>').treeItem({
            label: item.label,
            icon: item.icon,
            subtree: item.subtree && item.subtree.length > 0,
            expand: (item.subtree && item.subtree.length) ? { off: expand[0], on: expand[1] } : false,
            depth: depth + stack.length,
            idPrefix: opts.idPrefix,
            uid: item.uid,
            active: item.active,
            'class': item['class'],
            data: item.data
          }).appendTo(current.tree);

          if (item.subtree && item.subtree.length) {
            stack.push(current);
            current = {
              items: item.subtree,
              i: 0,
              tree: $('<div class="tree"/>')
                .hide()
                .appendTo(current.tree)
            };
          }
        }
      }
    }
  });

  /**
   * .treeItem({
   *   label: '',
   *   icon: '', // or { on: 'classactive', off: 'classinactive' }
   *   subtree: false,
   *   expand: { on: 'fa-caret-down', off: 'fa-caret-right' },
   *   depth: 0, // for left padding
   *   uid: '',
   *   active: false,
   *   class: '',
   *   data: null
   * });
   */
  $.fn.treeItem = function (options) {
    var icon = options.icon;

    this.empty()
      .addClass('tree-item')
      .toggleClass('tree-item-subtree', options.subtree)
      .addClass(options['class'] || '');

    if (typeof icon === 'string') {
      icon = { off: icon, on: icon };
    }

    this.append(filehub.build([
      {
        addClass: 'tree-expand',
        append: [
          {
            tag: 'span',
            addClass: (options.subtree && options.expand) ? options.expand.off : ''
          }
        ]
      },
      {
        addClass: 'tree-icon',
        append: [
          {
            tag: 'span',
            addClass: icon ? 'fa ' + icon.off : ''
          }
        ]
      },
      {
        addClass: 'tree-label',
        text: options.label || ''
      }
    ]));

    if (options.depth > 0) {
      for (var i = 0; i < options.depth; i++) {
        this.prepend('<div class="tree-pad"/>');
      }
    }

    if (options.uid) {
      this.attr('id', options.idPrefix + options.uid);
      this.data('uid', options.uid);
    }

    if (typeof options.icon === 'object') {
      this.data({
        'ico-on': options.icon.on,
        'ico-off': options.icon.off
      });
    }

    this.data(options.data||{});

    if (options.active) this.treeItemActive();

    return this;
  }

  $.fn.treeItemActive = function (active) {
    active = arguments === 0 ? true : !!active;

    this.toggleClass('active', active);

    var icoOn = this.data('ico-on'),
        icoOff = this.data('ico-off');

    if (icoOn && icoOff) {
      // icoOn and icoOff can contain common classes so we must remove all
      // then add the current state to avoid side effects
      this.find('.tree-icon > span')
        .removeClass(icoOff + ' ' + icoOn)
        .addClass(active ? icoOn : icoOff);
    }

    return this;
  };

})(jQuery, window);
