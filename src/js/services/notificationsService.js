'use strict';
angular.module('copayApp.services')
  .factory('notificationService', function profileServiceFactory($filter, lodash, configService, gettext, notification) {

    var root = {};

    var groupingTime = 5000;
    var lastNotificationOnWallet = {};

    root.getLast = function(walletId) {
      var last = lastNotificationOnWallet[walletId];
      if (!last) return null;

      return Date.now() - last.ts < groupingTime ? last : null;
    };

    root.storeLast = function(notificationData, walletId) {

      if (notificationData.type == 'NewAddress')
        return;

      lastNotificationOnWallet[walletId] = {
        creatorId: notificationData.creatorId,
        type: notificationData.type,
        ts: Date.now(),
      };
    };

    root.shouldSkip = function(notificationData, last) {
      if (!last) return false;

      // rules...
      if (last.type === 'NewTxProposal' &&
        notificationData.type === 'TxProposalAcceptedBy')
        return true;

      if (last.type === 'TxProposalFinallyAccepted' &&
        notificationData.type === 'NewOutgoingTx')
        return true;

      if (last.type === 'TxProposalRejectedBy' &&
        notificationData.type === 'TxProposalFinallyRejected')
        return true;

      return false;
    };


    root.newBWCNotification = function(notificationData, walletId, walletName, focusedClient) {
      var last = root.getLast(walletId);
      root.storeLast(notificationData, walletId);

      if (root.shouldSkip(notificationData, last))
        return;

      var config = configService.getSync();
      config.colorFor = config.colorFor || {};
      var color = config.colorFor[walletId] || '#4A90E2';
      var name = config.aliasFor[walletId] || walletName;

      switch (notificationData.type) {
        case 'NewTxProposal':
          notification.new(gettext('New Payment Proposal'),
            name, {
              color: color
            });
          break;
        case 'TxProposalAcceptedBy':
          notification.success(gettext('Payment Proposal Signed by Copayer'),
            name, {
              color: color
            });
          break;
        case 'TxProposalRejectedBy':
          notification.error(gettext('Payment Proposal Rejected by Copayer'),
            name, {
              color: color
            });
          break;
        case 'TxProposalFinallyRejected':
          notification.error(gettext('Payment Proposal Rejected'),
            name, {
              color: color
            });
          break;
        case 'NewOutgoingTx':
          notification.sent(gettext('Payment Sent'),
            name, {
              color: color
            });
          break;
        case 'NewIncomingTx':
            //check if this address belongs to us
            var is_ours = false;
            var tx_history = false;
            if (focusedClient) {
                focusedClient.getTxHistory({includeExtendedInfo: true}, function(err, txs){
                    tx_history = txs;
                });
            }
            setTimeout(function(){
                if (tx_history) {
                    for (var tx in tx_history) {
                        tx = tx_history[tx];
                        if (tx.txid == notificationData.data.txid && tx.inputs[0].address == notificationData.data.address) {
                            is_ours = true;
                        }
                    }
                }
                if (is_ours == true) {
                    console.log('skipping notification');
                    return; //skip notification
                }
                notification.funds(gettext('Funds received'),
                    name, {
                      color: color
                });
            }, 800);
          break;
        case 'ScanFinished':
          notification.success(gettext('Scan Finished'),
            name, {
              color: color
            });
          break;

        case 'NewCopayer':
          // No UX notification
          break;
        case 'BalanceUpdated':
          // No UX notification
          break;
      }
    };

    return root;
  });
