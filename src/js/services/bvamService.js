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
        bvamResultsMap[assetName] = processBvamDataForDisplay(bvamEntry);

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

    if (bvamEntry.metadata.images) {
      var smallSize=0, largeSize=0;
      for (var i = 0; i < bvamEntry.metadata.images.length; i++) {
        var imageEntry = bvamEntry.metadata.images[i]
        if (imageEntry.size == 'svg') {
          bvamEntry.smallImage = imageEntry.data;
          bvamEntry.largeImage = imageEntry.data;
          break;
        }
        var size = 0;
        switch (imageEntry.size) {
          case '48x48':   size=48;  break;
          case '64x64':   size=64;  break;
          case '128x128': size=128; break;
          case '256x256': size=256; break;
        }
        if (size == 48) {
          bvamEntry.smallImage = imageEntry.data;
        }

        if (size > largeSize) {
          bvamEntry.largeImage = imageEntry.data;
          largeSize = size;
        }
      }
    }

    // resolve the names
    bvamEntry.shortName = bvamEntry.metadata.short_name;
    bvamEntry.shortNameWasTruncated = false;
    if (bvamEntry.shortName == null) {
      bvamEntry.shortName = bvamEntry.metadata.name;
      if (bvamEntry.shortName.length > 24) {
        bvamEntry.shortName = bvamEntry.shortName.substr(0, 22);
        bvamEntry.shortNameWasTruncated = true;
      }
    }
    if (bvamEntry.shortName == null) {
      bvamEntry.shortName = bvamEntry.asset;
    }

    bvamEntry.fullName = bvamEntry.metadata.name;

    // resolve the issuer short name
    bvamEntry.ownerSummary = '';
    if (bvamEntry.metadata.owner != null) {
      var bvamOwner = bvamEntry.metadata.owner;
      if (bvamOwner.full_name != null) { bvamEntry.ownerSummary = bvamOwner.full_name; }
      if (bvamOwner.organization != null) { bvamEntry.ownerSummary += (bvamEntry.ownerSummary.length ? ", " : "") + bvamOwner.organization; }
    }

    return bvamEntry;
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


