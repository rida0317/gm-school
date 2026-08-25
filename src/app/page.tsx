import { redirect } from 'next/navigation';

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === 'string' ? params.code : undefined;

  if (code) {
    redirect(`/auth/callback?code=${code}`);
  }

  redirect('/login');
}
