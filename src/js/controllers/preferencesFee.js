'use strict';

angular.module('copayApp.controllers').controller('preferencesFeeController', function($scope, $timeout, $ionicHistory, lodash, gettextCatalog, configService, feeService, ongoingProcess, popupService) {

  var network;
  
  $scope.save = function(newFee, custom_fee) {

    $scope.currentFeeLevel = newFee;

    if ($scope.noSave) 
      return;

   // if ($scope.currentFeeLevel != 'custom') updateCurrentValues();
   // else showCustomFeePrompt();
   
    updateCurrentValues();
    
    if ($scope.noSave) return;


    var opts = {
      wallet: {
        settings: {
          feeLevel: newFee
        }
      }
    };
    
    if(custom_fee != null && newFee == 'custom'){
        $scope.feePerSatByte = custom_fee;
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
      $scope.feePerSatByte = $scope.currentFeeLevel == 'custom' ? $scope.feePerSatByte : null;
      $scope.avgConfirmationTime = null;
      setMinWarning();
      setMaxWarning();
      $timeout(function() {
        $scope.$apply();
      }); 
      return;
    }

    $scope.feePerSatByte = (value.feePerKB / 1024).toFixed();
    $scope.avgConfirmationTime = value.nbBlocks * 10;

    $scope.invalidCustomFeeEntered = false;
    setMinWarning();
    setMaxWarning();
    $timeout(function() {
        $scope.$apply();
    });

  };

  $scope.chooseNewFee = function() {
    $scope.hideModal($scope.currentFeeLevel, $scope.customFeePerKB);
  };

  var showCustomFeePrompt = function() {
    $scope.invalidCustomFeeEntered = true;
    $scope.showMaxWarning = false;
    $scope.showMinWarning = false;
    popupService.showPrompt(gettextCatalog.getString('Custom Fee'), gettextCatalog.getString('Set your own fee in satoshis/byte'), null, function(text) {
      if (!text || !parseInt(text) || parseInt(text) <= 0) return;
      $scope.feePerSatByte = parseInt(text);
      $scope.customFeePerKB = ($scope.feePerSatByte * 1000).toFixed();
      setMaxWarning();
      setMinWarning();
      $timeout(function() {
        $scope.$apply();
      });
    });
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

  $scope.getMinimumRecommeded = function() {
    var value = lodash.find($scope.feeLevels[$scope.network], {
      level: 'superEconomy'
    });
    return parseInt((value.feePerKB / 1000).toFixed());
  };

  var setMinWarning = function() {
    if (parseInt($scope.feePerSatByte) < $scope.getMinimumRecommeded()) $scope.showMinWarning = true;
    else $scope.showMinWarning = false;
  };

  var setMaxWarning = function() {
    if (parseInt($scope.feePerSatByte) > 1000) {
      $scope.showMaxWarning = true;
      $scope.invalidCustomFeeEntered = true;
    } else {
      $scope.showMaxWarning = false;
      $scope.invalidCustomFeeEntered = false;
    }
  };

});
