import { redirect } from 'next/navigation';

export default async function ChannelsRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) for (const entry of value) query.append(key, entry);
  }
  const suffix = query.toString();
  redirect(suffix ? `/apps?${suffix}` : '/apps');
}
