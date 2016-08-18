'use strict';

angular.module('copayApp.services').factory('counterpartyService', function(bcpwcService, counterpartyUtils, configService, lodash, $timeout) {
  var root = {};
  var counterpartyClient = bcpwcService.getClient();

  var CACHED_CONFIRMATIONS_LENGTH = 6;
  var CP_DUST_SIZE = 5430;
  var OP_RETURN_PLACEHOLDER = '6a3800000000000000000000000000000000000000000000000000000000';

  root.isEnabled = function() {
    return configService.getSync().counterpartyTokens.enabled;
  }

  root.getBalances = function(address, cb) {
    counterpartyClient.getBalances(address, function(err, balanceEntries) {
      var tokenBalances = [];

      if (!err) {
        var entry;
        for (var i = 0; i < balanceEntries.length; i++) {
          entry = balanceEntries[i];
          tokenBalances.push({
            tokenName:   entry.asset,
            quantity:    entry.quantityFloat,
            quantitySat: entry.quantity,
            divisible:   entry.divisible
          });
        }
      }

      console.log('(cb2) balances for address '+address, tokenBalances);
      cb(err, tokenBalances);
    });
  };


  root.applyCounterpartyDataToTxHistory = function(address, txHistory, cb) {
    var txIdsForLookup = [];
    for (var i = 0; i < txHistory.length; i++) {
      var txObject = txHistory[i];
      if (isRecentOrUnvalidatedCounterpartyTransaction(txObject)) {
        txIdsForLookup.push(txObject.txid)
      }
    }

    // lookup all txids
    console.log('applyCounterpartyDataToTxHistory address='+address+' txHistory', txHistory, 'txIdsForLookup:', txIdsForLookup);
    counterpartyClient.getTransactions(address, txIdsForLookup, function(err, cpTransactions) {
      console.log('applyCounterpartyDataToTxHistory err:', err);
      console.log('applyCounterpartyDataToTxHistory cpTransactions:', cpTransactions);
      var cpTxHistory = applyCounterpartyTransactionsToTXHistory(cpTransactions, txHistory)
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
    console.log('buildTrialTokenSendProposalScripts',txp);

    var newTxp = lodash.assign({}, txp);

    var oldOutput = txp.outputs[0];
    var destinationAddress = oldOutput.toAddress;

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

    return newTxp;
  }

  root.recreateRealTokenSendProposal = function(client, originalTxp, trialTxp, trialCreatedTxp, cb) {
    console.log('recreateRealTokenSendProposal originalTxp=', originalTxp);
    console.log('recreateRealTokenSendProposal trialCreatedTxp=', trialCreatedTxp);

    var newTxp = lodash.assign({}, trialTxp);

    if (trialCreatedTxp.outputs[1] != null && trialCreatedTxp.outputs[1].amount === 0) {
      var oldOutput   = originalTxp.outputs[0];
      var token       = oldOutput.token;
      var quantitySat = oldOutput.amount;

      // build the real OP_RETURN script
      console.log('recreateRealTokenSendProposal '+quantitySat+' '+token+' '+trialCreatedTxp.inputs[0].txid+'');
      newTxp.outputs[1].script = counterpartyUtils.createSendScriptHex(token, quantitySat, trialCreatedTxp.inputs[0].txid);
      console.log('recreateRealTokenSendProposal script is '+newTxp.outputs[1].script+'');

      // for realz
      newTxp.dryRun = false;

      // use the trial inputs for the counterparty obfuscation key
      newTxp.inputs = lodash.clone(trialCreatedTxp.inputs);

      // now submit the proposal to the server with the correct script for final creation
      console.log('creating final - submitting newTxp:', newTxp);
      console.log('[counterpartyService] client.createTxProposal newTxp.noShuffleOutputs', newTxp.noShuffleOutputs);
      client.createTxProposal(newTxp, function(err, finalCreatedTxp) {
        if (err) return cb(err);

        // change the recipientCount back to 1
        if (finalCreatedTxp.recipientCount == 2) {
          finalCreatedTxp.recipientCount = 1;
        }

        console.log('recreateRealTokenSendProposal finalCreatedTxp=', finalCreatedTxp);
        cb(null, finalCreatedTxp);
      });
    }
  }
 
  // ------------------------------------------------------------------------
  
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

  function applyCounterpartyTransactionsToTXHistory(cpTransactions, txHistory) {
    var cpTransactionsMap = lodash.indexBy(cpTransactions, function(cpTx) {
      return cpTx.event;
    });

    var cpTxHistory = [];
    for (var i = 0; i < txHistory.length; i++) {
      var txEntry = txHistory[i];
      cpTxHistory.push(applyCounterpartyTransaction(cpTransactionsMap[txEntry.txid], txEntry));
    }

    return cpTxHistory;
  }

  function applyCounterpartyTransaction(cpTransaction, txEntry) {
    console.log('applyCounterpartyTransaction txid:'+txEntry.txid+' cpTransaction:', cpTransaction);
    var cpData = txEntry.counterparty || {};
    cpData.validatedConfirmations = txEntry.confirmations;

    // set to false by default if not set yet
    cpData.isCounterparty = null;
    if (txEntry.isCounterparty != null && txEntry.counterparty.isCounterparty != null) {
      cpData.isCounterparty = txEntry.counterparty.isCounterparty;
    }

    if (cpTransaction != null) {
      // found a counterparty transaction - merge it in
      cpData.isCounterparty = true;
      lodash.assign(cpData, cpTransaction);
    } else {
      // did not find this counterparty transaction
      if (isRecentOrUnvalidatedCounterpartyTransaction(txEntry)) {
        cpData.isCounterparty = false;        
      }
    }

    txEntry.counterparty = cpData;
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

// counterparty
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

*/