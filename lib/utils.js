module.exports.calculateConfidence = (value) => {
	value = Math.max(Math.abs(1 - value), Math.abs(0 - value)) * 100;
	return value && value.toFixed(2);
};

module.exports.calculateSentiment = (value) => {
	if(!value) { return ''; }
	let sentiment = value > 0.5 ? 'positive' : 'negative';
	return value >= 0.45 && value <= 0.55 ? 'neutral' : sentiment;
};
