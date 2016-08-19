'use strict';

angular.module('copayApp.controllers').controller('preferencesCPwsUrlController',
  function($scope, $log, configService, applicationService, profileService, storageService) {
    $scope.error = null;
    $scope.success = null;

    var fc = profileService.focusedClient;
    var walletId = fc.credentials.walletId;
    var defaults = configService.getDefaults();
    var config = configService.getSync();

    $scope.bcpwsurl = (config.bcpwsFor && config.bcpwsFor[walletId]) || defaults.counterpartyTokens.counterpartyService.url;

    $scope.resetDefaultUrl = function() {
      $scope.bcpwsurl = defaults.counterpartyTokens.counterpartyService.url;
    };

    $scope.save = function() {
      var opts = {
        bcpwsFor: {}
      };
      opts.bcpwsFor[walletId] = $scope.bcpwsurl;

      configService.set(opts, function(err) {
        if (err) $log.debug(err);
        storageService.setCleanAndScanAddresses(walletId, function() {
          applicationService.restart();
        });
      });
    };
  });
