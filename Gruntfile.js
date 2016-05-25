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
          'static/css/filehub.css': 'scss/filehub.scss',
          'static/css/filehub-admin.css': 'scss/filehub-admin.scss'
        }
      }
    },
    uglify: {
      options: { sourceMap: true },
      filehub: {
        files: {
          'static/js/filehub.min.js': 'static/js/filehub.js',
          'static/js/filehub-admin.min.js': 'static/js/filehub-admin.js'
        }
      }
    },
    watch: {
      distjs: {
        files: [
          'static/js/filehub.js',
          'static/js/filehub-admin.js'
        ],
        tasks: [ 'uglify' ],
        options: {
          events: [ 'added', 'changed' ]
        }
      },
      distcss: {
        files: [ 'scss/*.scss' ],
        tasks: [ 'sass' ],
        options: {
          events: [ 'added', 'changed' ]
        }
      }
    },
  });

  grunt.registerTask('test', [ 'mochaTest' ]);

  grunt.registerTask('dist', [ 'uglify', 'sass' ]);

  grunt.registerTask('default', [ 'uglify', 'sass', 'test' ]);
};
