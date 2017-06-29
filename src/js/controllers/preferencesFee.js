'use strict';

angular.module('copayApp.controllers').controller('preferencesFeeController', function($scope, $timeout, $ionicHistory, lodash, gettextCatalog, configService, feeService, ongoingProcess, popupService) {

  $scope.save = function(newFee, custom_fee = null) {

    
    if ($scope.customFeeLevel) {
      $scope.currentFeeLevel = newFee;
      updateCurrentValues();
      return;
    }
    
  var network;

  $scope.save = function(newFee) {
    $scope.currentFeeLevel = newFee;
    updateCurrentValues();

    if ($scope.noSave) 
      return;
    var opts = {
      wallet: {
        settings: {
          feeLevel: newFee
        }
      }
    };
    
    if(custom_fee != null){
        opts.wallet.settings.customFeeLevel = custom_fee;
    }

    configService.set(opts, function(err) {
      if (err) $log.debug(err);
      $timeout(function() {
        $scope.$apply();
      });
    });
  };

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    $scope.init();
  });

  $scope.init = function() {
    var config = configService.getSync();
    $scope.customFeeRate = config.wallet.settings.customFeeLevel;
    $scope.feeOpts = feeService.feeOpts;
    $scope.currentFeeLevel = feeService.getCurrentFeeLevel();
    $scope.network = $scope.network || 'livenet';
    $scope.loadingFee = true;
    feeService.getFeeLevels(function(err, levels) {
      $scope.loadingFee = false;
      if (err) {
        //Error is already formatted
        popupService.showAlert(err);
        return;
      }
      $scope.feeLevels = levels;
      var customLevelObject = {feePerKB: ($scope.customFeeRate * 1024), level: 'custom', nbBlocks: false};
      $scope.feeLevels.livenet.push(customLevelObject);
      $scope.feeLevels.testnet.push(customLevelObject);
      updateCurrentValues();
      $timeout(function() {
        $scope.$apply();
      });
    });
  };

  var updateCurrentValues = function() {
    if (lodash.isEmpty($scope.feeLevels) || lodash.isEmpty($scope.currentFeeLevel)) return;

    var value = lodash.find($scope.feeLevels[$scope.network], {
      level: $scope.currentFeeLevel
    });

    if (lodash.isEmpty(value)) {
      $scope.feePerSatByte = null;
      $scope.avgConfirmationTime = null;
      return;
    }

    $scope.feePerSatByte = (feeLevelValue.feePerKB / 1024).toFixed();
    $scope.avgConfirmationTime = feeLevelValue.nbBlocks * 10;
    $timeout(function() {
        $scope.$apply();
    });
  };

  $scope.chooseNewFee = function() {
    $scope.hideModal($scope.currentFeeLevel);
  };
  
  $scope.checkCustomFee = function(fee){
    
    if(fee < 20){
        $scope.customFeeError = 'Custom fee too low, might never confirm';
        $scope.customFeeRate = 20;
    }
    else if(fee > 1000){
        $scope.customFeeError = 'Custom fee too high';
        $scope.customFeeRate = 1000;
    }
    else{
        $scope.customFeeError = null;
    }
    
    $timeout(function() {
        $scope.$apply();
    }); 
  };
});
