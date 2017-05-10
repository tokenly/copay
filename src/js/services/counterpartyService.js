'use strict';

angular.module('copayApp.services').factory('counterpartyService', function(counterpartyUtils, bvamService, configService, lodash, $timeout, $q) {
  var root = {};

  var CACHED_CONFIRMATIONS_LENGTH = 6;
  var CP_DUST_SIZE = 5430;
  var OP_RETURN_SEND_PLACEHOLDER     = '6a3800000000000000000000000000000000000000000000000000000000';
  var OP_RETURN_ISSUANCE_PLACEHOLDER = '6a4e434e54525052545900000000d806c1d5000080321c637440010000000000000000002943727970746f2d526577617264732050726f6772616d20687474703a2f2f6c7462636f696e2e636f6d0000';

  root.isEnabled = function() {
    return configService.getSync().counterpartyTokens.enabled;
  }

  root.getBalances = function(counterpartyClient, address, cb) {
    if (!counterpartyClient) { return cb('counterparty client not found'); }

    counterpartyClient.getBalances(address, function(err, balanceEntries) {
      if (err) return cb(err)

      // var tokenNames = [];
      var tokenBalances = [];
      var entry;
      for (var i = 0; i < balanceEntries.length; i++) {
        entry = balanceEntries[i];
        tokenBalances.push(buildNewTokenBalanceEntry(entry, {
          amountStr: ""+delimitNumber(entry.quantityFloat)
        }));

        // tokenNames.push(entry.asset);
      }

      // debug asset
      if (configService.debug()) {
        tokenBalances.push(buildNewTokenBalanceEntry({asset: 'DEBUGASSET', quantityFloat: 2.1, quantity: 210000000, divisible: true, amountStr: '2.1'}));
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
        newTokenBalance.amountReceivingStr = delimitNumber(newTokenBalance.quantityFloatReceiving);
        newTokenBalance.hasReceivePending = true;
      } else {
        // send
        newTokenBalance.quantityFloatSending += pendingTokenBalance.quantityFloat;
        newTokenBalance.amountSendingStr = delimitNumber(newTokenBalance.quantityFloatSending);
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
        var isIssuance = (txObject.issuer == null) ? false : true;
        var isReceive = isIssuance || (txObject.counterparty.direction == "credit");
        var quantity = txObject.counterparty.quantity;
        var quantityFloat = txObject.counterparty.quantityFloat;
        var asset = txObject.counterparty.asset;
        pendingTokenBalances.push({
          asset: asset,
          quantity: quantity,
          quantityFloat: quantityFloat,
          divisible: txObject.counterparty.divisible,
          isReceive: isReceive,
          amountStr: delimitNumber(quantityFloat),
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
      } else {
        // console.log('=CPTY= treating transaction '+txObject.txid+' with '+(txObject.confirmations)+' confirmations as confirmed');
      }
    }

    // lookup all txids (50 at a time, consecutively)
    // console.log('=CPTY= applyCounterpartyDataToTxHistory address='+address+' txHistory', txHistory, 'txIdsForLookup:', txIdsForLookup);
    console.log('=CPTY= applyCounterpartyDataToTxHistory address='+address+' txIdsForLookup.length:', txIdsForLookup.length);
    var cpTransactionsArray = []
    var txIdsForLookupChunkOffset = 0
    var txIdsForLookupChunks = lodash.chunk(txIdsForLookup, 50)
    var resolveNextChunk = function() {
      var txIdsForLookupChunk = txIdsForLookupChunks[txIdsForLookupChunkOffset];
      // console.log('=CPTY= begin resolveNextChunk '+txIdsForLookupChunkOffset+' begin getTransactions');
      counterpartyClient.getTransactions(address, txIdsForLookupChunk, function(err, cpTransactions) {
        if (err) {
          // console.log('=CPTY= end resolveNextChunk '+txIdsForLookupChunkOffset+' ERROR=', err);
          return cb(err)
        } else {
          // console.log('=CPTY= end resolveNextChunk '+txIdsForLookupChunkOffset+' end getTransactions cpTransactions=', cpTransactions);
          cpTransactionsArray.push(cpTransactions)

          ++txIdsForLookupChunkOffset;
          if (txIdsForLookupChunkOffset >= txIdsForLookupChunks.length) {
            // done
            // console.log('=CPTY= applyCounterpartyDataToTxHistory cpTransactionsArray:', cpTransactionsArray);
            // console.log('=CPTY= applyCounterpartyDataToTxHistory allCPTransactions:', lodash.flatten(cpTransactionsArray));
            var cpTxHistory = applyCounterpartyTransactionsToTXHistory(lodash.flatten(cpTransactionsArray), txHistory, address)
            cb(null, cpTxHistory);
          } else {
            resolveNextChunk()
          }
        }
      })
    }
    resolveNextChunk();
  }

  root.isTokenSendProposal = function(txp) {
    if (txp.outputs != null && txp.outputs[0] != null && txp.outputs[0].token != null && txp.outputs[0].token != 'BTC') {
      return true;
    }

    return false;
  }

  root.tokenProposalType = function(txp) {
    if (txp.counterpartyType != null) { return txp.counterpartyType; }
    if (root.isTokenSendProposal(txp)) { return 'send'; }
    return null;
  }
  
  root.buildTrialTokenSendProposalScripts = function(txp, tokenProposalType) {
    console.log('=CPTY= buildTrialTokenSendProposalScripts tokenProposalType='+tokenProposalType+' txp=',txp);

    var newTxp = lodash.assign({}, txp);
    var SATOSHI = 100000000;

    var oldOutput = txp.outputs[0];

    if (tokenProposalType == 'send') {
      var destinationAddress = oldOutput.toAddress;
      var divisible          = oldOutput.divisible;

      // build the dust send
      var use_dust = CP_DUST_SIZE;
      if (txp.dust_size && txp.dust_size > use_dust) {
          use_dust = txp.dust_size; //custom dust size, but must be greater than default
      }
      var dustSendOutput = {
        amount: use_dust,
        toAddress: destinationAddress,
        message: undefined
      }

      // a fake OP_RETURN for building the script
      var opReturnOutput = {
        amount: 0,
        script: OP_RETURN_SEND_PLACEHOLDER
      }

      newTxp.outputs = [dustSendOutput, opReturnOutput];

      var quantityFloat = divisible ? (oldOutput.amount / SATOSHI) : oldOutput.amount;
      newTxp.counterparty = {
        type:          tokenProposalType,
        token:         oldOutput.token,
        quantity:      oldOutput.amount,
        quantityFloat: quantityFloat,
        amountStr:     ""+delimitNumber(quantityFloat),
        divisible:     divisible,
      };
    } else if (tokenProposalType == 'issuance') {
      // a fake OP_RETURN for building the script
      var opReturnOutput = {
        amount: 0,
        script: OP_RETURN_ISSUANCE_PLACEHOLDER
      }

      newTxp.outputs = [opReturnOutput];

      var divisible     = oldOutput.divisible;
      var quantityFloat = divisible ? (oldOutput.amount / SATOSHI) : oldOutput.amount;
      newTxp.counterparty = {
        type:          tokenProposalType,
        token:         oldOutput.token,
        quantity:      oldOutput.amount,
        description:   oldOutput.description,
        quantityFloat: quantityFloat,
        amountStr:     ""+delimitNumber(quantityFloat),
        divisible:     divisible,
        shortName:     oldOutput.shortName,
      };
    } else {
      // undefined
      console.err('undefined token proposal type: '+tokenProposalType)
    }

    newTxp.validateOutputs = false;
    newTxp.noShuffleOutputs = true;

    // don't save to the server
    newTxp.dryRun = true;

    // save the counterparty data
    newTxp.isCounterparty = true;

    return newTxp;
  }

  root.recreateRealTokenSendProposal = function(client, originalTxp, trialTxp, trialCreatedTxp, cb) {
    console.log('=CPTY= recreateRealTokenSendProposal originalTxp=', originalTxp);
    console.log('=CPTY= recreateRealTokenSendProposal trialCreatedTxp=', trialCreatedTxp);

    var tokenProposalType = root.tokenProposalType(originalTxp);

    var newTxp = lodash.assign({}, trialTxp);

    if (tokenProposalType) {
      var oldOutput   = originalTxp.outputs[0];
      var token       = oldOutput.token;
      var quantitySat = oldOutput.amount;
      var divisible   = oldOutput.divisible;

      // build the real OP_RETURN script
      if (tokenProposalType == 'send') {
        console.log('=CPTY= recreateRealTokenSendProposal '+quantitySat+' '+token+' '+trialCreatedTxp.inputs[0].txid+'');
        newTxp.outputs[1].script = counterpartyUtils.createSendScriptHex(token, quantitySat, trialCreatedTxp.inputs[0].txid);
        console.log('=CPTY= recreateRealTokenSendProposal script is '+newTxp.outputs[1].script+'');
      } else if (tokenProposalType == 'issuance') {
        console.log('=CPTY= recreateRealTokenIssuanceProposal '+quantitySat+' '+token+' '+trialCreatedTxp.inputs[0].txid+'');
        // asset_name, description, amountSatoshis, divisible, utxoId
        var description = oldOutput.description;
        var divisible   = oldOutput.divisible;
        newTxp.outputs[0].script = counterpartyUtils.createIssuanceScriptHex(token, quantitySat, divisible, description, trialCreatedTxp.inputs[0].txid);
        console.log('=CPTY= recreateRealTokenIssuanceProposal script is '+newTxp.outputs[0].script+'');
      }

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
    var cpTransactionsMap = {};
    lodash.each(cpTransactions, function(cpTx) {
      var action = 'unknown';
      if (cpTx.action != null) {
        action = cpTx.action;
      }

      var hash = cpTx.event;
      if (cpTx.mempool === true && cpTx.tx_hash != null) {
        hash = cpTx.tx_hash;
      }

      if (cpTransactionsMap[hash] != null) {
        // already exists - append
        cpTransactionsMap[hash].transactions.push(cpTx);
      } else {
        cpTransactionsMap[hash] = {transactions: [cpTx]};
      }
    });
    console.log('cpTransactionsMap', cpTransactionsMap);

    var cpTxHistory = [];
    var cpTransaction = null;
    for (var i = 0; i < txHistory.length; i++) {
      var txEntry = txHistory[i];
      cpTransaction = (cpTransactionsMap[txEntry.txid] != null) ? mergeCounterpartyTransactions(cpTransactionsMap[txEntry.txid].transactions) : null;
      cpTxHistory.push(applyCounterpartyTransaction(cpTransaction, txEntry, address));
    }

    return cpTxHistory;
  }

  // choose the best one for the wallet history
  function mergeCounterpartyTransactions(cpTransactions) {
    if (cpTransactions.length == 0) {
      return cpTransactions[0];
    }

    var mergedTransaction = null;
    lodash.each(cpTransactions, function(cpTransaction) {
      if (cpTransaction.calling_function != null && cpTransaction.calling_function == 'issuance') {
        mergedTransaction = cpTransaction;
        return;
      }

      if (mergedTransaction == null) {
        mergedTransaction = cpTransaction;
      }
    });

    return mergedTransaction;
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
      cpData.amountStr = delimitNumber(cpData.quantityFloat)

      // apply debit/credit for mempool transactions based on address
      if (cpData.mempool) {
        cpData.direction = cpData.destination == address ? "credit" : "debit"
      }

      // always treate issuances as credits
      if (cpData.action == 'issuance fee') {
        cpData.direction = 'credit';
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

  function delimitNumber(n) {
    return (n + "").replace(/\b(\d+)((\.\d+)*)\b/g, function(a, b, c) {
      return (b.charAt(0) > 0 && !(c || ".").lastIndexOf(".") ? b.replace(/(\d)(?=(\d{3})+$)/g, "$1,") : b) + c;
    });
  };

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

// counterparty (mempool issuance)
{
    "asset": "A96111100000000002",
    "call_date": 0,
    "call_price": 0.0,
    "callable": false,
    "description": "TUWRvRv9pGczUvEAQBHjad1Gua4L",
    "divisible": true,
    "fee_paid": 0,
    "issuer": "1Aq4MVsUzPNQsKmiLL9Fy2pKvfJ9WWkStw",
    "locked": false,
    "quantity": 10000000000,
    "source": "1Aq4MVsUzPNQsKmiLL9Fy2pKvfJ9WWkStw",
    "transfer": false,
    "tx_hash": "43b27159f355647f4d9ab7ffe9f2bc14e455fa4373d4d486e5354ef11feb20e2"
}

*/
