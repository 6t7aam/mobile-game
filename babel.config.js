module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // Worklets plugin (Reanimated 4) must be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
