const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm', 'zkey');

// Redirect snarkjs to its self-contained UMD browser bundle (no Node.js built-ins)
const snarkjsUmd = path.resolve(__dirname, 'node_modules/snarkjs/build/snarkjs.min.js');
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'snarkjs') {
    return { filePath: snarkjsUmd, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
