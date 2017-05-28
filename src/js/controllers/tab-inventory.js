'use strict';

angular.module('copayApp.controllers').controller('tabInventoryController', function($rootScope, $scope, $location, $timeout, $log, $ionicModal, $state, $ionicHistory, $ionicPopover, storageService, platformInfo, walletService, profileService, configService, lodash, gettextCatalog, popupService, bwcError, counterpartyService, ongoingProcess, bvamService) {

  var listeners = [];
  $scope.isCordova = platformInfo.isCordova;
  $scope.isNW = platformInfo.isNW;

  $scope.inventoryBalances = [];
  $scope.BTCBalances = [];
  $scope.bvamData = [];
  $scope.addressLabels = [];
  storageService.getAddressLabels(function(err, addressLabels){
    $scope.addressLabels = addressLabels;
  });;

    function hashCode(str) { // java String#hashCode
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
           hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    } 

    function intToRGB(i) {
        var c = (i & 0x00FFFFFF)
            .toString(16)
            .toUpperCase();

        return "00000".substring(0, 6 - c.length) + c;
    }
    
    function stringToColor(str) {
        return intToRGB(hashCode(str));
    }
    
  $scope.refreshBalances = function()
  {
    document.getElementById('refresh-inventory-icon').style.webkitTransform = 'rotate(360deg)';
    
    $scope.wallets = profileService.getWallets();
    $scope.singleWallet = $scope.wallets.length == 1;

    if (!$scope.wallets[0]) return;

    // select first wallet if no wallet selected previously
    var selectedWallet = checkSelectedWallet($rootScope.wallet, $scope.wallets);
    $scope.onWalletSelect(selectedWallet, false);
    
    walletService.getMainAddresses(selectedWallet, {}, function(err, addresses) {
       $scope.address_list = addresses.reverse();
        lodash.each(addresses, function(addr) {
            //addr.address = '3ECmqqsnyTwqECBfvvTaSsafUa1WmQjZ6c';
            if($scope.addressLabels[addr.address]){
                addr.label = $scope.addressLabels[addr.address];
            }
            walletService.getAddressBalance(selectedWallet, addr.address, function(err, btc_amount){
                $scope.BTCBalances[addr.address] = btc_amount;
            });
            $scope.inventoryBalances[addr.address] = {};
            $scope.loadAddressBalances(addr.address);
            $scope.$digest();            
        });
        document.getElementById('refresh-inventory-icon').style.webkitTransform = 'rotate(0deg)';
    });
    


  };


  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    $scope.refreshBalances();
    
    listeners = [
      $rootScope.$on('bwsEvent', function(e, walletId, type, n) {




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

  
  $scope.onWalletSelect = function(wallet, refresh = true) {
    $scope.wallet = wallet;
    $rootScope.wallet = wallet;
    if(refresh){
        setTimeout(function(){
            $scope.refreshBalances();
        }, 500);
    }
  };

  $scope.showWalletSelector = function() {
    if ($scope.singleWallet) return;
    $scope.walletSelectorTitle = gettextCatalog.getString('Inventory from');
    $scope.showWallets = true;
  };    
  

  $scope.loadAddressBalances = function(address)
  {
    counterpartyService.getBalances(profileService.counterpartyWalletClients[$scope.wallet.id], address, function(err, tokenBalances) { 
        //console.log(tokenBalances);
        console.log('--LOADING COUNTERPARTY TOKEN BALANCES ' + address + '--');
        $scope.inventoryBalances[address] = Array();
        var used_tokens = [];
        lodash.each(tokenBalances, function(token){
            if(token.quantitySat > 0){
                token.bg_color = stringToColor(token.tokenName);
                $scope.inventoryBalances[address].push(token);
            }
            if($scope.bvamData[token.tokenName] == undefined){
                used_tokens.push(token.tokenName);
            }
        });
        
        if(used_tokens.length > 0){
            bvamService.getBvamData(profileService.counterpartyWalletClients[$scope.wallet.id], used_tokens, function(err, bvam_data){
               console.log('-- LOADING COUNTERPARTY BVAM DATA --');
               lodash.each(bvam_data, function(bvam){
                  $scope.bvamData[bvam.asset] = bvam; 
               });
               console.log($scope.bvamData);
            });      
        }
    });
      
  };
  
  $scope.newAddress = function() {
    if ($scope.gapReached) return;

    ongoingProcess.set('generatingNewAddress', true);
    walletService.getAddress($scope.wallet, false, function(err, addr) {
      if (err) {
        ongoingProcess.set('generatingNewAddress', false);
        if (err.toString().match('MAIN_ADDRESS_GAP_REACHED')) {
          $scope.gapReached = true;
        } else {
          popupService.showAlert(err);
        }
        $timeout(function() {
          $scope.$digest();
        });
        return;
      }

      walletService.getMainAddresses($scope.wallet, {}, function(err, addresses) {
        ongoingProcess.set('generatingNewAddress', false);
        if (err) return popupService.showAlert(gettextCatalog.getString('Error'), err);
        $scope.address_list = addresses.reverse();
        $scope.$digest();
      });
    });
  };  


    $scope.saveAddressLabels = function() {
        console.log('--SAVING ADDRESS LABELS--');
        //console.log($scope.addressLabels);
        storageService.storeAddressLabels($scope.addressLabels, function(err, result){
            //saved
        });
        
    };
    

});
