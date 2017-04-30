//@flow

import type {
	Options,
	Config
} from '../../flow.types';

const Promise = require('bluebird');

const utils = require('../../utils');

const authenticate = (config: Config): Promise => {
	return new Promise((resolve) => {
		if (!config.auth) {
			return resolve();
		}
	});
};

const request = (query: string, config: Config): Promise => {
	return () => new Promise((resolve, reject) => {
		utils.getRequest('request', 'stocks', config)(query, config)
		.then(utils.resolve(resolve))
		.catch(utils.reject(reject));
	});
};

const normalize = (config: Config): Promise => {
	return (response) => new Promise((resolve, reject) => {
		utils.getFunction('normalize', 'stocks', config)(config, response)
		.then(utils.resolve(resolve))
		.catch(utils.reject(reject));
	});
};

const body = (config: Config): Promise => {
	return (response) => new Promise((resolve, reject) => {
		utils.getFunction('body', 'stocks', config)(config, response)
		.then(utils.resolve(resolve))
		.catch(utils.reject(reject));
	});
};

const text = (config: Config): Promise => {
	return (response) => new Promise((resolve, reject) => {
		utils.getFunction('text', 'stocks', config)(config, response)
		.then(utils.resolve(resolve))
		.catch(utils.reject(reject));
	});
};

const run = (query: string, config: Config): Promise => {
	return authenticate(config)
		.then(request(query, config))
		.then(normalize(config))
		.then(body(config))
		.then(text(config));
};

module.exports = (query: string, options: Options): Promise => {
	options = options || {};

	let config = options.config || {};

	let source = options.source || null;

	source = `./sources/${source || 'default'}`;

	// $FlowFixMe
	config = !options.source ? config : Object.assign({}, require(source), config);

	return run(query, config);
};
