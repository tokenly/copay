'use strict';

angular.module('copayApp.controllers').controller('confirmController', function($rootScope, $scope, $interval, $filter, $timeout, $ionicScrollDelegate, gettextCatalog, walletService, platformInfo, lodash, configService, rateService, $stateParams, $window, $state, $log, profileService, bitcore, txFormatService, ongoingProcess, $ionicModal, popupService, $ionicHistory, $ionicConfig, payproService, feeService, bwcError) {

  var countDown = null;
  var CONFIRM_LIMIT_USD = 20;
  var FEE_TOO_HIGH_LIMIT_PER = 15;

  var tx = {};

  // Config Related values
  var config = configService.getSync();
  var defaultConfig = configService.getDefaults();
  var walletConfig = config.wallet;
  var unitToSatoshi = walletConfig.settings.unitToSatoshi;
  var unitDecimals = walletConfig.settings.unitDecimals;
  var satToUnit = 1 / unitToSatoshi;
  var configFeeLevel = walletConfig.settings.feeLevel ? walletConfig.settings.feeLevel : 'normal';

  var toAmount;
  var cachedSendMax;

  // Platform info
  var isChromeApp = platformInfo.isChromeApp;
  var isCordova = platformInfo.isCordova;
  var isWindowsPhoneApp = platformInfo.isCordova && platformInfo.isWP;

  function refresh() {
    $timeout(function() {
      $scope.$apply();
    }, 1);
  }


  $scope.showWalletSelector = function() {
    $scope.walletSelector = true;
    refresh();
  };

  $scope.$on("$ionicView.beforeLeave", function(event, data) {
    $ionicConfig.views.swipeBackEnabled(true);
  });

  $scope.$on("$ionicView.enter", function(event, data) {
    $ionicConfig.views.swipeBackEnabled(false);
    $scope.advancedTransactions = config.wallet.advancedTransactions;
    toAmount = data.stateParams.toAmount;
    cachedSendMax = {};
    $scope.showAddress = false;
    $scope.useSendMax = data.stateParams.useSendMax == 'true' ? true : false;
    $scope.recipientType = data.stateParams.recipientType || null;
    $scope.toAddress = data.stateParams.toAddress;
    $scope.toName = data.stateParams.toName;
    $scope.toEmail = data.stateParams.toEmail;
    $scope.toColor = data.stateParams.toColor;
    $scope.description = data.stateParams.description;
    $scope.paypro = data.stateParams.paypro;
    $scope.toAmount = toAmount;

    $scope.wallet = data.stateParams.wallet;
    $scope.wallets = [$scope.wallet];
    $scope.addressLabels = data.stateParams.addressLabels;
    $scope.bvamData = data.stateParams.bvamData;
    $scope.sourceAddress = data.stateParams.sourceAddress;
    $scope.sourceAddressData = data.stateParams.sourceAddressData;
    $scope.sourceBalances = data.stateParams.sourceBalances;
    $scope.sendToken = data.stateParams.sendToken;
    $scope.feeRate = data.stateParams.feeRate;
    $scope.btcDust = data.stateParams.btcDust;
    if($scope.btcDust == null || typeof $scope.btcDust == 'undefined'){
        $scope.btcDust = defaultConfig.counterpartyTokens.defaultDust;
    }
    
    $scope.estimatedFee = null;
    $scope.estimatedBytes = null;
    $scope.alternativeFeeStr = null;
    $scope.currentFeeRate = null;
    $scope.currentFeeLevel = feeService.getCurrentFeeLevel();
    
    $scope.buttonText = 'Send ' + $scope.sendToken;
    $scope.insufficientFunds = false;
    
    $scope.tx = false;
    
    $scope.insufficientFunds = false;
    $scope.noMatchingWallet = false;
    $scope.paymentExpired = false;
    
    $scope.remainingTimeStr = {
      value: null
    };
    $scope.network = (new bitcore.Address($scope.toAddress)).network.name;
    
    //setwallets();
    //applyButtonText();
    
    if(!$scope.sourceBalances[$scope.sendToken] || $scope.sourceBalances[$scope.sendToken] < toAmount){
        $scope.insufficientFunds = true;
    }
    
    //pregenerate a BTC or counterparty  transaction and figure out its size and fee cost etc.
    
    displayValues();    
    
    $timeout(function() {
        $scope.pregenerateTransaction();
        $scope.$apply();
    });    
 
  });
  
  $scope.pregenerateTransaction = function(){
      
    feeService.getFeeRate($scope.wallet.network, $scope.currentFeeLevel, function(err, fee_rate){
        
        var fee_rate = parseInt(fee_rate / 1024); //convert to bytes
        $scope.currentFeeRate = fee_rate;

        //send bitcoin from single BTC address to destination
        if($scope.sendToken == 'BTC'){
            console.log('PREPPING BTC TRANSACTION');        

            $scope.wallet.getUtxos({
                addresses: $scope.sourceAddress,
            }, 
            function(err, utxos) {
                if (err) return;
                var filter_utxos = filterUtxosForBTCSend(utxos, $scope.toAmount);
                if(!filter_utxos.inputs){
                    $scope.insufficientFunds = true;
                    $scope.buttonText = 'Insufficient Funds';
                    
                }
                utxos = filter_utxos.inputs;

                var estimated_fee = parseInt(filter_utxos.fee.fee);
                
                $scope.estimatedFee = estimated_fee;
                $scope.currentFeeRate = filter_utxos.fee.rate;
                $scope.estimatedBytes = filter_utxos.fee.bytes;
                $scope.estimatedChange = filter_utxos.change;
                
                txFormatService.formatAlternativeStr(estimated_fee, function(v) {
                  $scope.alternativeFeeStr = v;
                });                     
                
                $scope.tx = {
                  asset: 'BTC',
                  protocol: 'bitcoin',
                  toAmount: parseInt($scope.toAmount),
                  sendMax: $scope.useSendMax,
                  toAddress: $scope.toAddress,
                  sourceAddress: $scope.sourceAddress,
                  description: $scope.description,
                  paypro: $scope.paypro,
                  dust: 0,

                  feeLevel: configFeeLevel,
                  feeRate: $scope.currentFeeRate,
                  fee: $scope.estimatedFee,
                  change: parseInt($scope.estimatedChange),
                  inputs: utxos,
                  
                  spendUnconfirmed: walletConfig.spendUnconfirmed,

                  // Vanity tx info (not in the real tx)
                  recipientType: $scope.recipientType || null,
                  toName: $scope.toName,
                  toEmail: $scope.toEmail,
                  toColor: $scope.toColor,
                  network: (new bitcore.Address($scope.toAddress)).network.name,
                  txp: {}, 
                };

                
                $timeout(function() {
                    $scope.$apply();
                });  
                

            });
        }
        else{
            //counterparty token transaction
            console.log('PREPPING COUNTERPARTY TRANSACTION');

            $scope.wallet.getUtxos({
                addresses: $scope.sourceAddress,
            }, 
            function(err, utxos) {
                if (err) return;
                var filter_utxos = filterUtxosForCounterpartySend(utxos, $scope.btcDust);
                if(!filter_utxos.inputs){
                    $scope.insufficientFunds = true;
                    $scope.buttonText = 'Insufficient Funds';
                }
                utxos = filter_utxos.inputs;

                var estimated_fee = parseInt(filter_utxos.fee.fee);
                
                $scope.estimatedFee = estimated_fee;
                $scope.currentFeeRate = filter_utxos.fee.rate;
                $scope.estimatedBytes = filter_utxos.fee.bytes;
                $scope.estimatedChange = filter_utxos.change;

                txFormatService.formatAlternativeStr(estimated_fee, function(v) {
                  $scope.alternativeFeeStr = v;
                });  
                
                $scope.tx = {
                  asset: $scope.sendToken,
                  protocol: 'counterparty',
                  toAmount: parseInt($scope.toAmount),
                  sendMax: false,
                  toAddress: $scope.toAddress,
                  sourceAddress: $scope.sourceAddress,
                  description: $scope.description,
                  paypro: $scope.paypro,
                  dust: $scope.btcDust,

                  feeLevel: configFeeLevel,
                  feeRate: $scope.currentFeeRate,
                  fee: $scope.estimatedFee,
                  change: parseInt($scope.estimatedChange),
                  inputs: utxos,
                  
                  spendUnconfirmed: walletConfig.spendUnconfirmed,

                  // Vanity tx info (not in the real tx)
                  recipientType: $scope.recipientType || null,
                  toName: $scope.toName,
                  toEmail: $scope.toEmail,
                  toColor: $scope.toColor,
                  network: (new bitcore.Address($scope.toAddress)).network.name,
                  txp: {}, 
                };

                $timeout(function() {
                    $scope.$apply();
                });  
            });
        }
    });
    
    function filterUtxosForCounterpartySend(utxos, dust_size){
        return filterUtxosForBTCSend(utxos, dust_size, 1, 80);
    }
    
    function filterUtxosForBTCSend(utxos, amount, input_count = 1, extra_bytes = null){
        var fee_estimate = estimateTxFeeFromSize(input_count, 2, $scope.currentFeeRate, extra_bytes); //get initial fee estimate
        console.log(fee_estimate);
        console.log(amount);
        var total_amount = parseInt(amount) + parseInt(fee_estimate.fee);
        var dust_size = 141 * $scope.currentFeeRate; //minimum value worth spending
        
        //sort by largest input
        utxos.sort(function(a,b){
          if (a.satoshis < b.satoshis)
            return -1;
          if (a.satoshis > b.satoshis)
            return 1;
          return 0;
        }).reverse(); 
        
        //build input list
        var inputs = [];
        var found = 0;
        for(var i = 0; i < utxos.length; i++){
            var utxo = utxos[i];
            if(utxo.locked){ continue; } //filter locked payments
            if(utxo.satoshis <= dust_size){ continue; } //filter dust payments
            found += utxo.satoshis;
            utxo.amount = parseFloat((utxo.satoshis / 100000000).toFixed(8));
            utxo.path = $scope.sourceAddressData.path;
            inputs.push(utxo);
            if(found >= total_amount){
                break;
            }
        }
        if(inputs.length > input_count){ //try again with different fee estimate from larger # of inputs
            return filterUtxosForBTCSend(utxos, amount, inputs.length, extra_bytes);
        }
        if(found < total_amount){
            console.log('NOT ENOUGH UTXOS SELECTED FOR TX');
            inputs = false;
        }
        
        //calculate change
        var change = parseInt(found) - parseInt(total_amount);
        console.log(found);
        console.log(total_amount);
        console.log(change);
        if(change <= dust_size && change > 0){ //let dust values become part of the miner fee
            fee_estimate.extra_fee = change;
            fee_estimate.fee += change;
            fee_estimate.rate = parseInt(fee_estimate.fee / fee_estimate.bytes);
            change = 0;
        }
        
        //return data
        return {"inputs": inputs, "amount": amount, "fee": fee_estimate, "change": change};
    }
    
    function estimateTxFeeFromSize(inputs, outputs, fee_rate, extra_bytes = 0){
        var input_bytes = 141 * inputs;
        var output_bytes = 34 * outputs;
        var extra = 10;
        var total_bytes = input_bytes + output_bytes + extra_bytes + extra;
        var estimate_fee = total_bytes * fee_rate;
        return {rate: fee_rate, bytes: total_bytes, fee: estimate_fee, extra_fee: 0, input_count: inputs, output_count: outputs};
    }
    


  };
  

  function exitWithError(err) {
    $log.info('Error setting wallet selector:' + err);
    popupService.showAlert(gettextCatalog.getString(), bwcError.msg(err), function() {
      $ionicHistory.nextViewOptions({
        disableAnimate: true,
        historyRoot: true
      });
      $ionicHistory.clearHistory();
      $state.go('tabs.send');
    });
  };

  function setNoWallet(msg) {
    $scope.wallet = null;
    $scope.noWalletMessage = gettextCatalog.getString(msg);
    $log.warn('Not ready to make the payment:' + msg);
    $timeout(function() {
      $scope.$apply();
    });
  };


function setWalletSelector(network, minAmount, cb) {

  // no min amount? (sendMax) => look for no empty wallets
  minAmount = minAmount || 1;

}


  $scope.$on("$ionicView.beforeEnter", function(event, data) {

    /*
  function setwallets() {
    $scope.wallets = profileService.getWallets({
      onlyComplete: true,
      network: $scope.network
    });

    if (!$scope.wallets || !$scope.wallets.length) {
      $scope.noMatchingWallet = true;
      displayValues();
      $log.warn('No ' + $scope.network + ' wallets to make the payment');
      $timeout(function() {
        $scope.$apply();

      $scope.wallets = profileService.getWallets({
        onlyComplete: true,
        network: network
      });

      if (!$scope.wallets || !$scope.wallets.length) {
        setNoWallet('No wallets available');
        return cb();
      }

      var filteredWallets = [];
      var index = 0;
      var walletsUpdated = 0;

      lodash.each($scope.wallets, function(w) {
        walletService.getStatus(w, {}, function(err, status) {
          if (err || !status) {
            $log.error(err);
          } else {
            walletsUpdated++;
            w.status = status;

            if (!status.availableBalanceSat)
              $log.debug('No balance available in: ' + w.name);

            if (status.availableBalanceSat > minAmount) {
              filteredWallets.push(w);
            }
          }

          if (++index == $scope.wallets.length) {
            if (!walletsUpdated)
              return cb('Could not update any wallet');

            if (lodash.isEmpty(filteredWallets)) {
              setNoWallet('Insufficent funds');
            }
            $scope.wallets = lodash.clone(filteredWallets);
            return cb();
          }
        });
      });
    };

    // Setup $scope

    // Grab stateParams
    tx = {
      toAmount: parseInt(data.stateParams.toAmount),
      sendMax: data.stateParams.useSendMax == 'true' ? true : false,
      toAddress: data.stateParams.toAddress,
      description: data.stateParams.description,
      paypro: data.stateParams.paypro,

      feeLevel: configFeeLevel,
      spendUnconfirmed: walletConfig.spendUnconfirmed,

      // Vanity tx info (not in the real tx)
      recipientType: data.stateParams.recipientType || null,
      toName: data.stateParams.toName,
      toEmail: data.stateParams.toEmail,
      toColor: data.stateParams.toColor,
      network: (new bitcore.Address(data.stateParams.toAddress)).network.name,
      txp: {},
    };


    // Other Scope vars
    $scope.isCordova = isCordova;
    $scope.isWindowsPhoneApp = isWindowsPhoneApp;
    $scope.showAddress = false;

    updateTx(tx, null, {}, function() {

      $scope.walletSelectorTitle = gettextCatalog.getString('Send from');

      setWalletSelector(tx.network, tx.toAmount, function(err) {
        if (err) {
          return exitWithError('Could not update wallets');
        }

        if ($scope.wallets.length > 1) {
          $scope.showWalletSelector();
        } else if ($scope.wallets.length) {
          setWallet($scope.wallets[0], tx);
        }
      });

    });

  };
  */
    });

  function getSendMaxInfo(tx, wallet, cb) {
    if (!tx.sendMax) return cb();

    //ongoingProcess.set('retrievingInputs', true);
    walletService.getSendMaxInfo(wallet, {
      feePerKb: tx.feeRate,
      excludeUnconfirmedUtxos: !tx.spendUnconfirmed,
      returnInputs: true,
    }, cb);
  };

  function displayValues() {
    toAmount = parseInt(toAmount);
    if($scope.sendToken == null || $scope.sendToken == 'BTC'){
        $scope.amountStr = txFormatService.formatAmountStr(toAmount);
        $scope.displayAmount = getDisplayAmount($scope.amountStr);        
        $scope.displayUnit = getDisplayUnit($scope.amountStr);
        txFormatService.formatAlternativeStr(toAmount, function(v) {
          $scope.alternativeAmountStr = v;
        });        
    }
    else{
        $scope.amountStr = (toAmount / 100000000).toFixed(8);
        $scope.displayAmount = $scope.amountStr;
        $scope.displayUnit = $scope.sendToken;
        if($scope.bvamData[$scope.sendToken] && $scope.bvamData[$scope.sendToken].metadata.name != $scope.sendToken){
            $scope.alternativeAmountStr = $scope.sendToken;
        }
    }
  };
  
  function getDisplayAmount(amountStr) {
    return amountStr.split(' ')[0];
  };

  function getDisplayUnit(amountStr) {
    return amountStr.split(' ')[1];
  };  

  function getCounterpartyTxp(tx, wallet, dryRun, cb) {
      console.log('ABOUT TO SEND XCP TX....');
    if (tx.description && !wallet.credentials.sharedEncryptingKey) {
      var msg = gettextCatalog.getString('Could not add message to imported wallet without shared encrypting key');
      $log.warn(msg);
      return setSendError(msg);
    }

    if (tx.toAmount > Number.MAX_SAFE_INTEGER) {
      var msg = gettextCatalog.getString('Amount too big');
      $log.warn(msg);
      return setSendError(msg);
    }
    
    var divisible;
    if (tx.asset == 'BTC') {
        divisible = true;
    } else {
        // determine divisibility
        var tokenBalanceDetails = tokenBalanceDetailsByName(tx.asset)
        if (!tokenBalanceDetails) {
            throw new Error("Unable to find balance details for token "+tx.asset);
        }
        divisible = tokenBalanceDetails.assetInfo.divisible;
    }
    
    var txp = {};

    txp.outputs = [
    {
      'toAddress': tx.toAddress,
      'amount': tx.toAmount,
      'token': tx.asset,
      'divisible': divisible,
      'dust': tx.dust,
      'message': tx.description,
    }
    ];
    
    if(tx.change && tx.change > 0){
        txp.outputs.push({
          'toAddress': tx.sourceAddress,
          'amount': tx.change,
          'message': null,
          'token': 'BTC'          
        });
    }
    
    txp.inputs = tx.inputs;
    txp.fee = tx.fee;
    txp.message = tx.description;

    if (tx.paypro) {
      txp.payProUrl = tx.paypro.url;
    }
    txp.excludeUnconfirmedUtxos = !tx.spendUnconfirmed;
    txp.dryRun = dryRun;
    
    walletService.createTx(wallet, txp, function(err, ctxp) {
      if (err) {
        setSendError(err);
        console.log('error...');
        console.log(err);
        return cb(err);
      }
      console.log(ctxp);
      return cb(null, ctxp);
    });    
      
  };
  
  function tokenBalanceDetailsByName(tokenName) {
    var foundToken = null, keepSearching = true;
    console.log(tokenName);
    console.log($scope.bvamData);
    if($scope.bvamData[tokenName]){
        return $scope.bvamData[tokenName];
    }
  }  

  function getTxp(tx, wallet, dryRun, cb) {

    // ToDo: use a credential's (or fc's) function for this
    if (tx.description && !wallet.credentials.sharedEncryptingKey) {
      var msg = gettextCatalog.getString('Could not add message to imported wallet without shared encrypting key');
      $log.warn(msg);
      return setSendError(msg);
    }

    if (tx.toAmount > Number.MAX_SAFE_INTEGER) {
      var msg = gettextCatalog.getString('Amount too big');
      $log.warn(msg);
      return setSendError(msg);
    }

    var txp = {};

    txp.outputs = [
    {
      'toAddress': tx.toAddress,
      'amount': tx.toAmount,
      'message': tx.description
    }
    ];
    
    if(tx.change && tx.change > 0){
        txp.outputs.push({
          'toAddress': tx.sourceAddress,
          'amount': tx.change,
          'message': null
        });
    }
    
    txp.inputs = tx.inputs;
    txp.fee = tx.fee;

    /*
    if (tx.sendMaxInfo) {
      txp.fee = tx.sendMaxInfo.fee;
    } else {
      txp.feeLevel = tx.feeLevel;
    }
    */

    txp.message = tx.description;

    if (tx.paypro) {
      txp.payProUrl = tx.paypro.url;
    }
    txp.excludeUnconfirmedUtxos = !tx.spendUnconfirmed;
    txp.dryRun = dryRun;
    
    walletService.createTx(wallet, txp, function(err, ctxp) {
      if (err) {
        setSendError(err);
        return cb(err);
      }
      return cb(null, ctxp);
    });
  };

  function updateTx(tx, wallet, opts, cb) {

    if (opts.clearCache) {
      tx.txp = {};
    }

    $scope.tx = tx;

    function updateAmount() {
      if (!tx.toAmount) return;

      // Amount
      tx.amountStr = txFormatService.formatAmountStr(tx.toAmount);
      tx.amountValueStr = tx.amountStr.split(' ')[0];
      tx.amountUnitStr = tx.amountStr.split(' ')[1];
      txFormatService.formatAlternativeStr(tx.toAmount, function(v) {
        tx.alternativeAmountStr = v;
      });
    }

    updateAmount();
    refresh();

    // End of quick refresh, before wallet is selected.
    if (!wallet)return cb();

    feeService.getFeeRate(tx.network, tx.feeLevel, function(err, feeRate) {
      if (err) return cb(err);

      tx.feeRate = feeRate;
      tx.feeLevelName = feeService.feeOpts[tx.feeLevel];

      if (!wallet)
        return cb();

      getSendMaxInfo(lodash.clone(tx), wallet, function(err, sendMaxInfo) {
        if (err) {
          var msg = gettextCatalog.getString('Error getting SendMax information');
          return setSendError(msg);
        }

        if (sendMaxInfo) {

          $log.debug('Send max info', sendMaxInfo);

          if (tx.sendMax && sendMaxInfo.amount == 0) {
            setNoWallet('Insufficent funds');
            popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('Not enough funds for fee'));
            return cb('no_funds');
          }

          tx.sendMaxInfo = sendMaxInfo;
          tx.toAmount = tx.sendMaxInfo.amount;
          updateAmount();
          showSendMaxWarning(sendMaxInfo);
        }

        // txp already generated for this wallet?
        if (tx.txp[wallet.id]) {
          refresh();
          return cb();
        }

        getTxp(lodash.clone(tx), wallet, opts.dryRun, function(err, txp) {
          if (err) return cb(err);

          txp.feeStr = txFormatService.formatAmountStr(txp.fee);
          txFormatService.formatAlternativeStr(txp.fee, function(v) {
            txp.alternativeFeeStr = v;
          });

          var per = (txp.fee / (txp.amount + txp.fee) * 100);
          txp.feeRatePerStr = per.toFixed(2) + '%';
          txp.feeToHigh = per > FEE_TOO_HIGH_LIMIT_PER; 


          tx.txp[wallet.id] = txp;
          $log.debug('Confirm. TX Fully Updated for wallet:' + wallet.id, tx);
          refresh();

          return cb();
        });
      });
    });
  }

  function useSelectedWallet() {

    if (!$scope.useSendMax) {
      showAmount(tx.toAmount);
    }

    $scope.onWalletSelect($scope.wallet);
  }

  function setButtonText(isMultisig, isPayPro) {
    $scope.buttonText = gettextCatalog.getString(isCordova && !isWindowsPhoneApp ? 'Slide' : 'Click') + ' ';

    if (isPayPro) {
      $scope.buttonText += gettextCatalog.getString('to pay');
    } else if (isMultisig) {
      $scope.buttonText += gettextCatalog.getString('to accept');
    } else
      $scope.buttonText += gettextCatalog.getString('to send');
  };


  $scope.toggleAddress = function() {
    $scope.showAddress = !$scope.showAddress;
  };


  function showSendMaxWarning(sendMaxInfo) {

    function verifyExcludedUtxos() {
      var warningMsg = [];
      if (sendMaxInfo.utxosBelowFee > 0) {
        warningMsg.push(gettextCatalog.getString("A total of {{amountBelowFeeStr}} were excluded. These funds come from UTXOs smaller than the network fee provided.", {
          amountBelowFeeStr: txFormatService.formatAmountStr(sendMaxInfo.amountBelowFee)
        }));
      }

      if (sendMaxInfo.utxosAboveMaxSize > 0) {
        warningMsg.push(gettextCatalog.getString("A total of {{amountAboveMaxSizeStr}} were excluded. The maximum size allowed for a transaction was exceeded.", {
          amountAboveMaxSizeStr: txFormatService.formatAmountStr(sendMaxInfo.amountAboveMaxSize)
        }));
      }
      return warningMsg.join('\n');
    };

    var msg = gettextCatalog.getString("{{fee}} will be deducted for bitcoin networking fees.", {
      fee: txFormatService.formatAmountStr(sendMaxInfo.fee)
    });
    var warningMsg = verifyExcludedUtxos();

    if (!lodash.isEmpty(warningMsg))
      msg += '\n' + warningMsg;

    popupService.showAlert(null, msg, function() {});
  };

  $scope.onWalletSelect = function(wallet) {
    setWallet(wallet, tx);
  };

  $scope.showDescriptionPopup = function(tx) {
    var message = gettextCatalog.getString('Add description');
    var opts = {
      defaultText: tx.description
    };

    popupService.showPrompt(null, message, opts, function(res) {
      if (typeof res != 'undefined') tx.description = res;
      $timeout(function() {
        $scope.$apply();
      });
    });
  };

  function _paymentTimeControl(expirationTime) {
    $scope.paymentExpired = false;
    setExpirationTime();

    countDown = $interval(function() {
      setExpirationTime();
    }, 1000);

    function setExpirationTime() {
      var now = Math.floor(Date.now() / 1000);

      if (now > expirationTime) {
        setExpiredValues();
        return;
      }

      var totalSecs = expirationTime - now;
      var m = Math.floor(totalSecs / 60);
      var s = totalSecs % 60;
      $scope.remainingTimeStr = ('0' + m).slice(-2) + ":" + ('0' + s).slice(-2);
    };

    function setExpiredValues() {
      $scope.paymentExpired = true;
      $scope.remainingTimeStr = gettextCatalog.getString('Expired');
      if (countDown) $interval.cancel(countDown);
      $timeout(function() {
        $scope.$apply();
      });
    };
  };

  /* sets a wallet on the UI, creates a TXPs for that wallet */

  function setWallet(wallet, tx) {

    $scope.wallet = wallet;

    setButtonText(wallet.credentials.m > 1, !!tx.paypro);

    if (tx.paypro)
      _paymentTimeControl(tx.paypro.expires);

    updateTx(tx, wallet, {
      dryRun: true
    }, function(err) {
      $timeout(function() {
        $ionicScrollDelegate.resize();
        $scope.$apply();
      }, 10);

    });

  };

  var setSendError = function(msg) {
    $scope.sendStatus = '';
    $timeout(function() {
      $scope.$apply();
    });
    popupService.showAlert(gettextCatalog.getString('Error at confirm'), bwcError.msg(msg));
  };

  $scope.openPPModal = function() {
    $ionicModal.fromTemplateUrl('views/modals/paypro.html', {
      scope: $scope
    }).then(function(modal) {
      $scope.payproModal = modal;
      $scope.payproModal.show();
    });
  };

  $scope.cancel = function() {
    $scope.payproModal.hide();
  };
  
    function approveBitcoinTx(tx, wallet, onSendStatusChange) {
        ongoingProcess.set('creatingTx', true, onSendStatusChange);
        getTxp(lodash.clone(tx), wallet, false, function(err, txp) {
          ongoingProcess.set('creatingTx', false, onSendStatusChange);
          if (err) return;

          // confirm txs for more that 20usd, if not spending/touchid is enabled
          function confirmTx(cb) {
            if (walletService.isEncrypted(wallet))
              return cb();

            var amountUsd = parseFloat(txFormatService.formatToUSD(txp.amount));
            if (amountUsd <= CONFIRM_LIMIT_USD)
              return cb();

            var message = gettextCatalog.getString('Sending {{amountStr}} from your {{name}} wallet', {
              amountStr: tx.amountStr,
              name: wallet.name
            });
            var okText = gettextCatalog.getString('Confirm');
            var cancelText = gettextCatalog.getString('Cancel');
            popupService.showConfirm(null, message, okText, cancelText, function(ok) {
              return cb(!ok);
            });
          };

          function publishAndSign() {
            if (!wallet.canSign() && !wallet.isPrivKeyExternal()) {
              $log.info('No signing proposal: No private key');

              return walletService.onlyPublish(wallet, txp, function(err) {
                if (err) setSendError(err);
              }, onSendStatusChange);
            }

            walletService.publishAndSign(wallet, txp, function(err, txp) {
              if (err) return setSendError(err);
            }, onSendStatusChange);
          };

          confirmTx(function(nok) {
            if (nok) {
              $scope.sendStatus = '';
              $timeout(function() {
                $scope.$apply();
              });
              return;
            }
            publishAndSign();
          });
        }); 
    };

    function approveCounterpartyTx(tx, wallet, onSendStatusChange) {
        ongoingProcess.set('creatingTx', true, onSendStatusChange);
        getCounterpartyTxp(lodash.clone(tx), wallet, false, function(err, txp) {
          ongoingProcess.set('creatingTx', false, onSendStatusChange);
          if (err) return;

          function confirmTx(cb) {
            if (walletService.isEncrypted(wallet))
              return cb();

            var message = gettextCatalog.getString('Sending {{amountStr}} {{asset}} from your {{name}} wallet pocket: {{sourceAddress}}', {
              amountStr: txFormatService.formatAmountStr(tx.toAmount),
              asset: tx.asset,
              name: wallet.name,
              sourceAddress: tx.sourceAddress
            });
            var okText = gettextCatalog.getString('Confirm');
            var cancelText = gettextCatalog.getString('Cancel');
            popupService.showConfirm(null, message, okText, cancelText, function(ok) {
              return cb(!ok);
            });
          };

          function publishAndSign() {
            if (!wallet.canSign() && !wallet.isPrivKeyExternal()) {
              $log.info('No signing proposal: No private key');

              return walletService.onlyPublish(wallet, txp, function(err) {
                if (err) setSendError(err);
              }, onSendStatusChange);
            }

            walletService.publishAndSign(wallet, txp, function(err, txp) {
              if (err) return setSendError(err);
            }, onSendStatusChange);
          };

          confirmTx(function(nok) {
            if (nok) {
              $scope.sendStatus = '';
              $timeout(function() {
                $scope.$apply();
              });
              return;
            }
            publishAndSign();
          });
        }); 
    };

  $scope.approve = function(tx, wallet, onSendStatusChange) {

    if (!tx || !wallet) return;

    if ($scope.paymentExpired) {
      popupService.showAlert(null, gettextCatalog.getString('This bitcoin payment request has expired.'));
      $scope.sendStatus = '';
      $timeout(function() {
        $scope.$apply();
      });
      return;
    }
    
    if(tx.asset == 'BTC'){
        return approveBitcoinTx(tx, wallet, onSendStatusChange);
    }
    else{
        return approveCounterpartyTx(tx, wallet, onSendStatusChange);
    }


  };

  function statusChangeHandler(processName, showName, isOn) {
    $log.debug('statusChangeHandler: ', processName, showName, isOn);
    if (
      (
        processName === 'broadcastingTx' ||
        ((processName === 'signingTx') && $scope.wallet.m > 1) ||
        (processName == 'sendingTx' && !$scope.wallet.canSign() && !$scope.wallet.isPrivKeyExternal())
      ) && !isOn) {
      $scope.sendStatus = 'success';
      $timeout(function() {
        $scope.$digest();
      }, 100);
    } else if (showName) {
      $scope.sendStatus = showName;
    }
  };

  $scope.statusChangeHandler = statusChangeHandler;

  $scope.onSuccessConfirm = function() {
    $scope.sendStatus = '';
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      historyRoot: true
    });
    $state.go('tabs.send').then(function() {
      $ionicHistory.clearHistory();
      $state.transitionTo('tabs.home');
    });
  };

  $scope.chooseFeeLevel = function(tx, wallet) {

    var scope = $rootScope.$new(true);
    scope.network = tx.network;
    scope.feeLevel = tx.feeLevel;
    scope.noSave = true;

    $ionicModal.fromTemplateUrl('views/modals/chooseFeeLevel.html', {
      scope: scope,
    }).then(function(modal) {
      scope.chooseFeeLevelModal = modal;
      scope.openModal();
    });
    scope.openModal = function() {
      scope.chooseFeeLevelModal.show();
    };

    scope.hideModal = function(customFeeLevel) {
      scope.chooseFeeLevelModal.hide();
      $log.debug('Custom fee level choosen:' + customFeeLevel + ' was:' + tx.feeLevel);
      if (tx.feeLevel == customFeeLevel)
        return;

      tx.feeLevel = customFeeLevel;
      updateTx(tx, wallet, {
        clearCache: true,
        dryRun: true,
      }, function() {
      });
    };
  };
});
