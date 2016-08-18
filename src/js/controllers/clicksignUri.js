'use strict';
angular.module('copayApp.controllers').controller('clicksignUriController',
  function($rootScope, $scope, $stateParams, $location, $timeout, profileService, configService, lodash, signService, go, bitcore) {

	var fc = profileService.focusedClient;
	this.fc = fc;
	this.lodash = lodash;
	this.$scope = $scope;
	var walletId = fc.credentials.walletId;
	var config = configService.getSync();
	var addresses = [];
	var formScope = false;
	
	config.aliasFor = config.aliasFor || {};
	$scope.alias = config.aliasFor[walletId] || fc.credentials.walletName;

    this.init = function() {
      var query = [];
      this.clicksignURI = $stateParams.url;
      var uri = this.parseURI(this.clicksignURI);
      console.log('testing click to sign..');
      if(!uri) {
		  console.log('Invalid click-to-sign URI');
		  this.error = true;
		  return;
	  }
	  if(typeof uri.message == 'undefined' || uri.message == '') {
		  console.log('Message to sign is required');
		  this.error = true;
		  return;
	  }
	  if(typeof uri.callback == 'undefined' || uri.callback == '') {
		  console.log('Callback URL is required');
		  this.error = true;
		  return;
	  }	  
	  $scope.sign_message = uri.message;
	  $scope.callback_label = null;
	  if(typeof uri.label != 'undefined') {
	     $scope.callback_label = uri.label;
	  }
	  $scope.callback = uri.callback;
    };

    this.getWallets = function(network) {
      return profileService.getWallets(network);
    };
    
    this.parseURI = function(uri) {
		var split = uri.split(':');
		if(split.length == 2){
			var querystring = split[1].split('?');
			if(querystring[0] == 'sign' && querystring.length == 2){
				var query = this.parseQueryString('?' + querystring[1]);
				return query;
			}
		}
		return false;
	};
	
	this.parseQueryString = function (qstr) {
        var query = {};
        var a = qstr.substr(1).split('&');
        for (var i = 0; i < a.length; i++) {
            var b = a[i].split('=');
            query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
        }
        return query;
    };
    
    this.setFormScope = function (form) {
		console.log(form);
		var addresses = [];
		var lodash = this.lodash;
		fc.getMainAddresses({
			doNotVerify: true
		}, function(err, x) {
			if (x.length > 0) {
				lodash.each(x, function(a) {
					addresses.push(a);
				});
			} else {
				console.log('* No addresses.');
			}
			addresses = addresses.reverse();
			console.log(addresses);
		});	  		
		this.addresses = addresses;
		this.$scope.addresses = addresses;
		this.formScope = form;
	};
	
	$scope.sign = function(index, message) {
		var toSign = message;
		var address = this.addresses[index];
		var did_sign = false;
		signService.deriveKeyAndSign(address, fc, toSign, function(signed) {
			$scope.signature = signed;
			did_sign = signed;
		});
		if (did_sign) {
			var callback = this.callback;
			var encode_sig = encodeURIComponent(did_sign);
			var has_query = false;
			if (callback.split('?').length > 1) {
				has_query = true;
			}
			if (has_query) {
				callback = callback + '&signature=' + encode_sig;
			}
			else {
				callback = callback + '?signature=' + encode_sig;
			}
			//redirect them to defined URL
			window.location.href = callback;
		}
	};	
	
	this.closeWindow = function() {
		window.close();
	}
  });
