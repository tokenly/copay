'use strict';

angular.module('copayApp.controllers').controller('preferencesColorController', function($scope, $log, configService, profileService, go) {

  $scope.colorList = [
        '#C24100',
        '#18602B',
        '#6F4284',
        '#DF7C00',
        '#5DB54A',
        '#13C4D1',
        '#754C24',
        '#9DB6CE',
        '#FF80B4',
        '#EDC600',
        '#4170A0',
        '#4B4A4B',
      ];

  var fc = profileService.focusedClient;
  var walletId = fc.credentials.walletId;
  var config = configService.getSync();
  config.colorFor = config.colorFor || {};

  $scope.currentColor = config.colorFor[walletId] || '#4A90E2';

  $scope.save = function(color) {
    var opts = {
      colorFor: {}
    };
    opts.colorFor[walletId] = color;

    configService.set(opts, function(err) {
      go.preferences();
      if (err) $log.warn(err);
      $scope.$emit('Local/ColorUpdated');
    });
  };
});
