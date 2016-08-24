'use strict';

angular.module('copayApp.services').factory('counterpartyService', function(counterpartyUtils, configService, lodash, $timeout) {
  var root = {};

  var CACHED_CONFIRMATIONS_LENGTH = 6;
  var CP_DUST_SIZE = 5430;
  var OP_RETURN_PLACEHOLDER = '6a3800000000000000000000000000000000000000000000000000000000';

  root.isEnabled = function() {
    return configService.getSync().counterpartyTokens.enabled;
  }

  root.getBalances = function(counterpartyClient, address, cb) {
    if (!counterpartyClient) { return cb('counterparty client not found'); }

    counterpartyClient.getBalances(address, function(err, balanceEntries) {
      if (err) return cb(err)

      var tokenBalances = [];
      var entry;
      for (var i = 0; i < balanceEntries.length; i++) {
        entry = balanceEntries[i];
        tokenBalances.push(buildNewTokenBalanceEntry(entry, {
          amountStr: ""+entry.quantityFloat
        }));
      }

      // console.log('=CPTY= balances for address '+address, tokenBalances);
      cb(null, tokenBalances);
    });
  };

  root.updatePendingTokenBalancesFromHistory = function(tokenBalances, txHistory) {
    var pendingTokenBalances = root.calculatePendingTokenBalances(txHistory);

    console.log('=CPTY= tokenBalances', tokenBalances);
    var tokenBalancesMap = lodash.indexBy(tokenBalances, function(tokenBalance) {
      return tokenBalance.tokenName;
    });

    lodash.forEach(pendingTokenBalances, function(pendingTokenBalance) {
      var tokenName = pendingTokenBalance.asset


      if (tokenBalancesMap[tokenName] == null) {
        console.log('=CPTY= tokenBalancesMap[tokenName] was null for tokenName '+tokenName+'. Creating a blank one.', tokenBalancesMap);
        // this token balance doesn't exist yet - create a new one from the parsed pending balance
        tokenBalancesMap[tokenName] = buildNewTokenBalanceEntry(pendingTokenBalance, {
          quantity: 0,
          quantityFloat: 0,
          amountStr: "0"
        })

      }


      
      var newTokenBalance = tokenBalancesMap[tokenName]
      if (pendingTokenBalance.isReceive) {
        // receive
        newTokenBalance.quantityFloatReceiving += pendingTokenBalance.quantityFloat;
        newTokenBalance.amountReceivingStr = newTokenBalance.quantityFloatReceiving;
        newTokenBalance.hasReceivePending = true;
      } else {
        // send
        newTokenBalance.quantityFloatSending += pendingTokenBalance.quantityFloat;
        newTokenBalance.amountSendingStr = newTokenBalance.quantityFloatSending;
        newTokenBalance.hasSendPending = true;
      }
      tokenBalancesMap[tokenName] = newTokenBalance;

    });

    console.log('=CPTY= tokenBalancesMap', tokenBalancesMap);

    // extract array from tokenBalancesMap
    return lodash.values(lodash.sortBy(tokenBalancesMap, 'tokenName'));
  }

  root.calculatePendingTokenBalances = function(txHistory) {
    if (txHistory == null || txHistory.length == 0) {
      return []
    }

    var pendingTokenBalances = []

    for (var i = 0; i < txHistory.length; i++) {
      var txObject = txHistory[i];
      if (txObject.isCounterparty && txObject.counterparty.mempool) {
        var isReceive = (txObject.counterparty.direction == "credit");
        var quantity = txObject.counterparty.quantity;
        var quantityFloat = txObject.counterparty.quantityFloat;
        var asset = txObject.counterparty.asset;
        pendingTokenBalances.push({
          asset: asset,
          quantity: quantity,
          quantityFloat: quantityFloat,
          divisible: txObject.counterparty.divisible,
          isReceive: isReceive,
          amountStr: quantityFloat,
          btcAmount: txObject.amount
        })
      }
    }

    console.log('=CPTY= pendingTokenBalances: ',pendingTokenBalances);

    return pendingTokenBalances;
  }

  root.applyCounterpartyDataToTxHistory = function(counterpartyClient, address, txHistory, cb) {
    if (!counterpartyClient) { return cb('counterparty client not found'); }

    if (!root.isEnabled()) {
      cb(null, txHistory);
    }

    var txIdsForLookup = [];
    for (var i = 0; i < txHistory.length; i++) {
      var txObject = txHistory[i];
      if (isRecentOrUnvalidatedCounterpartyTransaction(txObject)) {
        txIdsForLookup.push(txObject.txid)
      }
    }

    // lookup all txids
    console.log('=CPTY= applyCounterpartyDataToTxHistory address='+address+' txHistory', txHistory, 'txIdsForLookup:', txIdsForLookup);
    counterpartyClient.getTransactions(address, txIdsForLookup, function(err, cpTransactions) {
      if (err) return cb(err)
      console.log('=CPTY= applyCounterpartyDataToTxHistory cpTransactions:', cpTransactions);
      var cpTxHistory = applyCounterpartyTransactionsToTXHistory(cpTransactions, txHistory, address)
      cb(null, cpTxHistory);
    })

  }



  root.isTokenSendProposal = function(txp, cb) {
    if (txp.outputs != null && txp.outputs[0].token != null) {
      return true;
    }

    return false;
  }

  root.buildTrialTokenSendProposalScripts = function(txp) {
    console.log('=CPTY= buildTrialTokenSendProposalScripts',txp);

    var newTxp = lodash.assign({}, txp);

    var oldOutput = txp.outputs[0];
    var destinationAddress = oldOutput.toAddress;
    var divisible          = oldOutput.divisible;

    // build the dust send
    var dustSendOutput = {
      amount: CP_DUST_SIZE,
      toAddress: destinationAddress,
      message: undefined
    }

    // a fake OP_RETURN for building the script
    var opReturnOutput = {
      amount: 0,
      script: OP_RETURN_PLACEHOLDER
    }

    newTxp.outputs = [dustSendOutput, opReturnOutput];
    newTxp.validateOutputs = false;
    newTxp.noShuffleOutputs = true;

    // don't save to the server
    newTxp.dryRun = true;

    // save the counterparty data
    newTxp.isCounterparty = true;
    var SATOSHI = 100000000;
    var quantityFloat = divisible ? (oldOutput.amount / SATOSHI) : oldOutput.amount;
    newTxp.counterparty = {
      token:         oldOutput.token,
      quantity:      oldOutput.amount,
      quantityFloat: quantityFloat,
      amountStr:     ""+quantityFloat,
      divisible:     divisible,
    };

    return newTxp;
  }

  root.recreateRealTokenSendProposal = function(client, originalTxp, trialTxp, trialCreatedTxp, cb) {
    console.log('=CPTY= recreateRealTokenSendProposal trialCreatedTxp=', trialCreatedTxp);

    var newTxp = lodash.assign({}, trialTxp);

    if (trialCreatedTxp.outputs[1] != null && trialCreatedTxp.outputs[1].amount === 0) {
      var oldOutput   = originalTxp.outputs[0];
      var token       = oldOutput.token;
      var quantitySat = oldOutput.amount;
      var divisible   = oldOutput.divisible;

      // build the real OP_RETURN script
      console.log('=CPTY= recreateRealTokenSendProposal '+quantitySat+' '+token+' '+trialCreatedTxp.inputs[0].txid+'');
      newTxp.outputs[1].script = counterpartyUtils.createSendScriptHex(token, quantitySat, trialCreatedTxp.inputs[0].txid);
      console.log('=CPTY= recreateRealTokenSendProposal script is '+newTxp.outputs[1].script+'');

      // for realz
      newTxp.dryRun = false;

      // use the trial inputs for the counterparty obfuscation key
      newTxp.inputs = lodash.clone(trialCreatedTxp.inputs);

      // now submit the proposal to the server with the correct script for final creation
      console.log('=CPTY= creating final - submitting newTxp:', newTxp);
      client.createTxProposal(newTxp, function(err, finalCreatedTxp) {
        if (err) return cb(err);

        // change the recipientCount back to 1
        if (finalCreatedTxp.recipientCount == 2) {
          finalCreatedTxp.recipientCount = 1;
        }

        // keep the counterparty data
        finalCreatedTxp.isCounterparty = newTxp.isCounterparty
        finalCreatedTxp.counterparty = newTxp.counterparty

        console.log('=CPTY= recreateRealTokenSendProposal finalCreatedTxp=', finalCreatedTxp);
        cb(null, finalCreatedTxp);
      });
    }
  }
 
  // ------------------------------------------------------------------------

  function buildNewTokenBalanceEntry(balanceObject, overrides) {

    var out = {
      tokenName:              balanceObject.asset,
      quantityFloat:          balanceObject.quantityFloat,
      quantitySat:            balanceObject.quantity,
      divisible:              balanceObject.divisible,
      amountStr:              balanceObject.amountStr,

      quantityFloatReceiving: 0,
      amountReceivingStr:     "0",
      hasReceivePending:      false,

      quantityFloatSending:   0,
      amountSendingStr:       "0",
      hasSendPending:         false,
    }

    if (overrides != null) {
      out = lodash.assign(out, overrides);
    }

    return out;

  }
  
  function isRecentOrUnvalidatedCounterpartyTransaction(txObject) {
    if (txObject.counterparty == null) {
      return true;
    }
    if (txObject.counterparty.isCounterparty == null) {
      return true;
    }

    // if counterparty server has validated this with more than 6 confirmations,
    //   treat it as final
    if (txObject.confirmations > CACHED_CONFIRMATIONS_LENGTH && txObject.counterparty.validatedConfirmations > CACHED_CONFIRMATIONS_LENGTH) {
      return false;
    }

    return true;
  }

  function applyCounterpartyTransactionsToTXHistory(cpTransactions, txHistory, address) {
    var cpTransactionsMap = lodash.indexBy(cpTransactions, function(cpTx) {
      if (cpTx.mempool === true && cpTx.tx_hash != null) {
        return cpTx.tx_hash;
      }

      return cpTx.event;
    });

    var cpTxHistory = [];
    for (var i = 0; i < txHistory.length; i++) {
      var txEntry = txHistory[i];
      cpTxHistory.push(applyCounterpartyTransaction(cpTransactionsMap[txEntry.txid], txEntry, address));
    }

    return cpTxHistory;
  }

  function applyCounterpartyTransaction(cpTransaction, txEntry, address) {
    // make a copy of the existing counterparty data
    var cpData = lodash.assign({}, txEntry.counterparty || {});
    cpData.validatedConfirmations = txEntry.confirmations;

    // set to null by default if not set yet
    cpData.isCounterparty = null;
    if (txEntry.counterparty != null && txEntry.counterparty.isCounterparty != null) {
      cpData.isCounterparty = txEntry.counterparty.isCounterparty;
    }

    if (cpTransaction != null) {
      console.log('=CPTY= validated txEntry: '+"\n"+JSON.stringify(txEntry,null,2));

      // found a counterparty transaction - merge it in
      cpData.isCounterparty = true;
      lodash.assign(cpData, cpTransaction);
      console.log('=CPTY= applyCounterpartyTransaction txid:'+txEntry.txid+' cpTransaction:', cpTransaction);

      // sent hasMultiplesOutputs to false
      txEntry.hasMultiplesOutputs = false;

      // fix the amount to be the amounts from the first output
      txEntry.amount = txEntry.outputs[0].amount
      txEntry.amountStr = txEntry.outputs[0].amountStr

      // create a counterparty amout string
      cpData.amountStr = cpData.quantityFloat + " " + cpData.asset

      // apply debit/credit for mempool transactions based on address
      if (cpData.mempool) {
        cpData.direction = cpData.destination == address ? "credit" : "debit"
      }

    } else {
      // did not find this counterparty transaction
      if (isRecentOrUnvalidatedCounterpartyTransaction(txEntry)) {
        console.log('=CPTY= unvalidated txEntry:', txEntry);
        
        cpData.isCounterparty = false;        
        console.log('=CPTY= applyCounterpartyTransaction txid:'+txEntry.txid+' cpData.isCounterparty:', cpData.isCounterparty);
      }
    }

    txEntry.counterparty = cpData;
    txEntry.isCounterparty = cpData.isCounterparty;

    return txEntry;
  }

  // ------------------------------------------------------------------------
  return root;
});


