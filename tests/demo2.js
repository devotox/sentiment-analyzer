const { news, sentiment, stocks } = require('../index');

// stocks('GOOG', { source: 'default' }).then((data) => {
// 	data.GOOG.values.map((value) => {
// 		console.log(value);
// 	});
//
// 	data.GOOG.news.map((value) => {
// 		console.log(value);
// 	});
// })

news('twitter', { source: 'default' }).then(console.log);

// sentiment('I love everyone', { source: 'default' }).then(console.log);
