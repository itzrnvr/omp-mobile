module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required by react-native-reanimated (keyboard-controller's peer dep);
    // must be listed LAST.
    plugins: ['react-native-reanimated/plugin'],
  };
};
