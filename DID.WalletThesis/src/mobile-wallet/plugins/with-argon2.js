const { createRunOncePlugin } = require('@expo/config-plugins');

// react-native-argon2 autolinks on both iOS (via CocoaPods) and Android (Gradle).
// No extra native configuration is needed; this plugin just ensures expo prebuild
// does not strip the package from the native project.
const withArgon2 = (config) => config;

module.exports = createRunOncePlugin(withArgon2, 'react-native-argon2', '1.0.0');
