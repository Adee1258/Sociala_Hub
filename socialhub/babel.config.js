module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // worklets plugin MUST come before reanimated plugin
      'react-native-worklets/plugin',
      'react-native-reanimated/plugin',
    ],
  };
};
