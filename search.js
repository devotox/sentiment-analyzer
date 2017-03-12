const isNode = typeof window === 'undefined';
const searchURL = "https://www.googleapis.com/customsearch/v1";

const request = require('axios');

const createRequest = (query, options) => {
	let cx = options && options.google && options.google.cx;
	let key = options && options.google && options.google.key;
	return {
		url: searchURL,
		method: 'GET',
		params: {
			dateRestrict: options.dateRestrict || 'd5',
			excludeTerms: options.excludeTerms,
			exactTerms: options.exactTerms,
			start: options.startIndex || 1,
			orTerms: options.orTerms,
			siteSearch: options.site,
			num: options.num || 10,
			lr: options.language,
			sort: options.sort,
			q: query,
			key:key,
			cx: cx
		}
	};
};

const runSearchGoogle = (query, options) => {
	return request(
		createRequest(query, options)
	)
	.then((response) => {
		return {
			search: query,
			data: response.data
		};
	});
};

const runSearchGoogleProxy = (query, options) => {
	let url = options && options.proxy && options.proxy.url;
	return request({
		url: url,
		method: 'POST',
		data: createRequest(query, options)
	})
	.then((response) => {
		return {
			search: query,
			data: response.data
		};
	});
};

const runSearch = (query, options) => {
	let proxy = options && options.proxy && options.proxy.on;
	return ( isNode || proxy === false ?
		runSearchGoogle :
		runSearchGoogleProxy
	)(query, options);
};

module.exports = (query, options = {}) => {
	console.info('Search ======>');
	return runSearch(query, options);
};
