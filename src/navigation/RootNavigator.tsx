import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { COLORS } from '@/constants/gameConfig';
import { LanguageScreen } from '@/screens/LanguageScreen';
import { MainMenuScreen } from '@/screens/MainMenuScreen';
import { WorldScreen } from '@/screens/WorldScreen';
import { ResearchScreen } from '@/screens/ResearchScreen';
import { ArsenalScreen } from '@/screens/ArsenalScreen';
import { CodexScreen } from '@/screens/CodexScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { ShopScreen } from '@/screens/ShopScreen';
import { AccountScreen } from '@/screens/AccountScreen';
import { useSettingsStore } from '@/store/settingsStore';

export type RootStackParamList = {
  Language: undefined;
  MainMenu: undefined;
  /** The unified continuous world (auto day/night) — replaces Day/Night/Dawn. */
  World: undefined;
  Research: undefined;
  Arsenal: undefined;
  Codex: undefined;
  Settings: undefined;
  Shop: undefined;
  Account: undefined;
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
  // First launch (no language picked yet) boots into the language screen;
  // afterwards the game opens straight in the main menu — no splash detour.
  const languageChosen = useSettingsStore((s) => s.languageChosen);
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={languageChosen ? 'MainMenu' : 'Language'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Language" component={LanguageScreen} />
        <Stack.Screen name="MainMenu" component={MainMenuScreen} />
        <Stack.Screen name="World" component={WorldScreen} />
        <Stack.Screen name="Research" component={ResearchScreen} />
        <Stack.Screen name="Arsenal" component={ArsenalScreen} />
        <Stack.Screen name="Codex" component={CodexScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Shop" component={ShopScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
