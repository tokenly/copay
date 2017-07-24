'use strict';

angular.module('copayApp.controllers').controller('tabInventoryController', function($rootScope, $scope, $location, $timeout, $log, $ionicModal, $state, $ionicHistory, $ionicPopover, storageService, platformInfo, walletService, profileService, configService, lodash, gettextCatalog, popupService, bwcError, counterpartyService, ongoingProcess, bvamService) {

  var listeners = [];
  $scope.isCordova = platformInfo.isCordova;
  $scope.isNW = platformInfo.isNW;

  $scope.inventorySearch = null;
  $scope.inventoryBalances = [];
  $scope.BTCBalances = [];
  $scope.bvamData = [];
  $scope.addressLabels = [];
  $scope.unconfirmedInventoryBalances = [];
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
    $scope.loadWalletTransactions();        
    
    walletService.getMainAddresses(selectedWallet, {}, function(err, addresses) {
       if(!addresses){
           return;
       }
       $scope.address_list = addresses.reverse();
        lodash.each(addresses, function(addr) {
            //addr.address = '3ECmqqsnyTwqECBfvvTaSsafUa1WmQjZ6c';
            if($scope.addressLabels[addr.address]){
                addr.label = $scope.addressLabels[addr.address];
            }
            walletService.getAddressBalance(selectedWallet, addr.address, function(err, btc_amount){
                $scope.BTCBalances[addr.address] = btc_amount;
            });
            $scope.inventoryBalances[addr.address] = [];
            $scope.loadAddressBalances(addr.address);
            $scope.$apply();            
        });
        $timeout(function() {
            document.getElementById('refresh-inventory-icon').style.webkitTransform = 'rotate(0deg)';        
        });
    });
    


  };


  $scope.$on("$ionicView.beforeEnter", function(event, data) {

    $scope.unconfirmedHistory = [];
    $scope.address_list = [];
    $scope.uniqueTokens = [];
    
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
  
    $scope.applyUnconfirmedBalances = function(address){
        if(!$scope.unconfirmedInventoryBalances[address]){
            return;
        }
        
        if(!$scope.inventoryBalances[address]){
            $scope.inventoryBalances[address] = [];
        }
        
        var balances = $scope.inventoryBalances[address];
        var unconf_balances = $scope.unconfirmedInventoryBalances[address];
        for(var i = 0; i < unconf_balances.length; i++){
            var unconf = unconf_balances[i];
            var found = false;
            for(var i2 = 0; i2 < balances.length; i2++){
                var balance = balances[i2];
                if(balance.tokenName == unconf.tokenName){
                    balance.quantityFloatReceiving = unconf.quantityFloatReceiving;
                    balance.quantityFloatSending = unconf.quantityFloatSending;
                    $scope.inventoryBalances[address][i2] = balance;
                    found = true;
                    break;
                }
            }
            if(!found){
                $scope.inventoryBalances[address].push(unconf);
            }
        }
        $timeout(function() {
            $scope.$apply();
        });      
    };
  
    $scope.loadWalletTransactions = function(){
    
      
      walletService.getTxHistory($scope.wallet, {}, function(err, txHistory) {
        if (err) {
            console.log('Error getting wallet tx history');
            console.log(err);
            return;
        }
        
        counterpartyService.applyCounterpartyDataToTxHistory(profileService.counterpartyWalletClients[$scope.wallet.id], txHistory, function(err, xcpHistory){
            if(!xcpHistory){
                console.log('Error loading counterparty tx history, using btc history as backup');
                console.log(err);
                $scope.completeTxHistory = txHistory;
                $timeout(function() {
                    $scope.$apply();
                }); 
                return;
            }
            var unconfirmedHistory = [];
            for(var i = 0; i < xcpHistory.length; i++){
                if(xcpHistory[i].confirmations > 0){
                  continue;
                }
                xcpHistory[i].ourAddress = false;
                var outputs = xcpHistory[i].outputs;
                if(xcpHistory[i].action == "sent"){                   
                    if(xcpHistory[i].customData){
                        if(xcpHistory[i].customData.sourceAddress){
                            xcpHistory[i].ourAddress = xcpHistory[i].customData.sourceAddress;
                        }
                        else if(xcpHistory[i].customData.counterparty){
                            console.log(xcpHistory[i].customData.counterparty);
                            xcpHistory[i].ourAddress = xcpHistory[i].customData.counterparty.sourceAddress;
                        }
                    }
                    else if(xcpHistory[i].counterparty && xcpHistory[i].counterparty.source){
                        xcpHistory[i].ourAddress = xcpHistory[i].counterparty.source;
                    }
                }
                else{
                    for(var i2 = 0; i2 < xcpHistory[i].outputs.length; i2++){
                      for(var i3 = 0; i3 < $scope.address_list.length; i3++){
                          if($scope.address_list[i3].address == xcpHistory[i].outputs[i2].address){
                              xcpHistory[i].ourAddress = $scope.address_list[i3].address;
                              break;
                          }
                      }
                    }
                }
                if(xcpHistory[i].counterparty.asset){
                    var asset = xcpHistory[i].counterparty.asset;
                    if($scope.uniqueTokens.indexOf(asset) == -1){
                        $scope.uniqueTokens.push(asset);
                    }
                }
                unconfirmedHistory.push(xcpHistory[i]);
            }
            console.log('asdasdadasd');
            console.log(unconfirmedHistory);
            $scope.unconfirmedHistory = unconfirmedHistory;
            lodash.each(unconfirmedHistory, function(tx){
                if(!tx.counterparty.asset){
                    return;
                }
                if(tx.action == 'sent'){
                    var tx_source = null;
                    if(tx.customData && tx.customData.counterparty){
                        tx_source = tx.customData.counterparty.sourceAddress;
                    }
                    else if(tx.counterparty && tx.counterparty.source){
                        tx_source = tx.counterparty.source;
                    }
                    if(!tx_source){
                        return;
                    }
                    if(!$scope.unconfirmedInventoryBalances[tx_source]){
                        $scope.unconfirmedInventoryBalances[tx_source] = [];
                    }                    
                    var balance_found = false;
                    lodash.find($scope.unconfirmedInventoryBalances[tx_source], {tokenName: tx.counterparty.asset}, function(current_balance){
                        balance_found = true;
                        current_balance.quantityFloatSending += tx.counterparty.quantityFloat;
                    });
                    if(!balance_found){
                        //create a new balance entry for the address
                        var balance_entry = {
                            amountStr: "0",
                            bg_color: stringToColor(tx.counterparty.asset),
                            divisible: tx.counterparty.divisible,
                            quantityFloat: 0,
                            quantityFloatReceiving: 0,
                            quantityFloatSending: tx.counterparty.quantityFloat,
                            quantitySat: 0,
                            tokenName: tx.counterparty.asset
                        };
                        $scope.unconfirmedInventoryBalances[tx_source].push(balance_entry);
                    }
                }
                else{ //received
                    if(!$scope.unconfirmedInventoryBalances[tx.counterparty.destination]){
                        $scope.unconfirmedInventoryBalances[tx.counterparty.destination] = [];
                    }                    
                    var balance_found = false;
                    lodash.find($scope.unconfirmedInventoryBalances[tx.counterparty.destination], {tokenName: tx.counterparty.asset}, function(current_balance){
                        balance_found = true;
                        current_balance.quantityFloatReceiving += tx.counterparty.quantityFloat;
                    });
                    if(!balance_found){
                        //create a new balance entry for the address
                        var balance_entry = {
                            amountStr: "0",
                            bg_color: stringToColor(tx.counterparty.asset),
                            divisible: tx.counterparty.divisible,
                            quantityFloat: 0,
                            quantityFloatReceiving: tx.counterparty.quantityFloat,
                            quantityFloatSending: 0,
                            quantitySat: 0,
                            tokenName: tx.counterparty.asset
                        };
                        $scope.unconfirmedInventoryBalances[tx.counterparty.destination].push(balance_entry);
                    }
                }
            });

            $timeout(function() {             
                $scope.$apply();
            });            
        });
      });
    };

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
        if(!tokenBalances){
            console.log('Error loading counterparty token balances');
            console.log(err);
            return;
        }
        console.log('--LOADING COUNTERPARTY TOKEN BALANCES ' + address + '--');
        //console.log(tokenBalances);
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
               //console.log($scope.bvamData);
            });      
        }
        $timeout(function() {
            $scope.applyUnconfirmedBalances(address);
            $scope.$apply();
        }, 300);          
    });
      
  };
  
  $scope.newAddress = function() {
    if ($scope.gapReached) return;

    ongoingProcess.set('generatingNewAddress', true);
    walletService.getAddress($scope.wallet, true, function(err, addr) {
      if (err) {
        ongoingProcess.set('generatingNewAddress', false);
        if (err.toString().match('MAIN_ADDRESS_GAP_REACHED')) {
          $scope.gapReached = true;
        } else {
          popupService.showAlert(err);
        }
        $timeout(function() {
          $scope.$apply();
        });
        return;
      }

      walletService.getMainAddresses($scope.wallet, {}, function(err, addresses) {
        ongoingProcess.set('generatingNewAddress', false);
        if (err) return popupService.showAlert(gettextCatalog.getString('Error'), err);
        $scope.address_list = addresses.reverse();
        $scope.$apply();
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
