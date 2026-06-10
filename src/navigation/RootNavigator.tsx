import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { COLORS } from '@/constants/gameConfig';
import { SplashScreen } from '@/screens/SplashScreen';
import { MainMenuScreen } from '@/screens/MainMenuScreen';
import { WorldScreen } from '@/screens/WorldScreen';
import { ResearchScreen } from '@/screens/ResearchScreen';
import { ArsenalScreen } from '@/screens/ArsenalScreen';
import { CodexScreen } from '@/screens/CodexScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

export type RootStackParamList = {
  Splash: undefined;
  MainMenu: undefined;
  /** The unified continuous world (auto day/night) — replaces Day/Night/Dawn. */
  World: undefined;
  Research: undefined;
  Arsenal: undefined;
  Codex: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.panel,
    text: COLORS.text,
    border: COLORS.panelBorder,
    primary: COLORS.accent,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="MainMenu" component={MainMenuScreen} />
        <Stack.Screen name="World" component={WorldScreen} />
        <Stack.Screen name="Research" component={ResearchScreen} />
        <Stack.Screen name="Arsenal" component={ArsenalScreen} />
        <Stack.Screen name="Codex" component={CodexScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
