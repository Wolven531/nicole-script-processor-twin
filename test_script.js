var $ = jQuery;
var base = location.host;
var possibleContactURLs = [ 'contact-us/' ];
var allURLs = [ ];
var allURLMap = { };
var allVendorMap = { };
var pages = 40;
var numPerPage = 25;
var timeBetweenRequests = 25;
var numErrors = 0;
var finished = false;
var statusTimer = null;
var handleVendorURL = function (url) {
    console.log('Adding website...');
    allVendorMap[url] = true;
//     console.log(url);
//     url = url.replace('http:', 'https:');
//     possibleContactURLs.forEach(function (curr, ind, arr) {
//         var targetUrl = url + '/' + curr;
//         $.ajax(targetUrl,
//             {
//                 success: function(data, textStatus, jqXHR) {
//                     console.log(textStatus);
//                 },
//                 error: function (jqXHR, textStatus, errorThrow) {
//                     numErrors++;
// //                     console.log('err');
// //                     console.log(textStatus);
// //                     console.log(errorThrow);
//                 }
//             });
//     });
};
var handleKnotURL = function (url) {
    $.get(url, null, function(data, textStatus, jqXHR) {
        var websiteLinkSelector = '.vendor-website';
        var page = $(data);
        var websiteLink = page.find(websiteLinkSelector).first();
        var vendorUrl = websiteLink.attr('href');
        handleVendorURL(vendorUrl);
    });
};
var grabPage = function (offset, callback) {
    var target = location.origin + location.pathname + '?offset=' + offset;
    var cardSelector = '.storefront a';
    window.setTimeout(function () {
        if (finished) {
            return;
        }
        $.get(target, function (data, textStatus, jqXHR) {
            var page = $(data);
            var cards = page.find(cardSelector);
            var urls = [];
            cards.each(function(ind, elem){
                var card = $(elem);
                var url = base + card.attr('href');
                urls.push(url);
            });
            console.log('Offset: ' + offset + ' , Added: ' + cards.length);
            callback(cards.length, urls);
        });
    }, offset * timeBetweenRequests);
}

var grabURLs = function () {
    var offset = 0;
    var breakLoop = false;
    for (var pageNum = 0; pageNum < pages && !breakLoop; pageNum++) {
        offset = (pageNum * numPerPage);
        grabPage(offset, function (amountProcessed, urls) {
            if (amountProcessed < 1) {
               breakLoop = true; 
               finished = true;
            }
            allURLs = allURLs.concat(urls);
            urls.forEach(function (curr, ind, arr) {
                allURLMap[curr] = true;
            });
        });
    }
};

var handleVendorMap = function () {
    var _keys = Object.keys(allVendorMap);
    var uniqueURLCount = _keys.length;
    console.log('Finished grabbing vendor URLs, found ' + uniqueURLCount + ' external websites.');
    console.log(JSON.stringify(_keys));
};

grabURLs();
statusTimer = window.setInterval(function () {
    if (finished) {
        window.clearInterval(statusTimer);
        var _keys = Object.keys(allURLMap);
        var uniqueURLCount = _keys.length;
        console.log('Finished grabbing internal URLs, found ' + uniqueURLCount + ' vendors.');
        for (var i = 0; i < uniqueURLCount; i++) {
            var url = _keys[i];
            (function (num, url) {
                window.setTimeout(function () {
                    handleKnotURL(url);
                    if (num === uniqueURLCount - 1) {
                        handleVendorMap();
                    }
                }, num * (timeBetweenRequests * 5));
            })(i, url);// Need IIFE
        }
    }
}, 1000);