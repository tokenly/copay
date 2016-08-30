/**
 * Created by one on 14/07/16.
 */
'use strict';

angular.module('copayApp.controllers').controller('preferencesSign',
    function($scope, $timeout, signService, configService, profileService, lodash) {
        var fc = profileService.focusedClient;
        var walletId = fc.credentials.walletId;
        var config = configService.getSync();
        var addresses = [];

        config.aliasFor = config.aliasFor || {};
        $scope.alias = config.aliasFor[walletId] || fc.credentials.walletName;

        $scope.sign = function(address) {
            var toSign = $scope.signForm.message.$modelValue;
            if(toSign.trim() == '') {
                return false;
            }
            signService.deriveKeyAndSign(address, fc, toSign, function(signed) {
                var result = '-----BEGIN BITCOIN SIGNED MESSAGE-----\n' + toSign + '\n';
                result = result + '-----BEGIN BITCOIN SIGNATURE-----\n';
                result = result + 'Version: Bitcoin-qt (1.0)\n';
                console.log(address);
                result = result + 'Address: ' + address.address + '\n\n';
                result = result + signed + '\n';
                result = result + '-----END BITCOIN SIGNATURE-----';
                $scope.signature = result;                
                $scope.$apply();
            })
        };

        $scope.init = function() {

            $scope.externalSource = null;
            fc = profileService.focusedClient;

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

                $scope.addresses = addresses;
                // Set sign address to first address in wallet
                $scope.keySelector = $scope.addresses[0];

                $scope.$apply();
            });
        };
    }
);

