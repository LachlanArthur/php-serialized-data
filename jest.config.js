module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	globals: {
		'ts-jest': {
			warnOnly: true,
			isolatedModules: true,
		},
	},
};
