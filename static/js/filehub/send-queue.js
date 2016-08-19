/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

(function ($, window, undefined) {
  'use strict';
  
  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  var XHR = window.XMLHttpRequest;

  var SendQueue = filehub.createClass('SendQueue', {
    options: {
      api: null, // default to 'new filehub.Api()'
      container: '#send-queue'
    },
    _init: function () {
      var self = this,
          options = self.options,
          tl,
          container, hdr, tools;

      self._queue = [];
      self.container = container = $(options.container);
      tl = container.data('tl');
      if (typeof tl === 'string') {
        tl = JSON.parse(tl || '{}') || {}
      }
      self.tl = tl;
      hdr = container.children('.sq-header');
      tools = hdr.children('.sq-tools');
      self.toggle = tools.children('.sq-toggle');
      self.close = tools.children('.sq-close').hide();
      self.title = hdr.find('.title'),
      self.body = container.children('.sq-body'),
      self.wrap = self.body.children('.sq-wrap'),
      self.template = self.wrap.children('.sq-row:eq(0)').remove().hide();
      self.api = options.api || new filehub.Api();

      self.toggle.on('click', function () {
        self._bodySlide();
      });
      self.close.on('click', function () {
        if (self._queue.length) return;
        self.container.slideUp('fast');
        self.close.hide();
      });
      self.title.on('dblclick', function () {
        self._bodySlide();
      });
      function _remCheck() {
        $(this).remove();
        if (!self.wrap.children().length) {
          self.close.click();
        }
      }
      self.body.on('click', '.sq-abort', function () {
        var el = $(this).closest('.sq-row'),
            data = el.data('fh-sq');

        switch (data.status) {
          case 'pending':
            data.status = 'skip';
            el.fadeOut('fast', _remCheck);
            break;
          case 'sending':
            data.xhr.abort();
            break;
          default:
            el.fadeOut('fast', _remCheck);
        }
      });

      self.on('complete', function () {
        self.close.show();
      });
    },
    startNext: function () {
      var self = this,
          next, xhr;

      // ongoing file upload.
      if (self._sending && self._sending.status === 'sending') return;

      do {
        next = self._sending = self._queue.shift();
      } while (next && next.status !== 'pending');

      if (!next) {
        self.title.text(self.tl.title.complete);
        self.trigger('complete');
        return;
      }

      next.status = 'sending';

      var uptl = self.tl.title.uploading;
      next.update = function (p) {
        var l = self._queue.length,
            up = uptl.replace('{percent}', ''+(p!=null?p:'??')).replace('{pending}', l);
        
        self.title.text(up);

        if (p == null) {
          var w = 10.0, //%
              steps = 90,
              frames = 30,

              step = steps/2,
              inc = 2 * (100.0 - w) / steps,
              speed = Math.floor(1000.0/frames);

          next.pg.css({
            width: '10%',
            left: 0
          });
          next.pgl.text('...');
          next.pginterval = (function () {
            var tm = setInterval(function () {
              var s;
              step = (step + 1) % (steps + 1);
              s = Math.abs((steps / 2) - step);
              next.pg.css({ left: ''+(s * inc)+'%' });
            }, speed);

            return function () {
              if (tm) clearInterval(tm);
              tm = 0;
            };
          })();
        } else {
          next.pg.css('width', ''+p+'%');
          next.pgl.text(''+Math.floor(p)+'%');
        }
      };

      xhr = next.xhr = new XHR();

      (function (map) {
        for (var t in map) {
          xhr.addEventListener(t, map[t]);
        }
      })({
        progress: function (evt) {
          if (!evt.total || next.pginterval) {
            // unknown file size. show progress placeholder.
            if (!next.pginterval) next.update();
            return;
          }

          next.loaded = evt.loaded;
          next.total = evt.total;
          next.update(100 * (evt.loaded / evt.total));
        },
        load: function (evt) {
          if (next.pginterval) next.pginterval();

          next.pgl.text(self.tl.progress.done || 'done');
          next.pg.css({
            width: '100%',
            left: 0,
          });

          next.loaded = next.total;

          if (xhr.status !== 200) {
            next.status = 'error';
            next.row.addClass('error');
            next.pg.hide();
            next.pgl.text(self.tl.progress.aborted || 'error');
            self.trigger('error', [ next, xhr ]);
          } else {
            next.status = 'done';
            self.trigger('uploaded', [ next, xhr ]);
          }

          self.startNext();
        },
        abort: function (evt) {
          if (next.pginterval) next.pginterval();

          next.status = 'aborted';
          next.row.addClass('abort');
          next.pg.hide();
          next.pgl.text(self.tl.progress.aborted || 'aborted');

          self.trigger('abort', [ next ]);

          self.startNext();
        },
        error: function (evt) {
          if (next.pginterval) next.pginterval();

          if (next.status !== 'aborted') {
            next.status = 'error';
            next.row.addClass('error');
            next.pg.hide();
            next.pgl.text(self.tl.progress.aborted || 'error');
            self.trigger('error', [ next, xhr ]);
          }

          self.startNext();
        },
      });

      next.update(0);

      var url = self.api.sendFileUrl(next.options.path, next.file, next.options.replace);
      xhr.open('PUT', url, true);
      /* xhr.setRequestHeader('Content-Type', 'application/octet-stream'); */
      xhr.send(next.file);
    },
    queue: function (files, options) {
      var self = this;

      for (var i = 0; i < files.length; i++) {
        self._queueOne(files[i], options, true);
      }
      self.reveal();
      self.startNext();
    },
    _queueOne: function (file, options, skipStart) {
      var self = this,
          row = self.template.clone(),
          obj = {
            file: file,
            status: 'pending',
            options: options,
            row: row,
            pg: row.find('.sq-progress-in'),
            pgl: row.find('.sq-progress-label')
          };


      row.children('.sq-label').text(file.name);
      row.appendTo(self.wrap).data('fh-sq', obj).slideDown();

      self._queue.push(obj);

      if (!skipStart) {
        self.reveal();
        self.startNext();
      }
    },
    _bodySlide: function (slide) {
      var self = this,
          body = self.body;

      function toggle() {
        self.toggle.children('.fa').each(function () {
          var el = $(this);

          el.toggle(body.is(el.data('target-is')));
        });
      }

      if (slide == null) {
        slide = body.is(':visible') ? 'up' : 'down';
      }

      switch (slide) {
        case 'up':
          body.slideUp(toggle);
          break;
        case 'down':
          body.slideDown(toggle);
          break;
        default:
          break;
      }
    },
    reveal: function () {
      var self = this;

      self.container.fadeIn(function () {
        self._bodySlide('down');
      });
    }
  });
}(jQuery, window));
