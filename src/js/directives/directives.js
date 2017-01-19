'use strict';

function selectText(element) {
  var doc = document;
  if (doc.body.createTextRange) { // ms
    var range = doc.body.createTextRange();
    range.moveToElementText(element);
    range.select();
  } else if (window.getSelection) {
    var selection = window.getSelection();
    var range = doc.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

  }
}

function isValidAsset(value, issuanceOnly) {
  issuanceOnly = !!(issuanceOnly != null);
  if (!issuanceOnly && value == 'XCP') { return true; }
  if (!issuanceOnly && value == 'BTC') { return true; }

  if (value.substr(0,1) == 'A') {
    // check numeric asset name
    var numString = ""+value.substr(1);
    if (!/^[0-9]+$/.test(numString)) { return false; }

    var numStringPadded = "00000000000000000000".substring(0, 20 - numString.length) + numString;

    if (numStringPadded < "00095428956661682201") { return false; }
    if (numStringPadded > "18446744073709551615") { return false; }

    return true;
  }

  if (!/^[A-Z]+$/.test(value)) { return false; }
  if (value.length < 4) { return false; }
  if (value.length > 12) { return false; }
  return true;
}

angular.module('copayApp.directives')
  .directive('validAddress', ['$rootScope', 'bitcore', 'profileService',
    function($rootScope, bitcore, profileService) {
      return {
        require: 'ngModel',
        link: function(scope, elem, attrs, ctrl) {
          var URI = bitcore.URI;
          var Address = bitcore.Address
          var validator = function(value) {
            if (!profileService.focusedClient)
              return;
            var networkName = profileService.focusedClient.credentials.network;
            // Regular url
            if (/^https?:\/\//.test(value)) {
              ctrl.$setValidity('validAddress', true);
              return value;
            }

            // Bip21 uri
            if (/^bitcoin:/.test(value)) {
              var uri, isAddressValid;
              var isUriValid = URI.isValid(value);
              if (isUriValid) {
                uri = new URI(value);
                isAddressValid = Address.isValid(uri.address.toString(), networkName)
              }
              ctrl.$setValidity('validAddress', isUriValid && isAddressValid);
              return value;
            }

            if (typeof value == 'undefined') {
              ctrl.$pristine = true;
              return;
            }

            // Regular Address
            ctrl.$setValidity('validAddress', Address.isValid(value, networkName));
            return value;
          };


          ctrl.$parsers.unshift(validator);
          ctrl.$formatters.unshift(validator);
        }
      };
    }
  ])
  .directive('validUrl', [

    function() {
      return {
        require: 'ngModel',
        link: function(scope, elem, attrs, ctrl) {
          var validator = function(value) {
            // Regular url
            if (/^https?:\/\//.test(value)) {
              ctrl.$setValidity('validUrl', true);
              return value;
            } else {
              if (value == null || value.length == 0) {
                ctrl.$setValidity('validUrl', true);
              } else {
                ctrl.$setValidity('validUrl', false);
              }
              return value;
            }
          };

          ctrl.$parsers.unshift(validator);
          ctrl.$formatters.unshift(validator);
        }
      };
    }
  ])
  .directive('validAmount', ['configService',
    function(configService) {

      return {
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
          var val = function(value) {
            var settings = configService.getSync().wallet.settings;
            var vNum = Number((value * settings.unitToSatoshi).toFixed(0));
            if (typeof value == 'undefined' || value == 0) {
              ctrl.$pristine = true;
            }



            if (typeof vNum == "number" && vNum > 0) {
              if (vNum > Number.MAX_SAFE_INTEGER) {
                ctrl.$setValidity('validAmount', false);
              } else {
                var decimals = Number(settings.unitDecimals);
                var sep_index = ('' + value).indexOf('.');
                var str_value = ('' + value).substring(sep_index + 1);
                if (sep_index >= 0 && str_value.length > decimals) {
                  ctrl.$setValidity('validAmount', false);
                  return;
                } else {
                  ctrl.$setValidity('validAmount', true);
                }
              }
            } else {
              ctrl.$setValidity('validAmount', false);
            }
            return value;
          }
          ctrl.$parsers.unshift(val);
          ctrl.$formatters.unshift(val);
        }
      };
    }
  ])
  .directive('walletSecret', function(bitcore) {
    return {
      require: 'ngModel',
      link: function(scope, elem, attrs, ctrl) {
        var validator = function(value) {
          if (value.length > 0) {
            var m = value.match(/^[0-9A-HJ-NP-Za-km-z]{70,80}$/);
            ctrl.$setValidity('walletSecret', m ? true : false);
          }
          return value;
        };

        ctrl.$parsers.unshift(validator);
      }
    };
  })
  .directive('loading', function() {
    return {
      restrict: 'A',
      link: function($scope, element, attr) {
        var a = element.html();
        var text = attr.loading;
        element.on('click', function() {
          element.html('<i class="size-21 fi-bitcoin-circle icon-rotate spinner"></i> ' + text + '...');
        });
        $scope.$watch('loading', function(val) {
          if (!val) {
            element.html(a);
          }
        });
      }
    }
  })
  .directive('ngFileSelect', function() {
    return {
      link: function($scope, el) {
        el.bind('change', function(e) {
          $scope.file = (e.srcElement || e.target).files[0];
          $scope.getFile();
        });
      }
    }
  })
  .directive('contact', ['addressbookService',
    function(addressbookService) {
      return {
        restrict: 'E',
        link: function(scope, element, attrs) {
          var addr = attrs.address;
          addressbookService.getLabel(addr, function(label) {
            if (label) {
              element.append(label);
            } else {
              element.append(addr);
            }
          });
        }
      };
    }
  ])
  .directive('highlightOnChange', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        scope.$watch(attrs.highlightOnChange, function(newValue, oldValue) {
          element.addClass('highlight');
          setTimeout(function() {
            element.removeClass('highlight');
          }, 500);
        });
      }
    }
  })
  .directive('checkStrength', function() {
    return {
      replace: false,
      restrict: 'EACM',
      require: 'ngModel',
      link: function(scope, element, attrs) {

        var MIN_LENGTH = 8;
        var MESSAGES = ['Very Weak', 'Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
        var COLOR = ['#dd514c', '#dd514c', '#faa732', '#faa732', '#16A085', '#16A085'];

        function evaluateMeter(password) {
          var passwordStrength = 0;
          var text;
          if (password.length > 0) passwordStrength = 1;
          if (password.length >= MIN_LENGTH) {
            if ((password.match(/[a-z]/)) && (password.match(/[A-Z]/))) {
              passwordStrength++;
            } else {
              text = ', add mixed case';
            }
            if (password.match(/\d+/)) {
              passwordStrength++;
            } else {
              if (!text) text = ', add numerals';
            }
            if (password.match(/.[!,@,#,$,%,^,&,*,?,_,~,-,(,)]/)) {
              passwordStrength++;
            } else {
              if (!text) text = ', add punctuation';
            }
            if (password.length > 12) {
              passwordStrength++;
            } else {
              if (!text) text = ', add characters';
            }
          } else {
            text = ', that\'s short';
          }
          if (!text) text = '';

          return {
            strength: passwordStrength,
            message: MESSAGES[passwordStrength] + text,
            color: COLOR[passwordStrength]
          }
        }

        scope.$watch(attrs.ngModel, function(newValue, oldValue) {
          if (newValue && newValue !== '') {
            var info = evaluateMeter(newValue);
            scope[attrs.checkStrength] = info;
          }
        });
      }
    };
  })
  .directive('showFocus', function($timeout) {
    return function(scope, element, attrs) {
      scope.$watch(attrs.showFocus,
        function(newValue) {
          $timeout(function() {
            newValue && element[0].focus();
          });
        }, true);
    };
  })
  .directive('match', function() {
    return {
      require: 'ngModel',
      restrict: 'A',
      scope: {
        match: '='
      },
      link: function(scope, elem, attrs, ctrl) {
        scope.$watch(function() {
          return (ctrl.$pristine && angular.isUndefined(ctrl.$modelValue)) || scope.match === ctrl.$modelValue;
        }, function(currentValue) {
          ctrl.$setValidity('match', currentValue);
        });
      }
    };
  })
  .directive('clipCopy', function() {
    return {
      restrict: 'A',
      scope: {
        clipCopy: '=clipCopy'
      },
      link: function(scope, elm) {
        // TODO this does not work (FIXME)
        elm.attr('tooltip', 'Press Ctrl+C to Copy');
        elm.attr('tooltip-placement', 'top');

        elm.bind('click', function() {
          selectText(elm[0]);
        });
      }
    };
  })
  .directive('menuToggle', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'views/includes/menu-toggle.html'
    }
  })
  .directive('logo', function() {
    return {
      restrict: 'E',
      scope: {
        width: "@",
        negative: "="
      },
      controller: function($scope) {
        // $scope.logo_url = $scope.negative ? 'img/tokenly-logo-negative.svg' : 'img/tokenly-logo-dark.svg';
        $scope.logo_url = 'img/tokenly-icon_grey.svg';
      },
      replace: true,
      template: '<img class="logo" ng-src="{{ logo_url }}" alt="Copay">'
    }
  })
  .directive('availableBalance', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'views/includes/available-balance.html'
    }
  })
  .directive('ignoreMouseWheel', function($rootScope, $timeout) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        element.bind('mousewheel', function(event) {
          element[0].blur();
          $timeout(function() {
            element[0].focus();
          }, 1);
        });
      }
    }
  })
  .directive('validAsset', function(bitcore) {
    return {
      require: 'ngModel',
      link: function(scope, elem, attrs, ctrl) {
        var validator = function(value) {
          if (value.length > 0) {
            var isValid = isValidAsset(value, false);
            ctrl.$setValidity('validIssuanceAsset', isValid ? true : false);
          }
          return value;
        };

        ctrl.$parsers.unshift(validator);
      }
    };
  })
  .directive('validIssuanceAsset', function(bitcore) {
    return {
      require: 'ngModel',
      link: function(scope, elem, attrs, ctrl) {
        var validator = function(value) {
          if (value.length > 0) {
            var isValid = isValidAsset(value, true);
            ctrl.$setValidity('validIssuanceAsset', isValid ? true : false);
          }
          return value;
        };

        ctrl.$parsers.unshift(validator);
      }
    };
  })
  .directive('baseSixtyFourInput', [
    '$window',
    '$q',
    function($window, $q) {
      console.log('baseSixtyFourInput init');

      var isolateScope = {
        onChange: '&',
        onAfterValidate: '&',
        parser: '&'
      };

      var FILE_READER_EVENTS = ['onabort', 'onerror', 'onloadstart', 'onloadend', 'onprogress', 'onload'];
      for (var i = FILE_READER_EVENTS.length - 1; i >= 0; i--) {
        var e = FILE_READER_EVENTS[i];
        isolateScope[e] = '&';
      }

      return {
        restrict: 'A',
        require: 'ngModel',
        scope: isolateScope,
        link: function(scope, elem, attrs, ngModel) {

          /* istanbul ignore if */
          if (!ngModel) {
            return;
          }

          var rawFiles = [];
          var fileObjects = [];

          elem.on('change', function(e) {

            if (!e.target.files.length) {
              return;
            }

            fileObjects = [];
            fileObjects = angular.copy(fileObjects);
            rawFiles = e.target.files; // use event target so we can mock the files from test
            _readFiles();
            _onChange(e);
            _onAfterValidate(e);
          });

          function _readFiles() {
            var promises = [];
            var i;
            for (i = rawFiles.length - 1; i >= 0; i--) {
              // append file a new promise, that waits until resolved
              rawFiles[i].deferredObj = $q.defer();
              promises.push(rawFiles[i].deferredObj.promise);
              // TODO: Make sure all promises are resolved even during file reader error, otherwise view value wont be updated
            }

            // set view value once all files are read
            $q.all(promises).then(_setViewValue);

            for (i = rawFiles.length - 1; i >= 0; i--) {
              var reader = new $window.FileReader();
              var file = rawFiles[i];
              var fileObject = {};

              fileObject.filetype = file.type;
              fileObject.filename = file.name;
              fileObject.filesize = file.size;
              
              _attachEventHandlers(reader, file, fileObject);
              reader.readAsArrayBuffer(file);
            }
          }

          function _onChange(e) {
            if (attrs.onChange) {
                if (scope.onChange && typeof scope.onChange() === "function") {
                    scope.onChange()(e, rawFiles);
                }
                else {
                    scope.onChange(e, rawFiles);
              }
            }
          }

          function _onAfterValidate(e) {
            if (attrs.onAfterValidate) {
                // wait for all promises, in rawFiles,
                //   then call onAfterValidate
                var promises = [];
                for (var i = rawFiles.length - 1; i >= 0; i--) {
                    promises.push(rawFiles[i].deferredObj.promise);
                }
                $q.all(promises).then(function () {
                  if (scope.onAfterValidate && typeof scope.onAfterValidate() === "function"){
                      scope.onAfterValidate()(e, fileObjects, rawFiles);
                  }
                  else{
                      scope.onAfterValidate(e, fileObjects, rawFiles);
                  }
                });
            }
          }

          function _attachEventHandlers(fReader, file, fileObject) {

            for (var i = FILE_READER_EVENTS.length - 1; i >= 0; i--) {
              var e = FILE_READER_EVENTS[i];
              if (attrs[e] && e !== 'onload') { // don't attach handler to onload yet
                _attachHandlerForEvent(e, scope[e], fReader, file, fileObject);
              }
            }

            fReader.onload = _readerOnLoad(fReader, file, fileObject);
          }

          function _attachHandlerForEvent(eventName, handler, fReader, file, fileObject) {
            fReader[eventName] = function(e) {
              handler()(e, fReader, file, rawFiles, fileObjects, fileObject);
            };
          }

          function _readerOnLoad(fReader, file, fileObject) {

            return function(e) {

              var buffer = e.target.result;
              var promise;

              // do not convert the image to base64 if it exceeds the maximum
              // size to prevent the browser from freezing
              var exceedsMaxSize = attrs.maxsize && file.size > attrs.maxsize * 1024;
              if (attrs.doNotParseIfOversize !== undefined && exceedsMaxSize) {
                fileObject.base64 = null;
              } else {
                fileObject.base64 = _arrayBufferToBase64(buffer);
              }

              if (attrs.parser) {
                promise = $q.when(scope.parser()(file, fileObject));
              } else {
                promise = $q.when(fileObject);
              }

              promise.then(function(fileObj) {
                fileObjects.push(fileObj);
                // fulfill the promise here.
                file.deferredObj.resolve();
              });

              if (attrs.onload) {
                if (scope.onload && typeof scope.onload() === "function"){
                    scope.onload()(e, fReader, file, rawFiles, fileObjects, fileObject);
                }
                else{
                    scope.onload(e, rawFiles);
                }
              }

            };

          }

          function _setViewValue() {
            var newVal = attrs.multiple ? fileObjects : fileObjects[0];
            ngModel.$setViewValue(newVal);
            _maxsize(newVal);
            _minsize(newVal);
            _maxnum(newVal);
            _minnum(newVal);
            _accept(newVal);
          }

          ngModel.$isEmpty = function(val) {
            return !val || (angular.isArray(val) ? val.length === 0 : !val.base64);
          };

          // http://stackoverflow.com/questions/1703228/how-can-i-clear-an-html-file-input-with-javascript
          scope._clearInput = function() {
            elem[0].value = '';
          };

          scope.$watch(function() {
            return ngModel.$viewValue;
          }, function(val) {
            if (ngModel.$isEmpty(val)) {
              scope._clearInput();
            }
          });

          // VALIDATIONS =========================================================

          function _maxnum(val) {
            if (attrs.maxnum && attrs.multiple && val) {
              var valid = val.length <= parseInt(attrs.maxnum);
              ngModel.$setValidity('maxnum', valid);
            }
            return val;
          }

          function _minnum(val) {
            if (attrs.minnum && attrs.multiple && val) {
              var valid = val.length >= parseInt(attrs.minnum);
              ngModel.$setValidity('minnum', valid);
            }
            return val;
          }

          function _maxsize(val) {
            var valid = true;

            if (attrs.maxsize && val) {
              var max = parseFloat(attrs.maxsize) * 1000;

              if (attrs.multiple) {
                for (var i = 0; i < val.length; i++) {
                  var file = val[i];
                  if (file.filesize > max) {
                    valid = false;
                    break;
                  }
                }
              } else {
                valid = val.filesize <= max;
              }
              ngModel.$setValidity('maxsize', valid);
            }

            return val;
          }

          function _minsize(val) {
            var valid = true;
            var min = parseFloat(attrs.minsize) * 1000;

            if (attrs.minsize && val) {
              if (attrs.multiple) {
                for (var i = 0; i < val.length; i++) {
                  var file = val[i];
                  if (file.filesize < min) {
                    valid = false;
                    break;
                  }
                }
              } else {
                valid = val.filesize >= min;
              }
              ngModel.$setValidity('minsize', valid);
            }

            return val;
          }

          function _accept(val) {
            var valid = true;
            var regExp, exp, fileExt;
            if (attrs.accept) {
              exp = attrs.accept.trim().replace(/[,\s]+/gi, "|").replace(/\./g, "\\.").replace(/\/\*/g, "/.*");
              regExp = new RegExp(exp);
            }

            if (attrs.accept && val) {
              if (attrs.multiple) {
                for (var i = 0; i < val.length; i++) {
                  var file = val[i];
                  fileExt = "." + file.filename.split('.').pop();
                  valid = regExp.test(file.filetype) || regExp.test(fileExt);

                  if (!valid) {
                    break; }
                }
              } else {
                fileExt = "." + val.filename.split('.').pop();
                valid = regExp.test(val.filetype) || regExp.test(fileExt);
              }
              ngModel.$setValidity('accept', valid);
            }

            return val;
          }

        }
      };

    }
  ]);

  /* istanbul ignore next */
  var _arrayBufferToBase64 = function(buffer) { //http://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };
