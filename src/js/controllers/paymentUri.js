'use strict';
angular.module('copayApp.controllers').controller('paymentUriController',
  function($rootScope, $scope, $stateParams, $location, $timeout, profileService, configService, lodash, bitcore, go, bvamService) {
    function strip(number) {
      return (parseFloat(number.toPrecision(12)));
    };
    
  function delimitNumber(n) {
    return (n + "").replace(/\b(\d+)((\.\d+)*)\b/g, function(a, b, c) {
      return (b.charAt(0) > 0 && !(c || ".").lastIndexOf(".") ? b.replace(/(\d)(?=(\d{3})+$)/g, "$1,") : b) + c;
    });
  };
  
  var self = this;
  self.bvamData = {};
  self.tokens = [];  
    
    // Build bitcoinURI with querystring
    this.init = function() {
      var query = [];
      this.origURI = $stateParams.url;
      this.isCounterparty = $stateParams.url.includes('counterparty:');
      this.bitcoinURI = $stateParams.url.replace('counterparty:', 'bitcoin:');
      var URI = bitcore.URI;
      
      var extraParams = [];
      if (this.isCounterparty) {
          extraParams.push('asset');
      }
      var isUriValid = URI.isValid(this.bitcoinURI, extraParams);
      if (!isUriValid) {
        this.error = true;
        return;
      }
      var uri = new URI(this.bitcoinURI, extraParams);

      if (uri && uri.address) {
        var config = configService.getSync().wallet.settings;
        var unitToSatoshi = config.unitToSatoshi;
        var satToUnit = 1 / unitToSatoshi;
        var unitName = config.unitName;
        
        //counterparty URI support
        if (uri.extras.asset && uri.extras.asset != 'BTC') {
            self.tokens.push(uri.extras.asset);
            self.loadBvam(function(err, bvamData) {
              if (err) { return $log.error(err); }
              self.bvamData = bvamData;
            });
            var listBvam = self.bvamData[uri.extras.asset] || {};
            uri.extras.asset = listBvam.asset || uri.extras.asset;
        }        

        if (uri.amount) {
          if (!uri.extras.asset || uri.extras.asset == 'BTC') {
            uri.amount = delimitNumber(strip(uri.amount * satToUnit)) + ' ' + unitName;
          }
          else {
              uri.amount = delimitNumber(uri.amount / 100000000) + ' ' + uri.extras.asset;
          }
        }
        
        uri.network = uri.address.network.name;
        this.uri = uri;
      }
    };
    
  self.loadBvam = function(cb) {
    var tokenNames = self.tokens;
    bvamService.getBvamData(profileService.focusedCounterpartyClient, tokenNames, function(err, bvamData) {
      if (err) {
        return cb(err);
      }
      cb(null, bvamData);
    });
  }    

    this.getWallets = function(network) {

      $scope.wallets = [];
      lodash.forEach(profileService.getWallets(network), function(w) {
        var client = profileService.getClient(w.id);
        profileService.isReady(client, function(err) {
          if (err) return;
          $scope.wallets.push(w);
        })
      });
    };

    this.selectWallet = function(wid) {
      var self = this;
      profileService.setAndStoreFocus(wid, function() {});
      go.walletHome();
      $timeout(function() {
        $rootScope.$emit('paymentUri', self.origURI);
      }, 1000);
    };
  });
