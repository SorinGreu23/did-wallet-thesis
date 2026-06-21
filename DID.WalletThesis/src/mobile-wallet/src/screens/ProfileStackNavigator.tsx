import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileSettingsScreen from "./ProfileSettingsScreen";
import EditPersonalProfileScreen from "./EditPersonalProfileScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileHome"
        component={ProfileSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditPersonalProfile"
        component={EditPersonalProfileScreen}
      />
    </Stack.Navigator>
  );
}
