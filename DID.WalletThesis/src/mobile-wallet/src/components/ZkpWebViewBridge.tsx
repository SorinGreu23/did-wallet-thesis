import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import zkpBridge from '../services/zkpBridge';

// Injected after snarkjs loads; exposes window.__zkpReceive for RN → WebView calls.
const BRIDGE_JS = `
(function() {
  function b64ToUint8(b64) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  window.__zkpReceive = async function(msg) {
    try {
      if (msg.type === 'prove') {
        var wasm = b64ToUint8(msg.wasm);
        var zkey = b64ToUint8(msg.zkey);
        var result = await snarkjs.groth16.fullProve(
          msg.input,
          { type: 'mem', data: wasm },
          { type: 'mem', data: zkey }
        );
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id: msg.id, type: 'result',
          proof: result.proof, publicSignals: result.publicSignals
        }));
      } else if (msg.type === 'verify') {
        var valid = await snarkjs.groth16.verify(msg.vkey, msg.publicSignals, msg.proof);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id: msg.id, type: 'result', valid: valid
        }));
      }
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        id: msg.id, type: 'error', error: e.message || String(e)
      }));
    }
  };
})();
true;
`;

export default function ZkpWebViewBridge() {
  const webViewRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/zkp/snarkjs.data'));
        await asset.downloadAsync();
        const snarkjsContent = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setHtml(
          `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>` +
          `<script>${snarkjsContent}</script>` +
          `<script>${BRIDGE_JS}</script>` +
          `</body></html>`,
        );
      } catch (e) {
        console.error('[ZkpWebViewBridge] failed to load snarkjs asset', e);
      }
    })();
  }, []);

  const handleLoadEnd = () => {
    if (webViewRef.current) {
      zkpBridge.register((js) => webViewRef.current?.injectJavaScript(js));
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    zkpBridge.handleMessage(event.nativeEvent.data);
  };

  if (!html) return null;

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden' }} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ html }}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        javaScriptEnabled
        originWhitelist={['about:blank', 'file://*']}
        style={{ width: 1, height: 1, opacity: 0 }}
      />
    </View>
  );
}
