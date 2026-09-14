import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/theme/tokens';

export const TERMS_URL = 'https://smelterpos.com/terms';
export const PRIVACY_URL = 'https://smelterpos.com/privacy';
export const SUPPORT_URL = 'https://smelterpos.com/support';
export const SIGNUP_URL = 'https://smelterpos.com/signup';

export async function openAuthBrowser(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, {
    dismissButtonStyle: 'done',
    controlsColor: auth.accent,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  });
}
