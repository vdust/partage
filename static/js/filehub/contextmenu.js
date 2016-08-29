/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */
(function ($, window, undefined) {
  'use strict';

  var ctxNS = 0,
      NS='fhcontextmenu';

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

            win.off(data._ns);

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
            }).fadeIn('fast', function () {
              el.attr('tabindex', 0).focus();
              el.trigger('shown.'+NS);
            });

            // Delay required to allow clicks on buttons to trigger the context
            // menu
            setTimeout(function () {
              win.on('click'+data._ns+' contextmenu'+data._ns, function (e) {
                if ($(e.target).closest(el).length) return;
                el.contextMenu('hide');
              });
            }, 1);
          });
          break;
        case 'hide':
          res.attr('tabindex', -1).blur();
          res.hide();
          res.css('min-width', ''); // XXX Hacky hacky to manage with bound button
          res.each(function () {
            var data = $(this).data(NS);
            if (!data) return;
            win.off(data._ns);
          });
          res.trigger('hidden.'+NS);
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

}(jQuery, window));
