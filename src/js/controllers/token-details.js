'use strict';

angular.module('copayApp.controllers').controller('tokenDetailsController', function($rootScope, $scope, $timeout, $log, $ionicModal, $state, $ionicHistory, $ionicPopover, storageService, platformInfo, walletService, profileService, configService, lodash, gettextCatalog, popupService, bwcError, counterpartyService, ongoingProcess, bvamService) {

  $scope.currentInventoryToken = null;

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    var token = data.stateParams.tokenData;
    var bvam = data.stateParams.bvamData;
    var address = data.stateParams.address;
    $scope.currentInventoryToken = token;
    $scope.bvamData = [];
    $scope.bvamData[token.tokenName] = bvam;
    $scope.currentBvam = bvam;
    $scope.walletAddress = address;
   // $scope.wallet = profileService.getWallet(data.stateParams.walletId);


  });


}); 
