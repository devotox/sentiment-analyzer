//@flow

const entities = require('he');
const request = require('axios');
const moment = require('moment');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const { get:existential, flatten } = require('lodash');

const finance = require('google-finance');
const financeToday = require('google-stocks');

const retext = require('retext');
const retextSentiment = require('retext-sentiment');

const search = require('./search');
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
	let text = $html.find(config.selector).html();
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
		.replace(/\s+\,/igm, ',').replace(/\,+/igm, ',')
		.replace(/\s+\./igm, '.').replace(/\.+/igm, '.')
		.replace(/\s+\=/igm, '=').replace(/\=+/igm, '.')
		.replace(/\s+\-/igm, '-').replace(/\-+/igm, '.')
		.replace(/\,\./igm, '.').replace(/\.\,/igm, '.')
		.replace(/\\\'/igm, '\'').replace(/\s+/igm, ' ');
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
		reject(new Error(
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
			news: stocks.news(symbols, config),
			historical: stocks.historical(symbols, config)
		}).then(({ current, news, historical }) => {
			return stocks.merge({ symbols, current, historical, news });
		});
	},
	current(symbols) {
		return new Promise((resolve, reject) => {
			financeToday(symbols, (error, data) => {
				if(error) { return reject(new Error(error)); }
				resolve(data);
			});
		});
	},
	historical(symbols, options: Object) {
		return new Promise((resolve, reject) => {
			return finance.historical({
				symbols: symbols,
				to: options.enddate || today,
				from: options.startdate || oneMonthAgo
			}, (error, data) => {
				if(error) { return reject(new Error(error)); }
				resolve(data);
			});
		});
	},
	news(symbols, options: Object) {
		return new Promise((resolve, reject) => {
			return finance.companyNews({
				symbols: symbols,
				to: options.enddate || today,
				from: options.startdate || oneMonthAgo
			}, (error, data) => {
				if(error) { return reject(new Error(error)); }
				resolve(data);
			});
		});
	},
	merge({ symbols, current, historical, news }) {

		let final = {};

		symbols.forEach((symbol) => {
			final[symbol] = { values: [], news: [] };
		});

		Object.keys(historical).forEach((index) => {
			let historicalStocks = historical[index];

			let lastClose = false;

			historicalStocks.forEach((stock) => {
				let finalStock = {
					volume: stock.volume,
					date: moment(stock.date).format('llll'),
					price: {
						value: stock.close,
						high: stock.high,
						low: stock.low
					},
					change: {
						value: 'N/A',
						positive: false,
						percentage: 'N/A'
					},
					lastTradeTime: {
						value: 'N/A'
					}
				};

				if(lastClose) {
					let changeValue = (stock.close - lastClose).toFixed(2);
					let changeValuePercentage = (parseFloat(changeValue) / stock.close * 100).toFixed(2);

					Object.assign(finalStock.change, {
						value: changeValue,
						percentage: changeValuePercentage,
						positive: parseFloat(changeValue) >= 0
					});
				}

				final[index].values.unshift(finalStock);
				lastClose = stock.close;
			});
		});

		current.forEach((stock) => {
			let index = stock.t;
			final[index].exchange = stock.e;

			let finalStock = {
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
				lastTradeTime: {
					value: moment(stock.lt, 'MMM DD, H:ma').format('llll'),
					extended: {
						value: moment(stock.elt, 'MMM DD, H:ma').format('llll')
					}
				}
			};

			final[index].values.unshift(finalStock);
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
		let news = flatten(Object.keys(response).map(key => response[key].news));

		return Promise.map(news, (doc) => {
			if (!doc.link) { return; }
			return stocks.article(config, doc.link)
			.then((response) => doc.body = response)
			.catch(noop);
		}).then(() => response);
	},
	text(config: Config, response: Object): Promise {
		let news = flatten(Object.keys(response).map(key => response[key].news));

		return Promise.map(news, (doc) => {
			if (!doc.body) { return; }
			doc.body = stripHTML(config, doc.body, false);
		}).then(() => response);
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
					displayLink: doc.displayLink
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
		return Promise.map(response, (doc) => {
			if (!doc.link) { return; }
			return news.article(config, doc.link)
			.then((response) => doc.body = response)
			.catch(noop);
		}).then(() => response);
	},
	text(config: Config, response: Object): Promise {
		return Promise.map(response, (doc) => {
			if(typeof doc.body != 'string') { doc.body = ''; }
			if (!doc.body) { return; }

			doc.body = stripHTML(config, doc.body);
			doc.summary = doc.summary || doc.body.substring(0, 100);
		}).then(() => response);
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
