import { Redirect, useLocalSearchParams } from 'expo-router';
import { parseJoinToken } from '@/services/inviteLinks';

export default function JoinDeepLink() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = parseJoinToken(raw);

  if (!token) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Redirect
      href={{ pathname: '/(auth)/invite-hello', params: { token, fromJoin: '1' } }}
    />
  );
}
