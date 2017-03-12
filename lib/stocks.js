// Needs an algorithm that can do these
// weight each site differently
// weight each article based on date
// each article would be better if a dedicated parser is created
// i.e. a news module that can take a search term parse 10 different sites direct API
// return the exact text part we want and none of the fluff and then send it to indico
// atm we are too reliant on google to surface the news it thinks its accurate and it is not returning dates of the articles
// and indico to parse these links and cannot be sure what text it used in its sentiment decision
// get the sentiment for different days to see if the sentiment is going up or down

const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const finance = require('yahoo-finance');
// const finance = require('google-finance');
const financeToday = require('google-stocks');

const search = require('./search');
const sentiment = require('./sentiment');
const { calculateSentiment, calculateConfidence } = require('./utils');

let today = moment().format('YYYY-MM-DD');
let lastWeek = moment().subtract(4, 'week').format('YYYY-MM-DD');

const currentRates = (stocks) => {
	return new Promise((resolve, reject) => {
		financeToday(stocks, (error, data) => {
			if(error) { return reject(new Error(error)); }
			resolve(data);
		});
	});
};

const stockRates = (stocks, options) => {
	return new Promise((resolve, reject) => {
		return finance.historical({
			symbols: stocks,
			to: options.toDate || today,
			from: options.fromDate || lastWeek
		}, (error, data) => {
			if(error) { return reject(new Error(error)); }
			resolve(data);
		});
	});
};

const stockNews = (stocks, options) => {
	if(true) { return searchNews(stocks, options); }

	return new Promise((resolve, reject) => {
		return finance.companyNews({
			symbols: stocks,
			to: options.toDate || today,
			from: options.fromDate || lastWeek
		}, (error, data) => {
			if(error) { return reject(new Error(error)); }
			resolve(data);
		});
	});
};

const doSearch = (stock, options) => {
	return search(stock, options)
	.then((result) => {
		result.data.items = result.data.items || [];
		return result.data.items.map((article) => {
			return {
				date: null,
				symbol: stock,
				link: article.link,
				title: article.title,
				guid: article.cacheId,
				summary: article.snippet,
				description: article.snippet,
				displayLink: article.displayLink
			};
		});
	});
};

const searchNews = (stocks, options) => {
	let news = {};
	let promises = [];

	stocks.forEach((stock) => {
		_.times(2, (index) => {
			let config = Object.assign({}, options);
			config.startIndex = index * 10 + 1;

			promises.push(
				doSearch(stock, config)
				.then((result) => {
					news[stock] = news[stock] || [];
					news[stock] = news[stock].concat(result);
				})
			);
		});
	});

	return Promise.all(promises).then(() => news);
};

const stockSentiments = ({ stocks, current, historical, news, options }) => {
	let sentiments = [];
	_.forEach(news, (stock) => {
		_.forEach(stock, (news, index) => {
			sentiments.push(
				sentiment.direct(news.link, options)
				.then((sentiment) => {
					news.sentiment = sentiment;
				})
				.catch((error) => {
					stock.splice(index, 1);
					console.error('NEWS SENTIMENT ERROR', index, news.link, error);
				})
			);
		});
	});

	return Promise.all(sentiments).then(() => {
		return { stocks, current, historical, news };
	});
};

const combineData = ({ stocks, current, historical, news }) => {

	let final = {};

	stocks.forEach((stock) => {
		stock = stock.toUpperCase();
		final[stock] = { values: [], news: [] };
	});

	Object.keys(historical).forEach((index) => {
		let historical_stocks = historical[index];

		let last_close;

		historical_stocks.forEach((stock) => {
			let final_stock = {
				volume: stock.volume,
				date: moment(stock.date).format('llll'),
				price: {
					value: stock.close,
					high: stock.high,
					low: stock.low
				},
				change: {
					value: 'N/A',
					percentage: 'N/A'
				},
				last_trade_time: {
					value: 'N/A'
				}
			};

			if(last_close) {
				let change_value = (stock.close - last_close).toFixed(2);
				let change_value_percentage = (change_value / stock.close * 100).toFixed(2);

				final_stock.change = {
					value: change_value,
					percentage: change_value_percentage,
					positive: parseFloat(change_value) >= 0
				};
			}

			final[index].values.unshift(final_stock);
			last_close = stock.close;
		});
	});

	current.forEach((stock) => {
		let index = stock.t;
		final[index].exchange = stock.e;

		let final_stock = {
			volume: 'N/A',
			date: moment().format('llll'),
			price: {
				value: parseFloat(stock.l),
				extended: {
					value: parseFloat(stock.el)
				}
			},
			change: {
				value: parseFloat(stock.c),
				percentage: parseFloat(stock.cp),
				positive: parseFloat(stock.c) >= 0,
				extended: {
					value: parseFloat(stock.ec),
					percentage: parseFloat(stock.ecp),
					positive: parseFloat(stock.ec) >= 0
				}
			},
			last_trade_time: {
				value: moment(stock.lt, 'MMM DD, H:ma').format('llll'),
				extended: {
					value: moment(stock.elt, 'MMM DD, H:ma').format('llll')
				}
			}
		};

		final[index].values.unshift(final_stock);
	});

	Object.keys(news).forEach((index) => {
		let stock_news = news[index].reverse();
		final[index].news = stock_news;

		let total_sentiment = 0;
		stock_news.forEach((article) => {
			if(article.sentiment) {
				total_sentiment += article.sentiment.value;
			}
			if(article.date) {
				article.date = moment(article.date).format('llll');
			}
			if(article.link && !article.displayLink) {
				article.displayLink = article.link.replace(/.*?:\/\//g, '').split('/')[0];
			}
		});

		let sentiment_value = parseFloat(
			(total_sentiment / stock_news.length).toFixed(2)
		);

		final[index].sentiment = {
			total: total_sentiment,
			value: sentiment_value,
			sentiment: calculateSentiment(sentiment_value),
			confidence: calculateConfidence(sentiment_value)
		};
	});

	return final;
};

const getStock = (stocks, options) => {
	return Promise.all([
		currentRates(stocks),
		stockNews(stocks, options),
		stockRates(stocks, options)
	]).then(([current, news, historical]) => {
		return { stocks, current, historical, news, options };
	}).then(stockSentiments).then(combineData);
};

module.exports = (stocks, options = {}) => {
	console.info('Stocks ====>');
	stocks = _.flatten([ stocks ]);
	return getStock(stocks, options);
};
