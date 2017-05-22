'use strict';

angular.module('copayApp.services').factory('bvamService', function($rootScope, $log, storageService, lodash) {
  var root = {};

  var OLD_CACHE_TIME                           = 7200000; // 2 hours
  var OLD_UNVALIDATED_NUMERIC_ASSET_CACHE_TIME = 1800000; // 30 minutes

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
      $rootScope.$emit('Local/BvamCacheLoaded', lodash.clone(bvamCache));
    }
  });

  root.getBvamCache = function(tokenNames, cb) {
    if (bvamCache) {
      return root.getBvamData(null, tokenNames, cb, false, true);
    }

    $rootScope.$on('Local/BvamCacheLoaded', function(newBvamCache) {
      return root.getBvamData(null, tokenNames, cb, false, true);
    });

    return
  };

  root.getBvamData = function(counterpartyClient, tokenNames, cb, forceRefresh, forceCache) {
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
        if (forceCache || !isExpired(bvamCache[tokenName])) {
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

    if (forceCache) {
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

  root.cacheTemporaryBVAM = function(bvamEntry) {
    console.log('cacheTemporaryBVAM bvamEntry',bvamEntry);
    cacheEntry(bvamEntry.asset, bvamEntry, {temp: true});
    saveCache();

    $rootScope.$emit('Local/RefreshBvam');
  }

  root.pushBVAMToProvider = function(counterpartyClient, bvamData, cb) {
    bvamData.meta = {
      bvam_version: "1.0.0",
      generated_by: "Tokenly Pockets"
    };

    counterpartyClient.addBvamData(bvamData, function(err, bvamResponse) {
      console.log('=BVAM= pushBVAMToProvider bvamResponse=', bvamResponse);
      console.log('=BVAM= pushBVAMToProvider err=', err);

      if (err) { return cb(err); }
      cb(null, bvamResponse);
    });
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
        if (smallSize == 0 || size < smallSize) {
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

  root.buildAllBVAMAttributes = function(bvamToken) {
    // console.log('buildAllBVAMAttributes', bvamToken);
    var formattedEntries = [];
    if (bvamToken == null) { return formattedEntries; }

    _buildBvamDataEntriesRecursively(formattedEntries, bvamToken.metadata, 0)

    return formattedEntries;
  }

  var labelBlacklistMap = {
    asset:       true,
    description: true,
    website:     true,
    images:      true,
    meta:        true,
  };

  function _buildBvamDataEntriesRecursively(formattedEntries, object, depth) {
    lodash.forEach(object, function(val, key) {
      if (labelBlacklistMap[key] != null) { return; }

      if (lodash.isObject(val)) {
        // recurse
        if (lodash.isNumber(key)) {
          // formattedEntries.push({
          //   isHeader: true,
          //   label: "Entry "+(key + 1),
          //   depth: depth,
          // });
        } else {
          formattedEntries.push({
            isHeader: true,
            label: labelify(key),
            depth: depth,
          });
        }

        _buildBvamDataEntriesRecursively(formattedEntries, val, depth+1)
      } else {
        var entry = {
          name: key,
          depth: depth,
          isHeader: false,
          label: labelify(key),
          value: val
        }
        formattedEntries.push(entry);
      }
    });
  }

  function labelify(rawKey) {
    var words = (''+rawKey).split('_').join(' ');
    var label = words
      .replace(/^([a-z\u00E0-\u00FC])|\s+([a-z\u00E0-\u00FC])/g, function ($1) {
        return $1.toUpperCase()
      })

    return label;
  }

  // ------------------------------------------------------------------------
  

  function isExpired(cacheEntry) {
    console.log('=BVAM= cacheEntry.time', cacheEntry.time);

    var oldCacheTime = OLD_CACHE_TIME;
    var bvamEntry = cacheEntry.data;
    var isTemp = (bvamEntry.meta && bvamEntry.meta.temp);
    if (!isTemp && !bvamEntry.validated && bvamEntry.asset.substr(0,1) == 'A') {
      oldCacheTime = OLD_UNVALIDATED_NUMERIC_ASSET_CACHE_TIME;
    }

    if (Date.now() - cacheEntry.time >= oldCacheTime) {
      return true;
    }


    return false;
  }
  
  function cacheEntry(asset, bvamEntry, meta) {
    if (meta == null) { meta = {}; }
    bvamCache[asset] = {
      time: Date.now(),
      data: bvamEntry,
      meta: meta,
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


