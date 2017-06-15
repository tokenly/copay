'use strict';

angular.module('copayApp.controllers').controller('tabSendController', function($scope, $rootScope, $log, $timeout, $ionicScrollDelegate, addressbookService, profileService, lodash, $state, walletService, incomingData, popupService, platformInfo, bwcError, gettextCatalog, storageService, bvamService, counterpartyService, bitcore) {

  var originalList;
  var CONTACTS_SHOW_LIMIT;
  var currentContactsPage;
  $scope.isChromeApp = platformInfo.isChromeApp;


  $scope.addressList = [];
  $scope.addressLabels = [];
  storageService.getAddressLabels(function(err, addressLabels){
     $scope.addressLabels = addressLabels; 
  });
  $scope.uniqueTokens = [];
  $scope.bvamData = [];
  
  $scope.source_balances = [];
  $scope.token_balance = 'N/A';
  $scope.btc_balance = 0;
  $scope.btc_balanceSat = 0;
  $scope.form_data = {};
  $scope.form_data.source_address = null;
  $scope.form_data.send_token = null;
  $scope.form_data.to_address = null;
  $scope.form_data.send_amount = null;
  $scope.form_data.fee_rate = null;
  $scope.form_data.btc_dust = 0.00005463; //default dust size
  
  $scope.errors = {};
  $scope.errors.to_address = null;
  

  var hasWallets = function() {
    $scope.wallets = profileService.getWallets({
      onlyComplete: true
    });
    $scope.hasWallets = lodash.isEmpty($scope.wallets) ? false : true;
  };

  // THIS is ONLY to show the 'buy bitcoins' message
  // does not has any other function.

  var updateHasFunds = function() {

    if ($rootScope.everHasFunds) {
      $scope.hasFunds = true;
      return;
    }

    $scope.hasFunds = false;
    var index = 0;
    lodash.each($scope.wallets, function(w) {
      walletService.getStatus(w, {}, function(err, status) {

        ++index;
        if (err && !status) {
          $log.error(err);
          // error updating the wallet. Probably a network error, do not show
          // the 'buy bitcoins' message.

          $scope.hasFunds = true;
        } else if (status.availableBalanceSat > 0) {
          $scope.hasFunds = true;
          $rootScope.everHasFunds = true;
        }

        if (index == $scope.wallets.length) {
          $scope.checkingBalance = false;
          $timeout(function() {
            $scope.$apply();
          });
        }
      });
    });
  };

  var updateWalletsList = function() {

    var networkResult = lodash.countBy($scope.wallets, 'network');

    $scope.showTransferCard = $scope.hasWallets && (networkResult.livenet > 1 || networkResult.testnet > 1);

    if ($scope.showTransferCard) {
      var walletsToTransfer = $scope.wallets;
      if (!(networkResult.livenet > 1)) {
        walletsToTransfer = lodash.filter(walletsToTransfer, function(item) {
          return item.network == 'testnet';
        });
      }
      if (!(networkResult.testnet > 1)) {
        walletsToTransfer = lodash.filter(walletsToTransfer, function(item) {
          return item.network == 'livenet';
        });
      }
      var walletList = [];
      lodash.each(walletsToTransfer, function(v) {
        walletList.push({
          color: v.color,
          name: v.name,
          recipientType: 'wallet',
          getAddress: function(cb) {
            walletService.getAddress(v, false, cb);
          },
        });
      });
      originalList = originalList.concat(walletList);
    }
  }

  var updateContactsList = function(cb) {
    addressbookService.list(function(err, ab) {
      if (err) $log.error(err);

      $scope.hasContacts = lodash.isEmpty(ab) ? false : true;
      if (!$scope.hasContacts) return cb();

      var completeContacts = [];
      lodash.each(ab, function(v, k) {
        completeContacts.push({
          name: lodash.isObject(v) ? v.name : v,
          address: k,
          email: lodash.isObject(v) ? v.email : null,
          recipientType: 'contact',
          getAddress: function(cb) {
            return cb(null, k);
          },
        });
      });
      var contacts = completeContacts.slice(0, (currentContactsPage + 1) * CONTACTS_SHOW_LIMIT);
      $scope.contactsShowMore = completeContacts.length > contacts.length;
      originalList = originalList.concat(contacts);
      return cb();
    });
  };

  var updateList = function() {
    $scope.list = lodash.clone(originalList);
    $timeout(function() {
      $ionicScrollDelegate.resize();
      $scope.$apply();
    }, 10);
  };

  $scope.openScanner = function() {
    $state.go('tabs.scan');
  };

  $scope.showMore = function() {
    currentContactsPage++;
    updateWalletsList();
  };

  $scope.searchInFocus = function() {
    $scope.searchFocus = true;
  };

  $scope.searchBlurred = function() {
    if ($scope.formData.search == null) {
      $scope.searchFocus = false;
    }
  };

  $scope.findContact = function(search) {

    if (incomingData.redir(search)) {
      return;
    }

    if (!search || search.length < 2) {
      $scope.list = originalList;
      $timeout(function() {
        $scope.$apply();
      });
      return;
    }

    var result = lodash.filter(originalList, function(item) {
      var val = item.name;
      return lodash.includes(val.toLowerCase(), search.toLowerCase());
    });

    $scope.list = result;
  };

  $scope.goToAmount = function(item) {
    $timeout(function() {
      item.getAddress(function(err, addr) {
        if (err || !addr) {
          //Error is already formated
          return popupService.showAlert(err);
        }
        $log.debug('Got toAddress:' + addr + ' | ' + item.name);
        return $state.transitionTo('tabs.send.amount', {
          recipientType: item.recipientType,
          toAddress: addr,
          toName: item.name,
          toEmail: item.email,
          toColor: item.color
        })
      });
    });
  };

  // This could probably be enhanced refactoring the routes abstract states
  $scope.createWallet = function() {
    $state.go('tabs.home').then(function() {
      $state.go('tabs.add.create-personal');
    });
  };

  $scope.buyBitcoin = function() {
    $state.go('tabs.home').then(function() {
      $state.go('tabs.buyandsell');
    });
  };

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    $scope.checkingBalance = true;
    $scope.formData = {
      search: null
    };
    originalList = [];
    CONTACTS_SHOW_LIMIT = 10;
    currentContactsPage = 0;
    hasWallets();
    
    
    $scope.wallets = profileService.getWallets();
    $scope.singleWallet = $scope.wallets.length == 1;

    if (!$scope.wallets[0]) return;

    // select first wallet if no wallet selected previously
    var selectedWallet = checkSelectedWallet($rootScope.wallet, $scope.wallets);
    $scope.onWalletSelect(selectedWallet);    
    
    $scope.loadWalletAddresses();
    
    
  });

  $scope.$on("$ionicView.enter", function(event, data) {
    if (!$scope.hasWallets) {
      $scope.checkingBalance = false;
      return;
    }
    updateHasFunds();
    updateWalletsList();
    updateContactsList(function() {
      updateList();
    });
  });
  
  $scope.onWalletSelect = function(wallet) {
    $scope.wallet = wallet;
    $rootScope.wallet = wallet;
    loadWalletAddresses();
  };  
  
  var checkSelectedWallet = function(wallet, wallets) {
    if (!wallet) return wallets[0];
    var w = lodash.find(wallets, function(w) {
      return w.id == wallet.id;
    });
    if (!w) return wallets[0];
    return wallet;
  }


  $scope.loadWalletAddresses = function() {
    walletService.getMainAddresses($scope.wallet, {}, function(err, addresses) {
       $scope.addressList = addresses.reverse();
        lodash.each(addresses, function(addr, idx) {
            if(idx === 0){
                $scope.form_data.source_address = addr.address;
                $scope.loadAddressBalances($scope.form_data.source_address);
            }
            if($scope.addressLabels[addr.address]){
                addr.label = $scope.addressLabels[addr.address] + ' - ' + addr.address;
            }         
        });
        $timeout(function(){
            $scope.$apply();
        }); 
    });
    
  }
  
  $scope.loadAddressBalances = function(address)
  {
    counterpartyService.getBalances(profileService.counterpartyWalletClients[$scope.wallet.id], address, function(err, tokenBalances) { 
        //console.log(tokenBalances);
        if(!tokenBalances){
            return;
        }
        //console.log('--LOADING COUNTERPARTY TOKEN AND BTC BALANCES ' + address + '--');
        
        $scope.source_balances = Array({tokenName: 'BTC', quantitySat: 0, quantityFloat: 0});
        $scope.form_data.send_token = 'BTC';
        $scope.form_data.send_amount = null;
        $scope.errors.send_amount = null;
        walletService.getAddressBalance($scope.wallet, address, function(err, btc_amount){
            $scope.source_balances[0].quantitySat = btc_amount;
            $scope.source_balances[0].quantityFloat = parseFloat((btc_amount / 100000000).toFixed(8));
            $scope.token_balance = parseFloat((btc_amount / 100000000).toFixed(8));
            $scope.btc_balance = parseFloat((btc_amount / 100000000).toFixed(8));
            $scope.btc_balanceSat = btc_amount;
            $scope.validateBTCDust($scope.form_data.btc_dust);
            $timeout(function(){
                $scope.$apply();
            });             
        });        
        
        var used_tokens = [];
        lodash.each(tokenBalances, function(token, idx){
            if(token.quantitySat > 0){
                $scope.source_balances.push(token);
            }
            if($scope.bvamData[token.tokenName] == undefined){
                used_tokens.push(token.tokenName);
            }
        });
        
        if(used_tokens.length > 0){
            bvamService.getBvamData(profileService.counterpartyWalletClients[$scope.wallet.id], used_tokens, function(err, bvam_data){
              //console.log('-- LOADING COUNTERPARTY BVAM DATA --');
               lodash.each(bvam_data, function(bvam){
                  $scope.bvamData[bvam.asset] = bvam;
                  $scope.bvamData[bvam.asset].selectName = bvam.asset;
                  if(bvam.metadata.name && bvam.metadata.name != bvam.asset){
                      $scope.bvamData[bvam.asset].selectName = bvam.metadata.name + ' (' + bvam.asset + ')';
                  } 
               });
               //console.log($scope.bvamData);
            });      
        }
                 
        $timeout(function(){
            $scope.$apply();
        }); 
    });
      
  };
  
  $scope.updateSendTokenBalance = function(token){
      $scope.form_data.send_amount = null;
      for(var i = 0; i < $scope.source_balances.length; i++){
          if($scope.source_balances[i].tokenName == token){
            $scope.token_balance = $scope.source_balances[i].quantityFloat;
          }
      }
  };
  
  
  $scope.onWalletSelect = function(wallet, refresh = true) {
    $scope.wallet = wallet;
    $rootScope.wallet = wallet;
    if(refresh){
        setTimeout(function(){
            $scope.loadWalletAddresses();
        }, 500);
    }
  };

  $scope.showWalletSelector = function() {
    if ($scope.singleWallet) return;
    $scope.walletSelectorTitle = gettextCatalog.getString('Inventory from');
    $scope.showWallets = true;
  };      
  
  $scope.validateAddress = function(address){
      var is_valid =  bitcore.Address.isValid(address);
      if(!is_valid && address.trim() != ''){
          $scope.errors.to_address = 'Invalid bitcoin address';
      }
      else{
          $scope.errors.to_address = null;
      }
      return is_valid;
  };

  $scope.validateAmount = function(amount){
    var token = $scope.form_data.send_token;
    var balance = $scope.token_balance;
    
    if(amount != null && (amount <= 0 || amount > balance)){
        $scope.errors.send_amount = 'Invalid amount';
        return false;
    }
    else{
        $scope.errors.send_amount = null;
        return true;
    }   
      
  };


  $scope.validateBTCDust = function(amount){
    var balance = $scope.btc_balance;
    if(amount != null && amount <= 0){
        $scope.errors.btc_dust = 'Invalid amount';
        return false;
    }
    else if(amount != null && balance < amount){
        $scope.errors.btc_dust = 'Not enough BTC balance';
        return false;
    }
    else if(amount != null && amount < 0.00005463){
        $scope.errors.btc_dust = 'Dust size too low';
        return false;
    }
    else{
        $scope.errors.btc_dust = null;
        return true;
    }   
      
  };


  $scope.validateFeeRate = function(rate){

    if(rate != null && rate <= 0){
        $scope.errors.fee_rate = 'Invalid amount';
        return false;
    }
    else if(rate != null && rate > 1000){
        $scope.errors.fee_rate = 'Fee rate is unusually high';
        return false;
    }
    else if(rate != null && rate < 20){
        $scope.errors.fee_rate = 'Fee rate is unusually low';
        return false;
    }    
    else{
        $scope.errors.fee_rate = null;
        return true;
    }   
      
  };

});
