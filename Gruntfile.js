'use strict';

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  // Project Configuration
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    'string-replace': {
      dist: {
        files: {
          'cordova/config.xml': ['config-templates/config.xml'],
          'cordova/wp/Package.appxmanifest': ['config-templates/Package.appxmanifest'],
          'cordova/wp/Properties/WMAppManifest.xml': ['config-templates/WMAppManifest.xml'],
          'webkitbuilds/.desktop': ['config-templates/.desktop'],
          'webkitbuilds/setup-win.iss': ['config-templates/setup-win.iss']
        },
        options: {
          replacements: [{
            pattern: /%APP-VERSION%/g,
            replacement: '<%= pkg.version %>'
            }, {
            pattern: /%ANDROID-VERSION-CODE%/g,
            replacement: '<%= pkg.androidVersionCode %>'
          }]
        }
      }
    },
    exec: {
      version: {
        command: 'node ./util/version.js'
      },
      coinbase: {
        command: 'node ./util/coinbase.js'
      },
      clear: {
        command: 'rm -Rf bower_components node_modules'
      },
      osx: {
        command: 'webkitbuilds/build-osx.sh sign'
      },
      coveralls: {
        command: 'cat  coverage/report-lcov/lcov.info |./node_modules/coveralls/bin/coveralls.js'
      }
    },
    watch: {
      options: {
        dateFormat: function(time) {
          grunt.log.writeln('The watch finished in ' + time + 'ms at ' + (new Date()).toString());
          grunt.log.writeln('Waiting for more changes...');
        },
      },
      sass: {
        files: [ 'src/sass/**' ],
        tasks: ['sass']
      },
      main: {
        files: [
          'src/js/init.js',
          'src/js/app.js',
          'src/js/directives/*.js',
          'src/js/filters/*.js',
          'src/js/routes.js',
          'src/js/services/*.js',
          'src/js/models/*.js',
          'src/js/controllers/**/*.js'
        ],
        tasks: ['concat:js']
      },
      livereload: {
        files: ['src/**/**'],
        options: {
          livereload: true
        }
      }
    },
    sass: {
      dist: {
        options: {
          style: 'compact',
          sourcemap: 'none'
        },
        files: [{
          expand: true,
          flatten: true,
          src: [ 'src/sass/copay.sass' ],
          dest: './public/css',
          ext: '.css'
        }]
      }
    },
    concat: {
      options: {
        sourceMap: false,
        sourceMapStyle: 'link' // embed, link, inline
      },
      angular: {
        src: [
          'bower_components/qrcode-generator/js/qrcode.js',
          'bower_components/qrcode-decoder-js/lib/qrcode-decoder.js',
          'bower_components/moment/min/moment-with-locales.js',
          'bower_components/angular-ui-router/release/angular-ui-router.js',
          'bower_components/angular-moment/angular-moment.js',
          'bower_components/ng-lodash/build/ng-lodash.js',
          'bower_components/angular-qrcode/angular-qrcode.js',
          'bower_components/angular-gettext/dist/angular-gettext.js',
          'bower_components/angular-sanitize/angular-sanitize.js',
          'bower_components/ng-csv/build/ng-csv.js',
          'bower_components/angular-mocks/angular-mocks.js',
          'angular-bitcore-wallet-client/angular-bitcore-wallet-client.js',
          'angular-bitcore-counterparty-wallet-client/angular-bitcore-counterparty-wallet-client.js'
        ],
        dest: 'public/lib/angular.js'
      },
      js: {
        src: [
          'src/js/app.js',
          'src/js/routes.js',
          'src/js/directives/*.js',
          'src/js/filters/*.js',
          'src/js/models/*.js',
          'src/js/services/*.js',
          'src/js/controllers/**/*.js',
          'src/js/translations.js',
          'src/js/version.js',
          'src/js/coinbase.js',
          'src/js/init.js',
          'src/js/trezor-url.js',
          'bower_components/trezor-connect/login.js'
        ],
        dest: 'public/js/copay.js'
      },
      foundation: {
        src: [
          'bower_components/angular/angular-csp.css',
          'bower_components/foundation/css/foundation.css',
          'bower_components/animate.css/animate.css'
        ],
        dest: 'public/css/foundation.css',
      },
      ionic_js: {
        src: [
          'bower_components/ionic/release/js/ionic.bundle.min.js'
        ],
        dest: 'public/lib/ionic.bundle.js'
      },
      ionic_css: {
        src: [
          'bower_components/ionic/release/css/ionic.min.css'
        ],
        dest: 'public/css/ionic.css',
      },
      ui_components_js: {
        src: [
          'bower_components/jquery/dist/jquery.js',
          'bower_components/roundSlider/dist/roundslider.min.js',
          'bower_components/angular-gridster/dist/angular-gridster.min.js',
          'bower_components/javascript-detect-element-resize/detect-element-resize.js',
          'bower_components/ion-datetime-picker/release/ion-datetime-picker.min.js'
        ],
        dest: 'public/lib/ui-components.js'
      },
      ui_components_css: {
        src: [
          'bower_components/roundSlider/dist/roundslider.min.css',
          'bower_components/angular-gridster/dist/angular-gridster.min.css',
          'bower_components/ion-datetime-picker/release/ion-datetime-picker.min.css',
          'src/extra-css/ion-datetime-picker-fixes.css'
        ],
        dest: 'public/css/ui-components.css',
      },
    },
    uglify: {
      options: {
        mangle: false
      },
      prod: {
        files: {
          'public/js/copay.js': ['public/js/copay.js'],
          'public/lib/angular.js': ['public/lib/angular.js']
        }
      }
    },
    nggettext_extract: {
      pot: {
        files: {
          'i18n/po/template.pot': [
            'public/index.html',
            'public/views/**/*.html',
            'src/js/routes.js',
            'src/js/services/*.js',
            'src/js/controllers/**/*.js'
          ]
        }
      },
    },
    nggettext_compile: {
      all: {
        options: {
          module: 'copayApp'
        },
        files: {
          'src/js/translations.js': ['i18n/po/*.po']
        }
      },
    },
    copy: {
      icons: {
        expand: true,
        flatten: true,
        src: 'bower_components/foundation-icon-fonts/foundation-icons.*',
        dest: 'public/icons/'
      },
      ionic_fonts: {
        expand: true,
        flatten: true,
        src: 'bower_components/ionic/release/fonts/ionicons.*',
        dest: 'public/fonts/'
      },
      linux: {
        files: [{
          expand: true,
          cwd: 'webkitbuilds/',
          src: ['.desktop', '../public/favicons/favicon.ico', '../public/favicons/favicon-32x32.png', '../extra/linux/Install.sh', '../extra/linux/README.md'],
          dest: 'webkitbuilds/Pockets/linux64/',
          flatten: true,
          filter: 'isFile'
        }],
      }   
    },
    karma: {
      unit: {
        configFile: 'test/karma.conf.js'
      },
      prod: {
        configFile: 'test/karma.conf.js',
        singleRun: true
      }
    },
    nwjs: {
      options: {
        appName: 'Pockets',
        platforms: ['win64', 'osx64', 'linux64'],
        buildDir: './webkitbuilds',
        version: '0.17.0',
        macIcns: './public/img/icons/icon.icns',
        exeIco: './public/img/icons/icon.ico',
        macPlist: './extra/osx/Info.plist'
      },
      src: ['./package.json', './public/**/*']
    },
    compress: {
      linux: {
        options: {
          archive: './webkitbuilds/Pockets-linux.zip'
        },
        expand: true,
        cwd: './webkitbuilds/Pockets/linux64/',
        src: ['**/*'],
        dest: 'pockets-linux/'
      }
    },
    browserify: {
      dist: {
        files: {
          'angular-bitcore-wallet-client/angular-bitcore-wallet-client.js': ['angular-bitcore-wallet-client/index.js'],
          'angular-bitcore-counterparty-wallet-client/angular-bitcore-counterparty-wallet-client.js': ['angular-bitcore-counterparty-wallet-client/index.js']
        },
      }
    }
  });

  grunt.registerTask('default', ['nggettext_compile', 'exec:version', 'exec:coinbase', 'browserify', 'sass', 'concat', 'copy:icons', 'copy:ionic_fonts']);
  grunt.registerTask('prod', ['default', 'uglify']);
  grunt.registerTask('translate', ['nggettext_extract']);
  grunt.registerTask('test', ['karma:unit']);
  grunt.registerTask('test-coveralls', ['browserify', 'karma:prod', 'exec:coveralls']);
  grunt.registerTask('desktop', ['prod', 'nwjs', 'copy:linux', 'compress:linux']);
  grunt.registerTask('osx', ['prod', 'nwjs', 'exec:osx']);
  grunt.registerTask('release', ['string-replace:dist']);

  grunt.loadNpmTasks('grunt-contrib-watch');

};
