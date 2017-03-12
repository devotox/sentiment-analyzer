const isNode = typeof window === 'undefined';

const qs = require('qs');
const request = require('axios');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const validator = require('validator');
const textVersion = require('textversionjs');

const retext = require('retext');
const sentiment = require('retext-sentiment');
const { calculateSentiment, calculateConfidence } = require('./utils');

const stripHTML = (html, options) => {
	let $ = cheerio.load(html);
	let $html = $('<span/>').html(html);

	if(options.stripSelector) {
		$html = $html.find(options.stripSelector);
	}

	return trim(textVersion($html.html()));
};

const trim = (text = '') => {
	return text.trim().replace(/(?:\r\n|\r|\n|\t|\s+)/g, ' ');
};

const doTextRequest = (url, options) => {
	return isNode ?
		request.get(url) :
		request({
			method: 'POST',
			url: options.proxy.url,
			data: { url: url, method: 'get', options: options }
		});
};

const getTextFromUrl = (url, options) => {
	return doTextRequest(url, options)
	.then((response) => {
		return stripHTML(response.data, options);
	});
};

const getText = (urlOrText, options) => {
	return new Promise( (resolve, reject) => {
		if(validator.isURL(urlOrText)) {
			return getTextFromUrl(urlOrText, options)
			.then(resolve).catch(reject);
		} else {
			resolve(urlOrText);
		}
	});
};

const processText = (sentimentData) => {
	let processedText = null;
	let text = sentimentData.text;

	retext()
	.use(sentiment)
	.use(() => {
		return (cst) => { processedText = cst; };
	})
	.process(text);

	sentimentData.processed = processedText;
	return sentimentData;
};

const createReturn = (text, response) => {
	return {
		text: text,
		value: response,
		sentiment: calculateSentiment(response),
		confidence: calculateConfidence(response)
	};
};

const getSentimentIndico = (text, options) => {
	const indico = require('indico.io');
	indico.apiKey = options && options.indico && options.indico.key;

	let action = 'sentiment';
	return indico[action](text)
	.then((response) => {
		if(!parseFloat(response)) {
			throw new Error(response);
		}
		return createReturn(text, response);
	});
};

const getSentimentIndicoProxy = (text, options) => {
	let action = 'sentiment';
	let indicoURL = `https://apiv2.indico.io/${action}/`;

	return request({
		method: 'POST',
		url: options.proxy.url,
		data: {
			url: indicoURL,
			method: 'POST',
			data: { data: text },
			headers:  {
				'X-ApiKey': options.indico.key
			}
		}
	})
	.then((response) => {
		return createReturn(text, response.data.results);
	});
};

const getSentimentVivek = (text) => {
	return request({
		method: 'POST',
		url: 'http://sentiment.vivekn.com/web/text/',
		data: qs.stringify({ txt: text }),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	})
	.then((response) => {
		let result = response.data.result;
		let value = parseFloat(response.data.confidence) / 100;

		return {
			text: text,
			value: value,
			sentiment: result.toLowerCase(),
			confidence: calculateConfidence(value)
		};
	});
};

const getSentiment = (text, options) => {
	let vivek = false;
	if(vivek) { return getSentimentVivek(text); }

	let proxy = options && options.proxy && options.proxy.on;
	return ( isNode || proxy === false ?
		getSentimentIndico :
		getSentimentIndicoProxy
	)(text, options);
};

module.exports = (urlOrText = '', options = {}) => {
	console.info('Sentiment ====>');
	return getText(urlOrText, options)
	.then((text) => {
		return getSentiment(text, options);
	})
	.then(processText);
};

module.exports.direct = (urlOrText = '', options = {}) => {
	console.info('Sentiment ====>');
	return getSentiment(urlOrText, options)
	.then(processText);
};
