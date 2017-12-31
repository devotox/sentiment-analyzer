const { news, sentiment, stocks } = require('../src/lib/index');

const Promise = require('bluebird');
const { flatten } = require('lodash');

const config = {
	sentiment: {
		source: 'indico'
	},
	news: {
		source: 'guardian'
	},
	stocks: {
		source: 'default'
	}
};

const addStockSentiment = (response) => {
	let news = flatten(Object.keys(response).map(key => response[key].news));

	return Promise.map(news, getSentiment)
		.then(() => response);
};

const addSentiment = (response) => {
	return Promise.map(response, getSentiment)
		.then(() => response);
};

const getSentiment = (doc) => {
	return sentiment(doc.body, config.sentiment)
		.then((sentiment) => doc.sentiment = sentiment)
		.catch(() => doc.sentiment = {});
};

const getNews = (topic) => {
	return news(topic, config.news);
};

const getStocks = (topic) => {
	return stocks(topic, config.stocks);
};

const run = (topic) => {
	return Promise.all([
		getNews(topic).then(addSentiment),
		getStocks(topic).then(addStockSentiment)
	]);
};

let topic = process.argv[2];
if(topic) { run(topic).then(console.log); }
