//@flow

const request = require('axios');

const searchURL = "https://www.googleapis.com/customsearch/v1";

const createRequest = (query: string, options: Object): Object => {
	let cx = options && options.google && options.google.cx;
	let key = options && options.google && options.google.key;

	return {
		url: searchURL,
		method: 'GET',
		params: {
			dateRestrict: options.dateRestrict,
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

const google = (query: string, options: Object): request => {
	let requestConfig = createRequest(query, options);
	return request(requestConfig)
		.then((response) => {
			return {
				search: query,
				data: response.data
			};
		});
};

const run = (query: string, options: Object): request => {
	return google(query, options);
};

module.exports = (query: string, options: Object = {}) => {
	return run(query, options);
};
