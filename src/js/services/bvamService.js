'use strict';

angular.module('copayApp.services').factory('bvamService', function($rootScope, $log, storageService, lodash) {
  var root = {};

  var OLD_CACHE_TIME = 86400000 ; // 24 hours;

  var bvamCache = {}
  var last = 0;

  $rootScope.$on('NewBlock', function() {
    expireOldCaches()
  });

  $rootScope.$on('Local/ClearBvam', function(event) {
    bvamCache = {};
  });

  storageService.getBvamCache(function(err, loadedBvamCache) {
    console.log('=BVAM= loadedBvamCache', loadedBvamCache);
    if (loadedBvamCache) {
      bvamCache = lodash.assign(loadedBvamCache, bvamCache);
    }
  });


  root.getBvamData = function(counterpartyClient, tokenNames, cb, forceRefresh) {
    console.log('=BVAM= getBvamData tokenNames:', tokenNames);

    forceRefresh = !!forceRefresh;
    var isSingleToken = !lodash.isArray(tokenNames)

    if (isSingleToken) {
      tokenNames = [tokenNames];
    }

    var returnResults = function() {
      if (isSingleToken) {
        // return just the single token info
        cb(null, bvamResultsMap[tokenNames[0]]);
        return
      }

      // return map
      cb(null, bvamResultsMap);
    }

    var bvamResultsMap = {};
    var tokenNamesToLookup = [];
    var tokenName;
    for (var i = 0; i < tokenNames.length; i++) {
      tokenName = tokenNames[i];

      if (bvamCache[tokenName] != null && !forceRefresh) {
        if (!isExpired(bvamCache[tokenName])) {
          bvamResultsMap[tokenName] = processBvamDataForDisplay(bvamCache[tokenName].data);
          continue;
        }
      }

      tokenNamesToLookup.push(tokenName);
    }

    // return immediately if nothing else is left to look up
    console.log('=BVAM= tokenNamesToLookup:', tokenNamesToLookup);
    if (tokenNamesToLookup.length == 0) {
      return returnResults();
    }

    counterpartyClient.getBvamInfo(tokenNamesToLookup, function(err, bvamInfoArray) {
      if (err) { return cb(err); }

      console.log('=BVAM= bvamInfoArray:', bvamInfoArray);
      lodash.forEach(bvamInfoArray, function(bvamEntry) {
        // build it
        var assetName = bvamEntry.asset
        bvamResultsMap[assetName] = bvamEntry;

        // cache it
        cacheEntry(assetName, bvamEntry);
      });

      // save the cache
      saveCache();


      return returnResults();
    })
  }

  // ------------------------------------------------------------------------

  function processBvamDataForDisplay(rawBvamEntry) {
    var bvamEntry = lodash.clone(rawBvamEntry);
    if(bvamEntry.length == 0){
        return {};
    }
    if(typeof bvamEntry.assetInfo == 'undefined'){
        var output = bvamEntry;
    }
    else{
        var output = bvamEntry.assetInfo;
    }
    if(bvamEntry.metadata){
        for(var meta in bvamEntry.metadata){
            output[meta] = bvamEntry.metadata[meta];
        }
    }
    if(!output.name){
        output.name = output.asset;
    }

    return output;
  }

  function isExpired(cacheEntry) {
    console.log('=BVAM= cacheEntry.time', cacheEntry.time);
    if (Date.now() - cacheEntry.time >= OLD_CACHE_TIME) {
      return true;
    }

    return false;
  }
  
  function cacheEntry(asset, bvamEntry) {
    bvamCache[asset] = {
      time: Date.now(),
      data: bvamEntry
    }
  }

  function expireOldCaches() {
    var anyExpired = false;
    lodash.forEach(bvamCache, function(cacheEntry, assetName) {
      if (isExpired(cacheEntry)) {
        delete bvamCache[cacheEntry];
        anyExpired = true;
      }
    });

    if (anyExpired) { saveCache(); }
  }

  function saveCache() {
    storageService.storeBvamCache(bvamCache, function(err) {
      if (err) { $log.error('Error saving BVAM cache:' + err); }
    });
  }

  // ------------------------------------------------------------------------
  return root;
});


