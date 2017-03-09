'use strict';

var _ = require('lodash');
var async = require('async');
var bodyParser = require('body-parser');
var express = require('express');
var fs = require('fs');
var http = require('http');
var jsdom = require('jsdom');
var moment = require('moment');
var timeout = require('connect-timeout'); //express v4

var fullDateFormat = 'MM/DD/YYYY hh:mm:ss';
var testScript = '';
var dataJSON = '';
var scriptStats;
var router = express();
var server = http.createServer(router);

router.use(timeout('100s'));
router.use('/static/images', express.static(__dirname + '/images'));
router.use(bodyParser.json()); // to support JSON-encoded bodies
router.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
})); // to support URL-encoded bodies
router.use(express.json()); // to support JSON-encoded bodies
router.use(express.urlencoded()); // to support URL-encoded bodies

var haltOnTimedout = function (req, res, next) {
    infoLog('haltOnTimedout called...');
    if (!req.timedout) {
        next();
    }
};

var infoLog = function () {
    var passedArgs = Array.prototype.slice.call(arguments);
    console.log.apply(console, ['Info', moment().format(fullDateFormat)].concat(passedArgs));
}

var debugLog = function () {
    var passedArgs = Array.prototype.slice.call(arguments);
    console.log.apply(console, ['Debug', moment().format(fullDateFormat)].concat(passedArgs));
}

var processSingleUrl = function (url, callback) {
    var responseObj = {};
    responseObj.url = url;
    responseObj.emails = [];
    try {
        jsdom.env(
            url, ['http://code.jquery.com/jquery.js'],
            function (err, window) {
                if (err) {
                    debugLog('There was an error loading a page: ' + JSON.stringify(err));
                    callback(null, responseObj);
                    return;
                }
                var flag = 'mailto:';
                window.$('a[href^="' + flag + '"]').each(function (ind, elem) {
                    var fullHref = window.$(elem).attr('href');
                    var email = fullHref.substring(flag.length);
                    responseObj.emails.push(email);
                });
                // NOTE: Remove the duplicates
                responseObj.emails = _.uniq(responseObj.emails);
                callback(null, responseObj);
            }
        );
    }
    catch (e) {
        debugLog('Error: ', JSON.stringify(e));
    }
    finally {

    }
};

var generatePageAroundContent = function (title, content) {
    var head = '<head><title>' + title + '</title></head>';
    var body = '<body>' + content + '</body>';
    return '<html>' + head + body + '</html>';
};

router.get('/', function (req, res, next) {
    var imgStyle = 'width: 800px; vertical-align: top;';
    var itemStyle = 'margin: 10px 0; border: 1px solid #000; padding: 10px; background: #eee;'
    var html = generatePageAroundContent('Home Page',
        '<h3>Gather URLs</h3>' +
        '<div>To show the console in Google Chrome:' +
        '<ul><li>On Mac: Cmd + Opt + J</li><li>On Windows: Ctrl + Shift + J</li></ul>' +
        '</div>' +
        '<p>Copy / paste this script (Updated on ' + moment(scriptStats.mtime.getTime()).format(fullDateFormat) + ')' +
        ' into a console window (for example on <a href="https://www.theknot.com/marketplace/wedding-reception-venues-los-angeles-ca">The Knot</a>):</p>' +
        '<textarea rows="10" cols="80" readonly style="background-color: #ccc; font-weight: bold;">' + testScript + '</textarea>' +
        '<h3>Paste the entire JSON array below, then click submit</h3>' +
        '<form method="post" action="/urls">' +
        '<textarea rows="10" cols="80" name="url_arr">' + dataJSON + '</textarea>' +
        '<br/>' +
        '<input type="submit" value="Submit" />' +
        '</form>' +
        '<br/>' +
        '<ol style="">' +
        '<li style="' + itemStyle + '"><img src="/static/images/step1.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step2.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step3.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step4.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step5.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step6.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step7.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step8.png" style="' + imgStyle + '" /></li>' +
        '<li style="' + itemStyle + '">' +
        'Make sure the array is input properly. Arrays in Javascript start with a "[" and end with a "]".' +
        'String values (the wbsites) need to be surrounded by double quotes and separated by commas.' +
        'So an array of two items looks like: [ "website1.com" , "website2.com" ]' +
        '<br/>' +
        '<img src="/static/images/step9.png" style="' + imgStyle + '" />' +
        '</li>' +
        '<li style="' + itemStyle + '"><img src="/static/images/step10.png" style="' + imgStyle + '" /></li>' +
        '</ol>');
    return res.end(html);
});

router.post('/urls', function (req, res, next) {
    infoLog('Starting to process a request...');
    var urlArr = JSON.parse(req.body.url_arr);
    urlArr = urlArr.slice(0, 100);

    // NOTE: Each of these will add n processing time, multiplicative
    urlArr = urlArr.concat(
        urlArr.map(function (curr, ind, arr) {
            return curr + 'contact-us/';
        })
    );
    async.map(urlArr, processSingleUrl, function (err, resultObjs) {
        if (err) {
            debugLog('There was an error at some point during the URL processing: ' + JSON.stringify(err));
        }
        var resultList = '';
        var emptyList = '';
        resultObjs.forEach(function (curr, ind, arr) {
            if (curr.emails.length < 1) {
                emptyList += curr.url;
                if (ind < arr.length - 1) {
                    emptyList += ',';
                }
                return;
            }
            resultList += '<dt style="margin-top: 10px;">' + curr.url + '</dt><dd style="font-weight: bold;">' + JSON.stringify(curr.emails) + '</dd>';
        });
        var html = generatePageAroundContent('Results',
            '<h3>Processed ' + urlArr.length + ' URLs:</h3>' +
            '<p>&nbsp;</p>' +
            '<dl>' +
            resultList +
            '</dl>' +
            '<h3>Empty URLs:</h3>' +
            emptyList
        );
        return res.end(html);
    });
});

router.use(haltOnTimedout);

server.listen(process.env.PORT || 3000, process.env.IP || '0.0.0.0', function () {
    var addr = server.address();
    var filepath = __dirname + '/test_script.js';

    infoLog('Loading test_script...');
    scriptStats = fs.statSync(filepath);
    testScript = fs.readFileSync(filepath, {
        encoding: 'utf8'
    });

    infoLog('Loading data...');
    filepath = __dirname + '/data.json';
    dataJSON = fs.readFileSync(filepath, {
        encoding: 'utf8'
    });
    infoLog('Script processor started up. Server listening at', addr.address + ':' + addr.port);
});
