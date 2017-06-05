const news = require('./news');
const stocks = require('./stocks');
const sentiment = require('./sentiment');
const search = require('../utils/search');

module.exports = {
	sentiment,
	search,
	stocks,
	news
};