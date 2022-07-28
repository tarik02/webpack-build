export default {
  presets: [
    [
      '@babel/preset-env',
      {
        'targets': {
          'browsers': [
            'last 2 versions',
            'ie >= 11'
          ]
        }
      }
    ],
    '@babel/preset-typescript',
  ],
  'plugins': [
    'lodash',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-syntax-dynamic-import',
  ]
};
