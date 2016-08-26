/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * @license MIT
 */

(function ($, window, undefined) {
  "use strict";

  var baseUrl = window['FILEHUB_BASEURL'] || '';

  var filehub = window['filehub'] = function () {
    var ctx = window['FILEHUB_CTX'],
        obj, post;
    filehub.setup(); /* Ensure the core objects are registered */
    if (ctx && typeof (filehub['ctx:' + ctx]) === 'function') {
      obj = window['FILEHUB_OBJ'] = filehub['ctx:' + ctx]();
      obj.context = ctx;
      post = filehub['post:'+ctx] || [];
      for (var i = 0; i < post.length; i++) {
        if (post[i] && typeof post[i] === 'function') {
          post[i].call(obj);
        }
      }
    }
  };

  if (typeof console !== 'undefined' && console.log && window['FILEHUB_DEBUG']) {
    filehub.debug = console.log.bind(console);
  } else {
    filehub.debug = function () {};
  }
  var debug = filehub.debug;


  var _postCount=0;
  // filehub.register([post,] ctx, fn [, setupFn])
  filehub.register = function (post, ctx, fn, setupFn) {
    var target;

    if (typeof post !== 'boolean') {
      setupFn = fn;
      fn = ctx;
      ctx = post;
      post = false;
    }

    if (typeof ctx !== 'string') {
      throw Error("register(): first argument must be a string");
    }

    target = (post?'post':'ctx')+':'+ctx;

    if (fn && typeof fn !== 'function') {
      throw Error("register(): second argument must be a function or null");
    }

    if (fn) {
      if (post) {
        // Register a function for post context initialization.
        // Used for admin-specific features, not required by regular users.
        if (!filehub[target]) filehub[target] = [];
        filehub[target].push(fn);
        _postCount++;
      } else {
        if (fn) filehub[target] = fn;
      }
    }

    if (typeof setupFn === 'function') {
      filehub.setup._load[post ? 'post'+_postCount : ctx] = setupFn;
    }
    return fn;
  };

  var _isSetup;
  filehub.setup = function () {
    if (_isSetup) return;
    _isSetup = true;

    var needDeps = [];

    debug("Running setup functions...");

    function loadOrPush(ctx, fn, array) {
      if (fn.call(filehub) === false) {
        array.push({ ctx: ctx, fn: fn });
      } else {
        debug("  '%s' loaded", ctx);
      }
    }

    // Setup as much as possible in the initial lookup
    for (var k in filehub.setup._load) {
      loadOrPush(k, filehub, needDeps);
    }

    // Now try to run remaining setup functions that returned false
    // If after a round, all functions returned false, abort.

    var l = needDeps.length;
    var nextDeps = [];
    var dep;

    while (l) {
      // Setup round ended ?
      if (!needDeps.length) {
        if (!nextDeps.length) break;

        // Round without any successful setup. Abort here to prevent infinite loop.
        if (nextDeps.length === l) {
          throw Error("setup(): Some setup functions requirements couldn't be satisfied.");
        }

        needDeps = nextDeps;
        nextDeps = [];
        l = needDeps.length;
      }

      dep = needDeps.pop();
      loadOrPush(dep.ctx, dep.fn, nextDeps);
    }

    debug("done.");
  };
  filehub.setup._load = {};

  filehub.support = {
    /* Picked up from answer to http://stackoverflow.com/questions/7263590/ */
    pointerEvents: (function () {
      var element = document.createElement('x'),
          documentElement = document.documentElement,
          getComputedStyle = window.getComputedStyle,
          supports;

      if (!('pointerEvents' in element.style)) return false;

      element.style.pointerEvents = 'auto';
      element.style.pointerEvents = 'x';
      documentElement.appendChild(element);
      supports = getComputedStyle &&
        getComputedStyle(element, '').pointerEvents === 'auto';
      documentElement.removeChild(element);
      return !!supports;
    })(),
    pushState: (function () {
      return window.history && typeof window.history.pushState === 'function';
    })()
  };

  filehub.ease = {
    inOutQuad: function (t, p, dp, d) {
      if (!(d > 0)) return p + dp; /* end position immediately */
      t /= d/2;
      if (t < 1) return p + t * t * dp/2;
      t--;
      return p - (t * (t-2) - 1) * dp/2;
    }
  };

  function _callIfSet(param, spec, elem, type, elemFuncName) {
    if (!elemFuncName) elemFuncName = param;
    var v = spec[param];
    if (typeof v === 'function' && type !== 'function') {
      v = v.call(spec, param, elem);
    }
    if (v != null && (!type || (typeof v === type))) {
      elem[elemFuncName](v);
    }
  }

  /**
   * tree is in the form (provided values are defaults). All parameters can be
   * functions that will be called to get the value.
   *
   * [
   *   { tag: 'div',
   *     cond: function () { return true; }, // this === spec of current element
   *     addClass: '',
   *     attr: {},
   *     prop: {},
   *     html: null,
   *     text: null,
   *     css: {},
   *     append: [
   *       // ...
   *     ],
   *     prepend: [
   *       // ...
   *     ],
   *     on: {} // an object with event listeners (see $().on())
   *   },
   *   // ...
   * ]
   */
  filehub.build = function (tree) {
    var coll = [],
        spec, elem;

    if (!$.isArray(tree)) {
      tree = [ tree ];
    }

    for (var i = 0; i < tree.length; i++) {
      spec = tree[i];

      if (!spec) continue;
      if (typeof spec.cond === 'function' && !spec.cond.call(spec)) continue;

      elem = $('<'+(spec.tag||'div')+'/>');
      _callIfSet('addClass', spec, elem, 'string');
      _callIfSet('text', spec, elem, 'string');
      _callIfSet('html', spec, elem, 'string');
      _callIfSet('attr', spec, elem, 'object');
      _callIfSet('prop', spec, elem, 'object');
      _callIfSet('css', spec, elem, 'object');
      if ($.isArray(spec.append)) {
        elem.append(filehub.build(spec.append));
      }
      if ($.isArray(spec.prepend)) {
        elem.prepend(filehub.build(spec.prepend));
      }
      if (spec.on) {
        elem.on(spec.on);
      }

      coll.push(elem.get(0));
    }

    return $(coll);
  }

  filehub.modMask = function (evt) {
    // ctrl = 1, alt = 2, shift = 4
    return (evt.ctrlKey ? 1 : 0)
         + (evt.altKey ? 2 : 0)
         + (evt.shiftKey ? 4 : 0);
  };

  filehub.messageBox = function (div, infos, prefix) {
    var title, wrap;
    prefix = prefix || 'message';
    div.addClass(prefix + '-box');

    if (!div.children().length) {
      div.append(filehub.build([
        { addClass: prefix+'-wrap',
          append: [
            { addClass: 'padding-box1' },
            { addClass: 'fixed-box',
              append: [
                {
                  tag: 'h1',
                  text: typeof infos === 'string' ? infos : (infos.title || '-')
                },
                {
                  tag: 'p',
                  addClass: 'note',
                  cond: function () { return !!infos.message; },
                  text: infos.message
                }
              ]
            },
            { addClass: 'padding-box2' },
          ],
        },
      ]));
    }
    return div;
  }

  filehub.errorBox = function (div, err) {
    return filehub.messageBox(div, {
      title: (err && err.title) || 'Unexpected error',
      message: (err && err.message) || 'An unexpected error occured.'
    }, 'error');
  }

  /** createClass(name [, proto])
   *
   * Filehub class initializer
   *
   * Returned constructors accept an optional 'options' object which
   * is merged with proto.options on instanciation.
   *
   * Filehub classes also implement .on(), .off() and .trigger()
   */
  filehub.createClass = function (name, proto) {
    if (!name) throw Error("class name required");

    proto = proto || {};

    var Constructor = function (options) {
      this.options = $.extend(true, {}, this.options || {}, options || {});

      this._actions = {};

      if (typeof this._init === 'function') this._init();
    }, Cproto = Constructor.prototype;

    filehub[name] = Constructor;

    Cproto._getAction = function (action) {
      if (!this._actions[action]) {
        this._actions[action] = $.Callbacks();
      }
      return this._actions[action];
    };

    Cproto.on = function (action) {
      var self = this;

      if (typeof action === 'string') {
        if (arguments.length === 1) return;
        var act = self._getAction(action);
        act.add.apply(act, Array.prototype.slice.call(arguments, 1));
      } else if (typeof action === 'object') {
        $.each(action, function (key, cb) {
          self._getAction(key).add(cb);
        })
      }

      return self;
    };
    Cproto.off = function (action) {
      var self = this, act;

      if (typeof action === 'string') {
        act = self._actions[action];
        if (!act) return;
        if (arguments.length > 1) {
          act.remove.apply(act, Array.prototype.slice.call(arguments, 1));
          if (act.has()) return;
        }
        delete self._actions[action];
      } else if (typeof action === 'object') {
        $.each(action, function (key, cb) {
          if ($.isArray(cb)) {
            cb = cb.slice(0);
            cb.shift(key);
            self.off.apply(self, cb);
          } else if (!cb) {
            self.off(key);
          } else {
            self.off(key, cb);
          }
        });
      }

      return self;
    };
    Cproto.trigger = function (action, args) {
      var act = this._actions[action];

      if (!act) return;

      act.fireWith(this, args||[]);

      return this;
    };

    $.extend(Cproto, proto);

    return Constructor;
  };

  var ctxNS = 0,
      NS='fh-context-menu';
  $.fn.contextMenu = function (options) {
    if (typeof options === 'string') {
      var res = this,
          win = $(window),
          args = arguments,
          evt,
          sw, sh;

      switch (options) {
        case 'show':
          evt = args[1] || { pageX: 0, pageY: 0 };
          sw = win.width();
          sh = win.height();

          res.each(function () {
            var el = $(this),
                data = el.data(NS),
                w, h;

            if (!data) {
              console.warn("Trying to show uninitialized contextMenu element");
              return;
            }

            el.css({ display: 'block', visibility: 'hidden' });

            w = el.innerWidth();
            h = el.innerHeight();

            el.css({
              display: 'none',
              visibility: '',
              left: (evt.pageX + w) > sw ? Math.max(0, evt.pageX - w) : evt.pageX,
              top: (evt.pageY + h) > sh
                   ? Math.max(0, (evt.pageY >= h ? evt.pageY : sh) - h)
                   : evt.pageY
            }).fadeIn('fast');

            win.off(data._ns);
            // Delay required to allow clicks on buttons to trigger the context
            // menu
            setTimeout(function () {
              win.on('click'+data._ns+' contextmenu'+data._ns, function (e) {
                if ($(e.target).closest(el).length) return;
                win.off(data._ns);
                el.hide();
              });
            }, 10);
          });
          break;
        case 'hide':
          res.hide();
          des.css('min-width', ''); // XXX Hacky hacky to manage with bound button
          res.each(function () {
            var data = $(this).data(NS);
            if (!data) return;
            win.off(data._ns);
          });
          break;
        default:
          console.warn("Unknown contextMenu method: "+options);
          return;
      }

      return res;
    }

    return this.each(function () {
      var el = $(this),
          data = el.data(NS),
          opts = $.extend(data || {
            _ns: '.'+NS+(++ctxNS)
          }, options||{});

      if (data) {
        // Propagate options effects here if any.
        return;
      }

      el.on('click.'+NS, 'li', function (e) {
        if (!$(this).data('action')) return;

        if (typeof opts.click === 'function') {
          e.preventDefault();
          opts.click.call(this, e);
        }
      }).data(NS, opts).hide();
    });
  };

  // Load active context once DOM is ready
  $(filehub);
})(jQuery, window);
