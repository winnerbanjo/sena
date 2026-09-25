import { redirect } from 'next/navigation';

export default function ConnectPage() {
  redirect('/website?tab=connect');
}
