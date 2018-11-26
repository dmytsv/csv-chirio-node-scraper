const fs = require("fs");
const express = require("express");
const app = express();
const csv = require("fast-csv");
const limit = require("simple-rate-limiter");
const cheerio = require("cheerio");

// VALUES TO SET vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
let inputCSV = "in.csv"; // set name of input file
let outputCSV = "out.csv"; // set name of output file
let requestsPerSecond = 100; // set number of requests per second

let titles = ["index", "sku", "name", "price", "quantity", "unitPrice", "link"];
let skuSelector = ".product-sku";
let nameSelector = ".product-name";
let priceSelector = ".unit-price";
let quantitySelector = ".unit-quantity";
let multyPriceSelector = ".multy-price";
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
const SECOND = 1000;
const request = limit(require("request"))
  .to(requestsPerSecond)
  .per(SECOND);
const userAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36";
const writeStream = fs.createWriteStream(outputCSV);
let links = [];
let items = [];

// functions
const oneRequest = (link, index) => {
  return new Promise((resolve, reject) => {
    request(
      {
        url: link,
        headers: { "user-agent": userAgent }
      },
      (error, res, body) => {
        if (!error) {
          const $ = cheerio.load(body);
          // feel free to change scraping logic if necessary
          let sku = $(skuSelector).text();
          let name = $(nameSelector).text();
          let price = $(priceSelector).text();
          let quantity = $(quantitySelector).text();
          let unitPrice = $(multyPriceSelector).text() / quantity;
          let item = [index, sku, name, price, quantity, unitPrice, link];
          resolve(item);
        }
      }
    ).on("error", error => {
      console.error(`Error accessing link #${index} - ${link}`);
      resolve([index, `Error accessing link #${index} - ${link}`]);
    }); // request
  }); // Promise
}; // oneRequest

const addToItems = item => items.push(item);

const chainRequests = (chain, pr) => {
  return chain.then(() => {
    return pr.then(addToItems).catch(err => console.log(err));
  });
};

const allRequests = () => {
  links
    .map(oneRequest)
    .reduce(chainRequests, Promise.resolve())
    .then(writeCSV)
    .then(() => console.log("All tasks executed."));
}; // allRequests

const readCSV = data =>
  data.forEach(e => (e.match(/http.*/) ? links.push(e) : undefined));

const writeCSV = () => {
  csv.write([titles, ...items]).pipe(writeStream);
};

// the main logic
fs.createReadStream(inputCSV)
  .pipe(csv())
  .on("data", readCSV)
  .on("end", allRequests);
