

const Promise = require('bluebird');

const utils = require('../../utils');

const authenticate = config => {
	return new Promise(resolve => {
		if (!config.auth) {
			return resolve();
		}
	});
};

const request = (query, config) => {
	return () => new Promise((resolve, reject) => {
		utils.getRequest('request', 'news', config)(query, config).then(utils.resolve(resolve)).catch(utils.reject(reject));
	});
};

const normalize = config => {
	return response => new Promise((resolve, reject) => {
		utils.getFunction('normalize', 'news', config)(config, response).then(utils.resolve(resolve)).catch(utils.reject(reject));
	});
};

const filter = config => {
	return response => new Promise((resolve, reject) => {
		utils.getFunction('filter', 'news', config)(config, response).then(utils.resolve(resolve)).catch(utils.reject(reject));
	});
};

const body = config => {
	return response => new Promise((resolve, reject) => {
		utils.getFunction('body', 'news', config)(config, response).then(utils.resolve(resolve)).catch(utils.reject(reject));
	});
};

const text = config => {
	return response => new Promise((resolve, reject) => {
		utils.getFunction('text', 'news', config)(config, response).then(utils.resolve(resolve)).catch(utils.reject(reject));
	});
};

const run = (query, config) => {
	return authenticate(config).then(request(query, config)).then(normalize(config)).then(filter(config)).then(body(config)).then(text(config));
};

module.exports = (query, options) => {
	options = options || {};

	let config = options.config || {};

	let source = options.source || null;

	source = `./sources/${source || 'default'}`;

	// $FlowFixMe
	config = !options.source ? config : Object.assign({}, require(source), config);

	return run(query, config);
};