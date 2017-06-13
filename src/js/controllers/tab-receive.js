'use strict';

angular.module('copayApp.controllers').controller('tabReceiveController', function($rootScope, $scope, $timeout, $log, $ionicModal, $state, $ionicHistory, $ionicPopover, storageService, platformInfo, walletService, profileService, configService, lodash, gettextCatalog, popupService, bwcError) {

  var listeners = [];
  $scope.isCordova = platformInfo.isCordova;
  $scope.isNW = platformInfo.isNW;
  
  $scope.addressList = null;
  $scope.addressLabels = [];
  storageService.getAddressLabels(function(err, addressLabels){
    $scope.addressLabels = addressLabels;
  });;

  $scope.requestSpecificAmount = function() {
    $state.go('tabs.paymentRequest.amount', {
      id: $scope.wallet.credentials.walletId,
      address: $rootScope.addr,
    });
  };

  $scope.setAddress = function(newAddr) {
    $rootScope.addr = null;
    if (!$scope.wallet || $scope.generatingAddress || !$scope.wallet.isComplete()) return;
    $scope.generatingAddress = true;
    walletService.getAddress($scope.wallet, newAddr, function(err, addr) {
      $scope.generatingAddress = false;

      if (err) {
        //Error is already formated
        popupService.showAlert(err);
      }

      $rootScope.addr = addr;
      $scope.loadAddresses($scope.wallet); 
      
      $timeout(function() {
        $scope.$apply();
      }, 10);
    });
  };

  $scope.goCopayers = function() {
    $ionicHistory.removeBackView();
    $ionicHistory.nextViewOptions({
      disableAnimate: true
    });
    $state.go('tabs.home');
    $timeout(function() {
      $state.transitionTo('tabs.copayers', {
        walletId: $scope.wallet.credentials.walletId
      });
    }, 100);
  };

  $scope.openBackupNeededModal = function() {
    $ionicModal.fromTemplateUrl('views/includes/backupNeededPopup.html', {
      scope: $scope,
      backdropClickToClose: false,
      hardwareBackButtonClose: false
    }).then(function(modal) {
      $scope.BackupNeededModal = modal;
      $scope.BackupNeededModal.show();
    });
  };

  $scope.close = function() {
    $scope.BackupNeededModal.hide();
    $scope.BackupNeededModal.remove();
  };

  $scope.doBackup = function() {
    $scope.close();
    $scope.goToBackupFlow();
  };

  $scope.goToBackupFlow = function() {
    $state.go('tabs.receive.backupWarning', {
      from: 'tabs.receive',
      walletId: $scope.wallet.credentials.walletId
    });
  };

  $scope.shouldShowReceiveAddressFromHardware = function() {
    var wallet = $scope.wallet;
    if (wallet.isPrivKeyExternal() && wallet.credentials.hwInfo) {
      return (wallet.credentials.hwInfo.name == walletService.externalSource.intelTEE.id);
    } else {
      return false;
    }
  };

  $scope.showReceiveAddressFromHardware = function() {
    var wallet = $scope.wallet;
    if (wallet.isPrivKeyExternal() && wallet.credentials.hwInfo) {
      walletService.showReceiveAddressFromHardware(wallet, $rootScope.addr, function() {});
    }
  };

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    $scope.wallets = profileService.getWallets();
    $scope.singleWallet = $scope.wallets.length == 1;

    if (!$scope.wallets[0]) return;

    // select first wallet if no wallet selected previously
    var selectedWallet = checkSelectedWallet($scope.wallet, $scope.wallets);
    $scope.onWalletSelect(selectedWallet);
    
    $scope.loadAddresses(selectedWallet);

    $scope.showShareButton = platformInfo.isCordova ? (platformInfo.isIOS ? 'iOS' : 'Android') : null;

    listeners = [
      $rootScope.$on('bwsEvent', function(e, walletId, type, n) {
        // Update current address
        //disable for Token Pockets
        //if ($scope.wallet && walletId == $scope.wallet.id && type == 'NewIncomingTx') $scope.setAddress(true);
      })
    ];
  });

  $scope.$on("$ionicView.leave", function(event, data) {
    lodash.each(listeners, function(x) {
      x();
    });
  });

  var checkSelectedWallet = function(wallet, wallets) {
    if (!wallet) return wallets[0];
    var w = lodash.find(wallets, function(w) {
      return w.id == wallet.id;
    });
    if (!w) return wallets[0];
    return wallet;
  }

  $scope.onWalletSelect = function(wallet) {
    $rootScope.wallet = wallet;
    $scope.loadAddresses(wallet);
    $scope.setAddress();
  };

  $scope.showWalletSelector = function() {
    if ($scope.singleWallet) return;
    $scope.walletSelectorTitle = gettextCatalog.getString('Select a wallet');
    $scope.showWallets = true;
  };

  $scope.shareAddress = function() {
    if (!$scope.isCordova) return;
    window.plugins.socialsharing.share('bitcoin:' + $rootScope.addr, null, null, null);
  };
  
  $scope.loadAddresses = function(selectedWallet) {
    walletService.getMainAddresses(selectedWallet, {}, function(err, addresses) {
        $scope.addressList = addresses;
        var i = -1;
        lodash.each(addresses, function(addr) {
            i++;
            if($scope.addressLabels[addr.address]){
                addr.label = $scope.addressLabels[addr.address];
                addr.friendlyLabel = addr.label + ' - ' + addr.address;
            }
            else{
                addr.label = null;
                addr.friendlyLabel = 'Pocket #' + (addresses.length - i) + ' - ' + addr.address;
            }
            $scope.$digest();            
        });
    });
  };
  
  $scope.switchAddress = function(address) {
      $rootScope.addr = address;
      $scope.$digest();
  };
  
});
