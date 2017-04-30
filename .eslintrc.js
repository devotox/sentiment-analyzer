module.exports = {
	"root": true,
	"parser": "babel-eslint",
	"plugins": [
		"flowtype"
	],
	"parserOptions": {
		"ecmaVersion": 6,
		"sourceType": "module"
	},
	"extends": [
		"eslint:recommended",
		"plugin:flowtype/recommended"
	],
	"env": {
		"node": true
	},
	"settings": {
		"flowtype": {
			"onlyFilesWithFlowAnnotation": true
		}
	},
	"rules": {
		"no-console": "off",
		"no-extra-parens": "error",
		"no-template-curly-in-string": "error",
		"indent": ["error", "tab"],
		"max-len": ["error", 140 ],
		"comma-dangle": ["error", "never"],
		"no-cond-assign": ["error", "always"],
		"object-curly-spacing": ["error", "always"],
		"no-constant-condition": ["error", { "checkLoops": false }]
	}
}
