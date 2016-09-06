'use strict';

module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    mochaTest: {
      api: ['test/api.js']
    },
    sass: {
      options: { sourceMap: true },
      dist: {
        files: {
          'dist/css/filehub.css': 'scss/filehub.scss',
          'dist/css/filehub-admin.css': 'scss/filehub-admin.scss'
        }
      }
    },
    uglify: {
      options: {
        sourceMap: true,
        compress: {
          dead_code: true
        },
        banner: [
          "/* filehub",
          " * Copyright (c) 2016 Raphaël Bois Rousseau",
          " * MIT Licensed",
          " */" ].join("\n")
      },
      filehub: {
        files: {
          'dist/js/filehub.min.js': [
            'static/js/_defines.js',
            'static/js/filehub.js',
            'static/js/filehub/*.js' ],
          'dist/js/filehub-admin.min.js': 'static/js/filehub-admin/*.js'
        }
      }
    },
    watch: {
      options: {
        atBegin: true,
        debounceDelay: 1000
      },
      distjs: {
        files: [
          'static/js/filehub.js',
          'static/js/filehub/*.js',
          'static/js/filehub-admin/*.js'
        ],
        tasks: [ 'uglify' ],
        options: {
          events: [ 'changed' ]
        }
      },
      distcss: {
        files: [ 'scss/*.scss' ],
        tasks: [ 'sass' ],
        options: {
          events: [ 'changed' ]
        }
      }
    },
  });

  grunt.registerTask('test', [ 'mochaTest' ]);

  grunt.registerTask('dist', [ 'uglify', 'sass' ]);

  grunt.registerTask('default', [ 'uglify', 'sass', 'test' ]);

  grunt.registerTask('devinit', 'Bootstrap development environment', function (clean) {
    var done = this.async();

    var setupEnv = require('./scripts/dev-env');

    setupEnv(clean === 'clean', (err) => {
      if (err) {
        console.error('%s', err);
        return done(false);
      }
      console.error("Development environment ready.");
      done();
    });
  });

  grunt.registerTask('serve', 'Run Filehub server', function (env) {
    var done = this.async();
    process.env.NODE_ENV = env || 'production';
    grunt.task.requires('dist');
    require('./lib').run(true, done);
  });

  grunt.registerTask('run', [ 'dist', 'serve' ]);
  grunt.registerTask('dev', [ 'dist', 'devinit', 'serve:development' ]);
};
