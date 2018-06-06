//@flow

const entities = require('he');
const request = require('axios');
const moment = require('moment');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const { get:existential } = require('lodash');


const retext = require('retext');
const retextSentiment = require('retext-sentiment');

const search = require('./search');
const finance = require('yahoo-finance');
const textVersion = require('textversionjs');

let today = moment().format('YYYY-MM-DD');
let oneMonthAgo = moment().subtract(1, 'month').format('YYYY-MM-DD');

import type {
	Config,
	NewsResults
} from '../flow.types';

const noop = () => {}

const styleConfig = {
	linkProcess: noop,
	imgProcess: noop
}

const stripHTML = (config: Config, html: string, full: boolean = true): string => {
	let $ = cheerio.load(html);
	let $html = $('<span/>').html(html);
	config.selector = config.selector || 'body';
	let text = $html.find(config.selector).text() || $html.text() || html;
	return replaceHTML(text, full);
};

const replaceHTML = (text: string = '', full: boolean) => {
	text = stripLinks(text);

	if (full) {
		text = textVersion(text, styleConfig);
		text = entities.decode(text);
	}

	text = text.replace(/<(?:.|\n)*?>/igm, '');
	return trim(text);
};

const stripLinks = (text = '') => {
	return text
		.replace(/<(\s*)?img((\n|.)*?)?[^<>]*>/igm, '')
		.replace(/<(\s*)?a\b[^>]*>((\n|.)*?)?<\/a>/igm, '')
		.replace(/<(\s*)?style\b[^>]*>((\n|.)*?)?<\/style>/igm, '')
		.replace(/<(\s*)?script\b[^>]*>((\n|.)*?)?<\/script>/igm, '');
};

const trim = (text = '') => {
	return text.trim()
		.replace(/(?:\r\n|\r|\n|\t|\s+)/igm, ' ')
		.replace(/\s+,/igm, ',').replace(/,+/igm, ',')
		.replace(/\s+\./igm, '.').replace(/\.+/igm, '.')
		.replace(/\s+=/igm, '=').replace(/=+/igm, '.')
		.replace(/\s+-/igm, '-').replace(/-+/igm, '.')
		.replace(/,\./igm, '.').replace(/\.,/igm, '.')
		.replace(/\\'/igm, '\'').replace(/\s+/igm, ' ');
};

const resolve = (resolve: Function) => {
	return (result: Object) => {
		resolve(
			existential(result, 'data.response') || existential(result, 'data', result)
		);
	};
};

const reject = (reject: Function) => {
	return (error: Object) => {
		reject(error instanceof Error ? error : new Error(
			existential(error, 'response.data.error') || existential(error, 'response.data', error)
		));
	};
};

const getFunction = (func: string, type: string, config: Config) => {
	return (
		config[func] ?
			config[func] :
			module.exports[type][func]
	);
};

const getRequest = (func: string, type: string, config: Config) => {
	return (
		config.google ?
			module.exports[type].google :
			getFunction(func, type, config)
	);
};

const createRequest = (query: string, config: Config): Promise => {
	return request({
		url: config.url,
		method: config.method,
		data: config.data && config.data(query, config),
		params: config.params && config.params(query, config),
		headers: config.headers && config.headers(query, config)
	});
};

