'use strict';

angular.module('copayApp.controllers').controller('preferencesColorController', function($scope, $log, configService, profileService, go) {

  $scope.colorList = [
        '#DD4B39',
        '#F48E5A',
        '#FAA77F',
        '#F4D15A',
        '#9EDD72',
        '#29BB9C',
        '#019477',
        '#77DADA',
        '#4A90E2',
        '#484ED3',
        '#9B59B6',
        '#E856EF',
        '#E05273',
        '#7A8C9E',
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
