'use strict';

angular.module('copayApp.controllers').controller('issuanceController',
  function($scope, $rootScope, $timeout, $window, $stateParams, go, notification, lodash, ongoingProcess, profileService, walletService, addressService, bvamService, gettext, gettextCatalog, bwcError, configService, fingerprintService, txStatus) {

    var self = this;
    var checkingAssetAvailabilityTimeout = null;

    $scope.toggleIssueAdditionalChange = function() {
      $scope.issueAdditional = !$scope.issueAdditional;
      console.log('toggleIssueAdditionalChange '+$scope.issueAdditional);
    }

    $scope.toggleDivisibleChange = function() {
      $scope.divisible = !$scope.divisible;
      console.log('toggleDivisibleChange '+$scope.divisible);
    }

    $scope.checkAssetExists = function() {
      var assetModel = this.issuanceForm.asset
      if (assetModel.$modelValue == null) {
        assetModel.$setViewValue(self.newRandomAssetName());
        assetModel.$render();
      }
    }
    
    $scope.checkAssetAvailability = function() {
      if (isNamedAsset(''+$scope.asset)) {
        if (checkingAssetAvailabilityTimeout) {
          $timeout.cancel(checkingAssetAvailabilityTimeout);
          checkingAssetAvailabilityTimeout = null;
        }

        // console.log('begin wait...');
        checkingAssetAvailabilityTimeout = $timeout(function() {
          // console.log('begin checking asset availability...');
          $scope.checkingAssetAvailability = true;
          $scope.assetIsAvailable = true;

          (function(assetToCheck) {
            profileService.focusedCounterpartyClient.getBvamInfo([assetToCheck], function(err, bvamInfoArray) {
              $scope.checkingAssetAvailability = false;
              // console.log('end checking asset availability for '+assetToCheck+'... bvamInfoArray:', bvamInfoArray);

              if (assetToCheck != $scope.asset) {
                // checked wrong asset
                console.log('checked wrong asset...');
                $scope.$digest();
                return;
              }

              if (err) {
                console.error(err);
                $scope.assetIsAvailable = false;
                $scope.$digest();
                return;
              }

              // handle availability check
              $scope.assetIsAvailable = true;
              if (bvamInfoArray.length > 0 && bvamInfoArray[0].asset == assetToCheck) {
                $scope.assetIsAvailable = false;
              }
              $scope.$digest();
              
            });
          })($scope.asset);

        }, 250);
      }

    }

    this.init = function() {
      self.resetForm();
      var token = $stateParams.token == null ? null : $stateParams.token;
      if (token) {
        bvamService.getBvamCache(token, function(err, bvamData) {
          $scope.existingBvamData = bvamData;
          if (bvamData) {
            setExistingIssuanceToken(token);
            self.populateFormWithExistingBvamData(bvamData);
          } else {
            // token Bvam not found
            self.populateFormForNewToken();
          }
        });
      } else {
        self.populateFormForNewToken();
      }
    }

    function applyError(err) {
      self.error = err;
      var el = document.getElementById('IssuanceContent');
      if (el) {
        console.log('el.scrollTop', el.scrollTop);
        el.scrollTop = 0;
      }
      return
    }

    $scope.removeImage = function() {
      $scope.primaryImage = null;
    }

    $scope.clearExpirationDate = function() {
      $scope.expirationDate = null;
    }

    function setExistingIssuanceToken(token) {
      $scope.existingIssuanceToken = lodash.clone(token);
      return $scope.existingIssuanceToken;
    }
    function clearExistingIssuanceToken(token) {
      $scope.existingIssuanceToken = null;
    }


    this.submitForm = function(form) {
      if (form && form.$invalid) {
        return applyError(gettext('Please enter the required fields'));
      }

      console.log('$scope.primaryImage', $scope.primaryImage);
      console.log('$scope.fileOne', $scope.fileOne);

      var SATOSHI = 100000000;

      var bvamData = {};

      var amount;
      if ($scope.existingIssuanceToken && !$scope.issueAdditional) {
        amount = 0;
      } else {
        amount = Math.round(form.amount.$modelValue * SATOSHI);
      }

      var divisible;
      if ($scope.existingIssuanceToken && $scope.existingBvamData) {
        // divisible can't change
        divisible = $scope.existingBvamData.assetInfo.divisible
      } else {
        divisible = $scope.divisible
      }


      if ($scope.existingIssuanceToken) {
        // asset can't change
        bvamData.asset = $scope.existingIssuanceToken;
      } else if (form.asset.$modelValue != null && form.asset.$modelValue.length > 0) {
        bvamData.asset = form.asset.$modelValue;
      }

      if (form.name.$modelValue != null && form.name.$modelValue.length > 0) {
        bvamData.name = form.name.$modelValue;
      }
      if (form.shortName.$modelValue != null && form.shortName.$modelValue.length > 0) {
        bvamData.short_name = form.shortName.$modelValue;
      }
      if (form.description.$modelValue != null && form.description.$modelValue.length > 0) {
        bvamData.description = form.description.$modelValue;
      }
      if (form.website.$modelValue != null && form.website.$modelValue.length > 0) {
        bvamData.website = form.website.$modelValue;
      }
      if ($scope.expirationDate != null) {
        bvamData.expiration_date = $scope.expirationDate.toISOString();
      }
      if (form.termsAndConditions.$modelValue != null && form.termsAndConditions.$modelValue.length > 0) {
        bvamData.terms_and_conditions = form.termsAndConditions.$modelValue;
      }

      var anyOwnerInfo = false;
      bvamData.owner = {};
      if (form.fullName.$modelValue != null && form.fullName.$modelValue.length > 0) {
        bvamData.owner.full_name = form.fullName.$modelValue;
        anyOwnerInfo = true;
      }
      if (form.supportEmail.$modelValue != null && form.supportEmail.$modelValue.length > 0) {
        bvamData.owner.support_email = form.supportEmail.$modelValue;
        anyOwnerInfo = true;
      }
      if (form.title.$modelValue != null && form.title.$modelValue.length > 0) {
        bvamData.owner.title = form.title.$modelValue;
        anyOwnerInfo = true;
      }
      if (form.organization.$modelValue != null && form.organization.$modelValue.length > 0) {
        bvamData.owner.organization = form.organization.$modelValue;
        anyOwnerInfo = true;
      }
      if (form.owner_website.$modelValue != null && form.owner_website.$modelValue.length > 0) {
        bvamData.owner.website = form.owner_website.$modelValue;
        anyOwnerInfo = true;
      }
      if (form.address.$modelValue != null && form.address.$modelValue.length > 0) {
        bvamData.owner.address = form.address.$modelValue;
        anyOwnerInfo = true;
      }
      if (form.phone.$modelValue != null && form.phone.$modelValue.length > 0) {
        bvamData.owner.phone = form.phone.$modelValue;
        anyOwnerInfo = true;
      }
      if (!anyOwnerInfo) {
        delete bvamData.owner;
      }

      // validate and add the image
      var imageEl = document.getElementById('UploadedImagePreview')
      if (imageEl != null) {
        var imageSize = getImageSize($scope.primaryImage.filetype, imageEl)
        if (imageSize instanceof Error) {
          return applyError(imageSize.message);
        }

        // "pattern": "^data:(image/gif|image/png|image/jpeg|image/svg\\+xml);base64,[a-zA-Z0-9+/=]+",
        bvamData.images = [{
          size: imageSize,
          data: "data:"+$scope.primaryImage.filetype+";base64,"+$scope.primaryImage.base64
        }];
      }


      console.log('amount='+amount+' divisible='+divisible+' bvamData', bvamData);
      self._handleBvamAndPushTransaction(bvamData, amount, divisible);
    }

    $scope.$watch('asset', checkNamedAssetStatus);
    function checkNamedAssetStatus() {
      $scope.isNamedAsset = isNamedAsset(''+$scope.asset);
      if ($scope.isNamedAsset) {
        $scope.hasXCP = false;
        lodash.each($scope.index.tokenBalances, function(token) {
          if(token.tokenName == 'XCP' && token.quantitySat >= 50000000) {
            $scope.hasXCP = true;
          }
        });
        console.log('$scope.index.tokenBalances', $scope.index.tokenBalances);
      }
    }
    function isNamedAsset(assetId) {
      if (assetId.substr(0,1) == 'A') { return false; }
      if (/^[A-Z]+$/.test(assetId) && assetId.length >= 4) { return true; }
      return false;
    }
    function getImageSize(filetype, imageEl) {
      switch  (filetype) {
        case 'image/gif':
        case 'image/png':
        case 'image/jpeg':
          if (imageEl.naturalWidth == 48 && imageEl.naturalHeight == 48) { return '48x48'; }
          if (imageEl.naturalWidth == 64 && imageEl.naturalHeight == 64) { return '64x64'; }
          if (imageEl.naturalWidth == 128 && imageEl.naturalHeight == 128) { return '128x128'; }
          if (imageEl.naturalWidth == 256 && imageEl.naturalHeight == 256) { return '256x256'; }
          return new Error("GIF, PNG and JPEG images must be sized 48x48, 64x64, 128x128 or 256x256");
        case 'image/svg+xml':
          return 'svg';
      }
      return new Error("Unknown filetype "+filetype);
    }


    // ------------------------------------------------------------------------

    function formatFormInputAsBVAMEntry(bvamFormInput, amount, divisible) {
      var asset = bvamFormInput.asset;
      var bvamEntry = {
        asset: asset,
        assetInfo: {
          divisible: divisible
        },
        metadata: bvamFormInput
      };

      return bvamEntry;
    }

    function FAKE_pushBVAMToProvider(c,b,cb) { 
      console.log('DEBUG FAKE_pushBVAMToProvider');
      return cb(null,{filename:'foohash.json'});
    }

    this._handleBvamAndPushTransaction = function(bvamData, amount, divisible) {
      ongoingProcess.set('processingBvam', true);
      $timeout(function() {

        var pushBvam = configService.ifDebugReturn(FAKE_pushBVAMToProvider, bvamService.pushBVAMToProvider);
        pushBvam(profileService.focusedCounterpartyClient, bvamData, function(err, bvamResponse) {
          if (err) {
            ongoingProcess.set('processingBvam', false);
            return applyError((err && err.message != null) ? err.message : err);
          }

          // now generate the issuance transaction
          // console.log('bvamResponse', bvamResponse);
          var bvamHash = bvamResponse.filename.substr(0, bvamResponse.filename.length - 5);
          console.log('bvamHash', bvamHash);
          ongoingProcess.set('processingBvam', false);

          // push bvam data to temporary cache
          bvamService.cacheTemporaryBVAM(formatFormInputAsBVAMEntry(bvamData, amount, divisible));

          // build the transaction
          self._pushIssuanceTransaction(bvamData.asset, amount, divisible, bvamHash, bvamData, function(err) {
            if (err) {
              return applyError((err && lodash.isObject(err) && err.message != null) ? err.message : err);
            }

            // end and return home
            go.walletHome();
          });

        });

      }, 15);
    };

    this._pushIssuanceTransaction = function(token, amount, divisible, bvamHash, bvamData, cb) {
      if (configService.debug()) {
        console.log('DEBUG SKIPPING _pushIssuanceTransaction');
        return cb(null);
      }

      var client = profileService.focusedClient;
      addressService.getAddress(client.credentials.walletId, false, function(err, addr) {
        if (err) { return cb(self.resolveError(err)); }

        var configWallet = configService.getSync().wallet;
        var walletSettings = configWallet.settings;
        var issuanceDescription = ""+bvamHash;

        var txp = {};
        txp.toAddress = addr;
        txp.outputs = [{
          token:       token,
          amount:      amount,
          description: issuanceDescription,
          divisible:   divisible,
          message:     null
        }];
        txp.message = '';
        txp.payProUrl = null;
        txp.excludeUnconfirmedUtxos = configWallet.spendUnconfirmed ? false : true;
        txp.feeLevel = walletSettings.feeLevel || 'normal';
        txp.counterpartyType = 'issuance';

        ongoingProcess.set('creatingTx', false);

        // ------------------------------
        // create tx
        walletService.createTx(client, txp, function(err, createdTxp) {
          ongoingProcess.set('creatingTx', false);
          if (err) {
            return cb(self.resolveSendError(err));
          }

          // merge in the temporary bvam data
          createdTxp.counterparty.bvam = bvamData;

          $rootScope.$emit('Local/NeedsConfirmation', createdTxp, function(accept) {
            if (accept) {
              self.confirmTx(createdTxp, cb);
            } else {
              // issuance aborted...
              // do nothing
              console.log('issuance aborted');
            }
          });
        });
      });
    };

    var handleEncryptedWallet = function(client, cb) {
      if (!walletService.isEncrypted(client)) return cb();
      $rootScope.$emit('Local/NeedsPassword', false, function(err, password) {
        if (err) return cb(err);
        return cb(walletService.unlock(client, password));
      });
    };

    this.confirmTx = function(txp, cb) {
      var client = profileService.focusedClient;

      fingerprintService.check(client, function(err) {
        if (err) {
          $log.debug(err);
          return cb(err);
        }

        handleEncryptedWallet(client, function(err) {
          if (err) {
            $log.debug(err);
            return cb(err);
          }


          // ------------------------------
          // publish
          ongoingProcess.set('sendingTx', true);
          walletService.publishTx(client, txp, function(err, publishedTxp) {
            ongoingProcess.set('sendingTx', false);
            if (err) {
              return cb(self.resolveSendError(err));
            }


            // ------------------------------
            // sign
            ongoingProcess.set('signingTx', true);
            walletService.signTx(client, publishedTxp, function(err, signedTxp) {
              ongoingProcess.set('signingTx', false);
              walletService.lock(client);
              if (err) {
                $scope.$emit('Local/TxProposalAction');
                return cb(self.resolveSendError(
                  err.message ?
                  err.message :
                  gettext('The transaction was created but could not be completed.'))
                );
              }

              if (signedTxp.status == 'accepted') {
                // ------------------------------
                // broadcast
                ongoingProcess.set('broadcastingTx', true);
                walletService.broadcastTx(client, signedTxp, function(err, broadcastedTxp) {
                  ongoingProcess.set('broadcastingTx', false);
                  if (err) {
                    return cb(self.resolveSendError(err));
                  }
                  self.resetForm();
                  go.walletHome();
                  // var type = txStatus.notify(broadcastedTxp);
                  // $scope.openStatusModal(type, broadcastedTxp, function() {
                  //   $scope.$emit('Local/TxProposalAction', broadcastedTxp.status == 'broadcasted');
                  // });
                });
              } else {
                // not signed...
                self.resetForm();
                go.walletHome();
                // var type = txStatus.notify(signedTxp);
                // $scope.openStatusModal(type, signedTxp, function() {
                //   $scope.$emit('Local/TxProposalAction');
                // });
              }
            });
          });
        });
      });
    };

    // ------------------------------------------------------------------------
    

    this.resolveSendError = function(err) {
      var fc = profileService.focusedClient;
      var prefix =
        fc.credentials.m > 1 ? gettextCatalog.getString('Could not create payment proposal') : gettextCatalog.getString('Could not send payment');
      return new Error(bwcError.msg(err, prefix));
    };

    this.resolveError = function(err) {
      return new Error(err);
    };

    // ------------------------------------------------------------------------

    this.resetForm = function() {
      $scope.isNamedAsset    = false;
      $scope.hasXCP          = false;
      $scope.issueAdditional = false;

      $scope.existingIssuanceToken = null;
      $scope.existingBvamData      = null;

      $scope.checkingAssetAvailability = false;
      $scope.assetIsAvailable          = null;
      checkingAssetAvailabilityTimeout = null;
    }
    
    this.populateFormForNewToken = function() {
      var formValues = {}

      formValues.divisible = true;

      // initial random asset
      formValues.asset = this.newRandomAssetName();

      lodash.forEach(formValues, function(value, name) {
        $scope[name] = value;
      })
    };

    // between "00095428956661682201" and "18446744073709551615"
    this.newRandomAssetName = function() {
      var r = function(low, high) { return Math.floor(Math.random() * (high - low)) + low; }
      var pad5 = function(number) {
        var numString = ""+Math.floor(number);
        return "00000".substring(0, 5 - numString.length) + numString;
      }

      // A + first four digits
      var assetName = "A" + r(96, 18446);

      // next fiften digits
      assetName = assetName + pad5(r(0,99999)) + pad5(r(0,99999)) + pad5(r(0,99999));

      return assetName;
    }

    this.populateFormWithExistingBvamData = function(bvamData) {
      var formValues = {}
      var metadata = bvamData.metadata;

      formValues.asset = bvamData.asset;
      formValues.divisible = bvamData.assetInfo.divisible ? 1 : 0;

      formValues.name               = (metadata.name != null)                                          ? metadata.name                      : null;
      formValues.shortName          = (metadata.short_name != null)                                    ? metadata.short_name                : null;
      formValues.description        = (metadata.description != null)                                   ? metadata.description               : null;
      formValues.website            = (metadata.website != null)                                       ? metadata.website                   : null;
      formValues.expirationDate     = (metadata.expiration_date != null)                               ? new Date(metadata.expiration_date) : null;
      formValues.termsAndConditions = (metadata.terms_and_conditions != null)                          ? metadata.terms_and_conditions      : null;

      formValues.fullName           = (metadata.owner != null && metadata.owner.full_name != null)     ? metadata.owner.full_name           : null;
      formValues.supportEmail       = (metadata.owner != null && metadata.owner.support_email != null) ? metadata.owner.support_email       : null;
      formValues.title              = (metadata.owner != null && metadata.owner.title != null)         ? metadata.owner.title               : null;
      formValues.organization       = (metadata.owner != null && metadata.owner.organization != null)  ? metadata.owner.organization        : null;
      formValues.owner_website      = (metadata.owner != null && metadata.owner.website != null)       ? metadata.owner.website             : null;
      formValues.address            = (metadata.owner != null && metadata.owner.address != null)       ? metadata.owner.address             : null;
      formValues.phone              = (metadata.owner != null && metadata.owner.phone != null)         ? metadata.owner.phone               : null;

      // image
      if (metadata.images) {
        formValues.primaryImage = parseImage(metadata.images[0]);
      }


      lodash.forEach(formValues, function(value, name) {
        $scope[name] = value;
      })
    }

    function parseImage(imageObj) {
      
      var match = /^data:(.+?);base64,(.+?)$/g.exec(""+imageObj.data);

      var primaryImage = {};
      primaryImage.filetype = match[1];
      primaryImage.base64 = match[2];
      primaryImage.filesize = 3 * Math.ceil(primaryImage.base64.length / 4);

      return primaryImage;
    }

    // ------------------------------------------------------------------------
    this.init();

  }

);