const stocks = {
	request(query: string, config: Config): Promise {
		let symbols = query.toUpperCase().split(',').map(v => v.trim());
		return Promise.props({
			current: stocks.current(symbols),
			// news: stocks.news(symbols, config),
			historical: stocks.historical(symbols, config)
		}).then(({ current, historical, news = {} }) => {
			return stocks.merge({ symbols, current, historical, news });
		});
	},
	current(symbols: string[]) {
		let currentData = {};
		let options = [
			'summaryDetail', 'summaryProfile',
			'price', 'earnings', 'financialData',
			'calendarEvents', 'defaultKeyStatistics',
			'recommendationTrend', 'upgradeDowngradeHistory'
		];

		return Promise.map(symbols, (symbol) => {
			return finance.quote(symbol, options)
				.then((data) => currentData[symbol] = data);
		})
			.then(() => currentData);
	},
	historical(symbols: string[], options: Object) {
		return new Promise((resolve, reject) => {
			return finance.historical({
				symbols: symbols,
				to: options.enddate || today,
				from: options.startdate || oneMonthAgo
			}, (error, data) => {
				error ? reject(new Error(error)) : resolve(data);
			});
		});
	},
	news(symbols: string[], options: Object) {
		return new Promise((resolve, reject) => {
			return finance.companyNews({
				symbols: symbols,
				to: options.enddate || today,
				from: options.startdate || oneMonthAgo
			}, (error, data) => {
				error ? reject(new Error(error)) : resolve(data);
			});
		});
	},
	// $FlowFixMe
	merge({ symbols, current, historical, news }) {

		let final = {};

		symbols.forEach((symbol) => {
			final[symbol] = { quotes: [], news: [], about: {} };
		});

		Object.keys(historical).forEach((index) => {
			let historicalStocks = historical[index];

			let lastClose = false;

			historicalStocks.forEach((stock) => {
				let finalStock = {
					volume: stock.volume,
					date: moment(stock.date).format('llll'),
					price: {
						low: stock.low,
						high: stock.high,
						value: stock.close,
						adj: stock.adjClose,
						lastTradeTime: 'N/A',
						change: {
							value: 'N/A',
							positive: false,
							percentage: 'N/A'
						}
					}
				};

				if(lastClose) {
					let changeValue = (stock.close - lastClose).toFixed(2);
					let changeValuePercentage = (parseFloat(changeValue) / stock.close * 100).toFixed(2);

					Object.assign(finalStock.price.change, {
						value: changeValue,
						percentage: changeValuePercentage,
						positive: parseFloat(changeValue) >= 0
					});
				}

				final[index].quotes.unshift(finalStock);
				lastClose = stock.close;
			});
		});

		Object.keys(current).forEach((index) => {
			let currentStocks = current[index];
			final[index].about = currentStocks;

			let stock = currentStocks.price;
			final[index].exchange = stock.exchange;
			final[index].marketState = stock.marketState;

			let finalStock = {
				volume: 'N/A',
				date: moment().format('llll'),
				price: {
					low: parseFloat(stock.regularMarketDayLow),
					value: parseFloat(stock.regularMarketPrice),
					high: parseFloat(stock.regularMarketDayHigh),
					lastTradeTime: moment(stock.regularMarketTime).format('llll'),
					change: {
						value: parseFloat(stock.regularMarketChange),
						positive: parseFloat(stock.regularMarketChange) >= 0,
						percentage: parseFloat(stock.regularMarketChangePercent)
					}
				},
				extended: {
					pre: {
						value: parseFloat(stock.preMarketPrice),
						lastTradeTime: moment(stock.preMarketTime).format('llll'),
						change: {
							value: parseFloat(stock.preMarketChange),
							positive: parseFloat(stock.preMarketChange) >= 0,
							percentage: parseFloat(stock.preMarketChangePercent)
						}
					},
					post: {
						value: parseFloat(stock.postMarketPrice),
						lastTradeTime: moment(stock.postMarketTime).format('llll'),
						change: {
							value: parseFloat(stock.postMarketChange),
							positive: parseFloat(stock.postMarketChange) >= 0,
							percentage: parseFloat(stock.postMarketChangePercent)
						}
					}
				}
			};

			final[index].quotes.unshift(finalStock);

		});

		Object.keys(news).forEach(index => {
			final[index].news = news[index];

			final[index].news.reverse()
				.forEach((article) => {
					if (article.date) {
						article.date = moment(article.date).format('llll');
					}
					if (article.link && !article.displayLink) {
						article.displayLink = article.link.replace(/.*?:\/\//g, '').split('/')[0];
					}
				});
		});

		return final;
	},
	normalize(config: Config, response: Object): Promise {
		return Promise.resolve(response);
	},
	article(config: Config, url: string): Promise {
		const requestConfig = {
			url: url,
			method: 'GET',
			params: config.articleParams && config.articleParams(config)
		};

		return new Promise((res, rej) => {
			request(requestConfig)
				.then(resolve(res))
				.catch(reject(rej));
		});
	},
	body(config: Config, response: Object): Promise {
		return Promise.map(Object.keys(response), (symbol) => {
			let news = response[symbol].news;
			let i = news.length;
			let promises = [];

			while(i--) {
				let doc = news[i];

				if (!doc.link) {
					news.splice(i, 1);
					continue;
				}

				let promise = stocks.article(config, doc.link)
					.then((response) => doc.body = response)
					.catch(noop);

				promises.push(promise);
			}

			return Promise.all(promises);
		})
			.then(() => response);
	},
	text(config: Config, response: Object): Promise {
		return Promise.map(Object.keys(response), (symbol) => {
			let news = response[symbol].news;
			let i = news.length;
			let promises = [];

			while(i--) {
				let doc = news[i];

				if (!doc.body) {
					news.splice(i, 1);
					continue;
				}

				let promise = Promise.resolve()
					.then(() => {
						doc.body = stripHTML(config, doc.body, true);
						doc.summary = doc.summary || doc.body.substring(0, 100);
					});

				promises.push(promise);
			}

			return Promise.all(promises);
		})
			.then(() => response);
	}
};

const sentiment = {
	request: createRequest,
	process(query: string, config: Config, response: Object): Promise {
		return new Promise((resolve) => {
			let processedText = null;

			retext()
				.use(retextSentiment)
				.use(() => (cst) => processedText = cst)
				.process(query);

			response.processed = processedText;
			resolve(response);
		});
	},
	normalize(config: Config, response: Object): Promise {
		let value: number = response.results || response.data;
		let confidence: string = sentiment.confidence(value);
		let polarity: string = sentiment.polarity(value);

		return Promise.resolve({ value, polarity, confidence });
	},
	confidence(value: number): string {
		value = Math.max(Math.abs(1 - value), Math.abs(0 - value)) * 100;
		return value && value.toFixed(2) || '0';
	},
	polarity(value: number): string {
		let sentiment = value > 0.5 ? 'positive' : 'negative';
		return value >= 0.45 && value <= 0.55 ? 'neutral' : sentiment;
	}
};

const news = {
	request: createRequest,
	getValue(key: string, config: Config, response: Object) {
		config.results = config.results || {};
		return config.results && config.results[key] ?
			response[config.results[key]] : response[key];
	},
	normalize(config: Config, response: Object): Promise {
		let data = news.getValue('key', config, response) || response;
		return Promise.map(data, (doc): NewsResults => {
			if (doc.date) {
				doc.date = moment(doc.date).format('llll');
			}
			if (doc.link && !doc.displayLink) {
				doc.displayLink = doc.link.replace(/.*?:\/\//g, '').split('/')[0];
			}

			// $FlowFixMe
			return {
				body: undefined,
				guid: news.getValue('guid', config, doc),
				date: news.getValue('date', config, doc),
				link: news.getValue('link', config, doc),
				title: news.getValue('title', config, doc),
				summary: news.getValue('summary', config, response),
				displayLink: news.getValue('displayLink', config, doc)
			};
		});
	},
	filter(config: Config, response: Object): Promise {
		let substrings = ['fastft'];
		let regex = new RegExp(substrings.join("|"));

		return Promise.filter(response, (doc) => {
			return !regex.test(doc.link);
		});
	},
	google(query: string, config: Config) {
		let params = config.params && config.params(query, config)
		let options = Object.assign({}, params, { google: config.google });

		return search(query, options)
			.then((result) => {
				result.data.items = result.data.items || [];
				return Promise.map(result.data.items, (doc): NewsResults => {
					if (doc.date) {
						doc.date = moment(doc.date).format('llll');
					}
					if (doc.link && !doc.displayLink) {
						doc.displayLink = doc.link.replace(/.*?:\/\//g, '').split('/')[0];
					}

					// $FlowFixMe
					return {
						body: undefined,
						date: doc.date,
						link: doc.link,
						title: doc.title,
						summary: doc.snippet,
						displayLink: doc.displayLink,
						guid: `${doc.kind}:${doc.cacheId || doc.link || doc.date}`
					};
				});
			});
	},
	article(config: Config, url: string): Promise {
		const requestConfig = {
			url: url,
			method: 'GET',
			params: config.articleParams && config.articleParams(config)
		};

		return new Promise((res, rej) => {
			request(requestConfig)
				.then(resolve(res))
				.catch(reject(rej));
		});
	},
	body(config: Config, response: Object): Promise {
		let i = response.length;
		let promises = [];

		while(i--) {
			let doc = response[i];

			if (!doc.link) {
				response.splice(i, 1);
				continue;
			}

			let promise = news.article(config, doc.link)
				.then((response) => doc.body = response)
				.catch(noop);

			promises.push(promise);
		}

		return Promise.all(promises)
			.then(() => response);
	},
	text(config: Config, response: Object): Promise {
		let i = response.length;
		let promises = [];

		while(i--) {
			let doc = response[i];

			if (!doc.body) {
				response.splice(i, 1);
				continue;
			}


			let promise = Promise.resolve()
				.then(() => {
					doc.body = stripHTML(config, doc.body, true);
					doc.summary = doc.summary || doc.body.substring(0, 100);
				});

			promises.push(promise);
		}

		return Promise.all(promises)
			.then(() => response);
	}
};

module.exports = {
	news,
	noop,
	stocks,
	reject,
	resolve,
	sentiment,
	stripHTML,
	getRequest,
	getFunction
};
