const crawler = require("crawler");
const fs = require('fs');
const axios = require('axios');
const path = require('path')  
let products = require('./product_skus.json');

// Do not change it
const amazonUrl = 'https://www.amazon.com';

// Do not change it
const searchUrl = amazonUrl + '/s?k=#&ref=nb_sb_noss_2';

// Number of products to be visited once the search results is not empty
let numberOfProductsFromSearchResponse = 1;

// Path where the downloaded images will be stored (from the root of the project)
const downloadedImagesDir = 'images/';

// Size of the worker pool. See https://github.com/bda-research/node-crawler
const maxConnections = 3;

// Number of milliseconds to delay between each request. See https://github.com/bda-research/node-crawler
const rateLimit = 1000;

products = products.map((value) => {    
    return {
        sku: value,
        url: searchUrl.replace('#', value)
    };
});

async function saveDownloadedImages(images, skuPath) {
    for (var j = 0; j < images.length; j++) {
        var url = images[j].attribs.src.split('.');
        var extension = url[url.length-1];
        url.splice(url.length - 2, 1);
        url = url.join('.');
        
        const filepath = path.resolve(skuPath, j + '.' + extension)
        
        const writer = fs.createWriteStream(filepath)

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        })

        response.data.pipe(writer);
    }
}

function findProductImages(productDetailUrls, sku) {
    var c2 = new crawler({
        maxConnections: maxConnections,
        rateLimit: rateLimit,
        // This will be called for each crawled page
        callback: function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                var $ = res.$;
                
                const images = $('li.item .a-button-thumbnail img');

                const skuPath = path.resolve(__dirname, downloadedImagesDir, sku);
                
                fs.promises.mkdir(skuPath, { recursive: true })
                .then(x => {                        
                    saveDownloadedImages(images, skuPath);
                })
                .catch(console.error);
            }
            done();
        }
    });

    c2.queue(productDetailUrls);
}

function downloadImagesFromAmazon() {
    var c = new crawler({
        maxConnections : 3,
        rateLimit: 2000,
        // This will be called for each crawled page
        callback : function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                var $ = res.$;
                var sku = res.options.sku;
                // $ is Cheerio by default
                //a lean implementation of core jQuery designed specifically for the server
                const links = $('span[cel_widget_id="SEARCH_RESULTS-SEARCH_RESULTS"] .rush-component a');
                
                var productDetailUrls = [];                

                for (var i = 0; i < numberOfProductsFromSearchResponse && i < links.length; i++) {
                    productDetailUrls.push(amazonUrl + links[i].attribs.href);
                }

                findProductImages(productDetailUrls, sku);
                
                if (links.length === 0) {
                    console.log(`SKU ${sku} not found.`);
                }
            }
            done();
        }
    });

    for (var i = 0; i < products.length; i++) {
        c.queue({
            uri: products[i].url,
            sku: products[i].sku
        });
    }
}

downloadImagesFromAmazon();