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
      options: { sourceMap: false },
      dist: {
        files: {
          'static/css/filehub.css': 'scss/filehub.scss',
          'static/css/filehub-admin.css': 'scss/filehub-admin.scss'
        }
      }
    },
    uglify: {
      options: {
        sourceMap: false,
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
          'static/js/filehub.min.js': [
            'static/js/_defines.js',
            'static/js/filehub.js',
            'static/js/filehub/*.js' ],
          'static/js/filehub-admin.min.js': 'static/js/filehub-admin/*.js'
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
};
