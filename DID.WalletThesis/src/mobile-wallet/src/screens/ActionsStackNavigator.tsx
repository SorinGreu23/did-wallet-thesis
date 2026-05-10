import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ActionsStubScreen from './ActionsStubScreen';
import PresentationConsentScreen from './PresentationConsentScreen';
import IncomingPresentationScreen from './IncomingPresentationScreen';

const Stack = createNativeStackNavigator();

export default function ActionsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ActionsHome" component={ActionsStubScreen} />
      <Stack.Screen name="PresentationConsent" component={PresentationConsentScreen} />
      <Stack.Screen name="IncomingPresentation" component={IncomingPresentationScreen} />
    </Stack.Navigator>
  );
}
