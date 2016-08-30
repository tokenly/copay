/**
 * Created by one on 14/07/16.
 */
'use strict';

angular.module('copayApp.controllers').controller('preferencesVerify',
    function($scope, verifyService) {

        $scope.verify = function() {
            var message = $scope.verifyForm.message.$modelValue;
            var signature = $scope.verifyForm.signature.$modelValue;
            var pubKey = $scope.verifyForm.pubKey.$modelValue;


            verifyService.getMessageVerification(message, signature, pubKey, function(result) {
                $scope.verifyResult = '';
                if(result) {
                    if(result == 'MISSING_PARAMETER') {
                        alert('Please enter all required fields');
                    }
                    else {
                        $scope.verifyResult = 'Signature verified!';
                        $scope.verifyClass = 'text-success';
                        setTimeout(function() {
                            $scope.verifyResult = '';
                            $scope.verifyClass = '';
                        }, 5000);
                    }
                }
                else {
                        $scope.verifyResult = 'Invalid signature';
                        $scope.verifyClass = 'text-danger';
                        setTimeout(function() {
                            $scope.verifyResult = '';
                            $scope.verifyClass = '';
                        }, 5000);
                }
            })
        };

    });

