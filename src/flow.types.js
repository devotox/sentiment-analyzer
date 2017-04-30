//@flow

export type Options = {
	config: Object,
	source: string,
	params: Params,
};

export type Config = {
	articleParams: Function,
	normalize: Function,
	request: Function,
	google: Object,
	source: string,
	url: string,
	key: string,
	auth: boolean,
	method: string,
	text: Function,
	body: Function,
	selector: string,

	process: Function,
	data: Function,
	params: Function,
	headers: Function,
	results: NewsResults,

	_data: Object,
	_params: Object,
	_headers: Object
};

export type Params = {

};

export type NewsResults = {
	key: string,
	body: string,
	date: string,
	link: string,
	title: string,
	summary: string,
	description: string,
	displayLink: string
};
