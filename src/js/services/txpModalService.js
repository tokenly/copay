'use strict';

angular.module('copayApp.services').factory('txpModalService', function(configService, profileService, $rootScope, $ionicModal) {

  var root = {};


  var glideraActive = true; // TODO TODO TODO
  // isGlidera flag is a security measure so glidera status is not
  // only determined by the tx.message




  root.open = function(tx, bvamData, addressLabels) {
    var wallet = tx.wallet ? tx.wallet : profileService.getWallet(tx.walletId);
    var config = configService.getSync().wallet;
    var scope = $rootScope.$new(true);
    scope.bvamData = bvamData;
    scope.addressLabels = addressLabels;
    scope.tx = tx;
    if (!scope.tx.toAddress) scope.tx.toAddress = tx.outputs[0].toAddress;
    scope.wallet = wallet;
    scope.copayers = wallet ? wallet.copayers : null;
    scope.isGlidera = glideraActive;
    scope.currentSpendUnconfirmed = config.spendUnconfirmed;
    // scope.tx.hasMultiplesOutputs = true;  // Uncomment to test multiple outputs

    scope.numberWithCommas = function(x) {
        if(typeof x == 'undefined'){
            return null;
        }
        x = parseFloat(x);
        var parts = x.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        var str = parts.join(".");
        return str;
    };
    

    $ionicModal.fromTemplateUrl('views/modals/txp-details.html', {
      scope: scope
    }).then(function(modal) {
      scope.txpDetailsModal = modal;
      scope.txpDetailsModal.show();
    });
  };
  

  return root;
});
