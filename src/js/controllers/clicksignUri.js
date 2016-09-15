'use strict';
angular.module('copayApp.controllers').controller('clicksignUriController',
  function($rootScope, $scope, $stateParams, $location, $timeout, profileService, configService, lodash, signService, go, bitcore, $http, platformInfo) {
    //setup variables
	var fc = profileService.focusedClient;
	var walletId = fc.credentials.walletId;
	var config = configService.getSync();
	var formScope = false;
	
	config.aliasFor = config.aliasFor || {};
	$scope.alias = config.aliasFor[walletId] || fc.credentials.walletName;
    
    //run ng-init to assign page vars
    this.init = function() {
      window.focus();
      var query = [];
      this.clicksignURI = $stateParams.url;
      var uri = this.parseURI(this.clicksignURI);
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
    
    //load list of wallets
    this.getWallets = function(network) {
      return profileService.getWallets(network);
    };
    
    //load in list of wallet addresses
    var addresses = [];
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
        $scope.addresses = addresses;
        $scope.keySelector = addresses[0];
    });	     

    
    //set the form scope on init
    this.setFormScope = function (form) {
		this.formScope = form;
	};
	
    
    //perform the signature creation and callback
	$scope.sign = function(address, message) {
		var toSign = message;
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
            callback = callback + '&address=' + address.address;
			//post back to defined callback URL
            $http({
               method: 'POST',
               url: callback 
            }).then(function successCallback(response){
                console.log(response);
                
            }, function errorCallback(response){
                console.log('ERROR');
                console.log(response);
            });
            $location.path('/');
            if(platformInfo.isNW){
                var gui = require('nw.gui');
                var win = gui.Window.get();
                win.minimize();
            }
            else{
                window.minimize();
            }
		}
	};	
    
    //get the query parameters out of a URI
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
	
    //close window when they hit cancel
	this.closeWindow = function() {
        $location.path('/');
        if(platformInfo.isNW){
            var gui = require('nw.gui');
            var win = gui.Window.get();
            win.minimize();
        }
        else{
            window.minimize();
        }
        
	}
  });
