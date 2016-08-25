'use strict';

angular.module('copayApp.controllers').controller('preferencesBvam',
  function($scope, $log, $timeout, go, storageService, lodash) {

    $scope.clearBvamCache = function() {
      storageService.removeBvamCache(function(err) {
        if (err) {
          $log.error(err);
          return;
        }

        $scope.$emit('Local/ClearBvam');

        $timeout(function() {
          go.walletHome();
        }, 100);
      });
    };
  });
