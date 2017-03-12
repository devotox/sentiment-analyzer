const api = require('./lib/api');
const news = require('./lib/news');
const search = require('./lib/search');
const stocks = require('./lib/stocks');
const sentiment = require('./lib/sentiment');

console.log(sentiment, stocks, search);

module.exports = {
	sentiment,
	search,
	stocks,
	news,
	api
};
