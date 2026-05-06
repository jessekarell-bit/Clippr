import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import { authOptions } from '@/api/auth/[...nextauth]/route';

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

export async function requireSession() {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}
