//@flow

const axios = require('axios');
const Promise = require('bluebird');

const methods = [
	'get', 'post', 'put', 'patch',
	'delete', 'head', 'options'
];

// $FlowFixMe
const request = (method: string, api: string, { params, data, headers, config } = {}): Promise => {
	const baseURL = config.api && config.api.base || '';
	const apiPrefix = config.api && config.api.prefix || '';

	let url = `${baseURL}/${apiPrefix}/${api}`.replace(/\/\//g, '/');
	let request_config = { method, url, params, data, headers };

	return new Promise((resolve, reject) => {
		axios(request_config).then((response) => {
			resolve(response.data);
		}).catch((response) => {
			reject(response.data);
		});
	});
};

module.exports = request;

methods.forEach((method) => {
	module.exports[method] = function() {
		return request(method, ...arguments);
	};
});
