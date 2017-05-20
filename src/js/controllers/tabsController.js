'use strict';

angular.module('copayApp.controllers').controller('tabsController', function($rootScope, $window, $log, $scope, $state, $stateParams, $timeout, incomingData, lodash, popupService, gettextCatalog, profileService, $ionicHistory) {

  $scope.onScan = function(data) {
    if (!incomingData.redir(data)) {
      popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('Invalid data'));
    }
  };

  $scope.setScanFn = function(scanFn) {
    $scope.scan = function() {
      $log.debug('Scanning...');
      scanFn();
    };
  };

  $scope.importInit = function() {
    $scope.fromOnboarding = $stateParams.fromOnboarding;
    $timeout(function() {
      $scope.$apply();
    }, 1);
  };


  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    $rootScope.hideTabs = '';
    $rootScope.wallets = profileService.getWallets();
    $rootScope.mobileView = true;
    if($window.innerWidth >= 768){
        $rootScope.mobileView = false;
    }
    
    var w = angular.element($window);
    $scope.$watch(
      function () {
        return $window.innerWidth;
      },
      function (value) {
        $scope.windowWidth = value;
      },
      true
    );

    w.bind('resize', function(){
        $rootScope.mobileView = true;
        if($window.innerWidth >= 768){
            $rootScope.mobileView = false;
        }        
    });    
    
  });


  $scope.openWallet = function(wallet) {
    
    $ionicHistory.nextViewOptions({
        disableAnimate: true
    });    
    
    if($state.current.name != 'tabs.wallet'){
        $state.go('tabs.home');
    }
    
    setTimeout(function(){
        if (!wallet.isComplete()) {
          return $state.go('tabs.copayers', {
            walletId: wallet.credentials.walletId
          });
        }

        $state.go('tabs.wallet', {
          walletId: wallet.credentials.walletId
        });
    }, 50
    );
  };  

});