/*

// insight
{
    action: "received",
    alternativeAmountStr: "0.03 USD",
    amount: 5430,
    amountStr: "0.000054 BTC",
    confirmations: 853,
    creatorName: "",
    feeStr: "0.000163 BTC",
    fees: 16329,
    hasUnconfirmedInputs: false,
    message: null,
    outputs: [],
    safeConfirmed: "6+",
    time: 1470866515,
    txid: "278f8bf8b3ecfee1cd6c064c06efed31f2e197e0b6e30ad71f24503aca4acc12"
}

// counterparty (confirmed)
{
    "address": "1Aq4MVsUzPNQsKmiLL9Fy2pKvfJ9WWkStw",
    "asset": "SOUP",
    "block_index": 424615,
    "calling_function": "send",
    "direction": "credit",
    "divisible": true,
    "event": "278f8bf8b3ecfee1cd6c064c06efed31f2e197e0b6e30ad71f24503aca4acc12",
    "quantity": 510000000,
    "quantityFloat": 5.1
}


// counterparty (mempool)
{
    "asset": "BITCRYSTALS",
    "category": "sends",
    "destination": "1AeqgtHedfA2yVXH6GiKLS2JGkfWfgyTC6",
    "divisible": true,
    "quantity": 36772088955,
    "quantityFloat": 367.72088955,
    "source": "1EdBW9ebNqfZtCqEfstLnaAJgGNGmPNniS",
    "timestamp": 1471702974,
    "mempool": true,
    "tx_hash": "f6eeb2364ac0f2f96bb0021980c384d990d0c7b7fb208d4ddc012ca778c89fa2"
}


*/