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
  
  var checkSelectedWallet = function(wallet, wallets) {
    if (!wallet) return wallets[0];
    var w = lodash.find(wallets, function(w) {
      return w.id == wallet.id;
    });
    if (!w) return wallets[0];
    return wallet;
  };

  $scope.onWalletSelect = function(wallet) {
    $rootScope.wallet = wallet;

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


  $scope.openWallet = function(wallet = null) {
    
    $ionicHistory.nextViewOptions({
        disableAnimate: true
    });    
    
    
    //if($state.current.name != 'tabs.wallet'){
        //$state.go('tabs.home');
    //}
    

    if(wallet == undefined || wallet == null){
        var wallets = $rootScope.wallets;
        var singleWallet = wallets.length == 1;

        if (!wallets[0]) return;

        // select first wallet if no wallet selected previously
        var selectedWallet = checkSelectedWallet($rootScope.wallet, wallets);
        wallet = selectedWallet;
    }

    
    setTimeout(function(){
        $state.go('tabs.home');
        
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
  

    $scope.openTokenDetails = function(address, token, bvam) {
        console.log('--OPENING TOKEN DETAILS ' + token.tokenName + '--');  
        console.log(token);
        console.log(bvam); 
        $state.go('tabs.inventory.token',  {"token": token.tokenName, "tokenData": token, "bvamData": bvam, "address": address});
        
    };
  
    $scope.numberWithCommas = function(x) {
        if(typeof x == 'undefined'){
            return null;
        }
        var parts = x.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };
    

});
