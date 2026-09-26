'use client';
import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { useWorkspace } from '../../components/workspace-access';

export default function BookingPreviewPage(){
  const workspace=useWorkspace();
  const slug=workspace?.property.slug;
  const [mobile,setMobile]=React.useState(false);
  const [message,setMessage]=React.useState('');
  const url=slug ? `https://${slug}.sena.ng` : '';
  async function copy(){try{await navigator.clipboard.writeText(url);setMessage('Website link copied.');}catch{setMessage('Could not copy. Select the website link and copy it manually.');}}
  return <div className="flex-1 flex flex-col min-w-0 h-screen"><Topbar title="Direct Booking"/><main className="p-4 sm:p-6 space-y-5 overflow-y-auto"><h2 className="text-2xl font-serif">Your guest booking website</h2><p className="text-sm text-[#7A7267]">Preview the published website. Edit room visibility, photos and content in Website.</p>{url ? <><div className="flex flex-wrap gap-3 items-center"><a href={url} target="_blank" rel="noreferrer" className="text-sm underline break-all">{url}</a><button onClick={copy} className="border rounded min-h-11 px-3 text-sm">Copy link</button><Link href="/website" className="bg-[#71382D] text-white rounded min-h-11 inline-flex items-center px-3 text-sm">Edit website</Link><button onClick={()=>setMobile(!mobile)} aria-pressed={mobile} className="border rounded min-h-11 px-3 text-sm">{mobile?'Desktop preview':'Mobile preview'}</button></div><p role="status" className="text-sm">{message}</p><iframe title={`${workspace?.property.name} booking website`} src={`/site/${slug}`} className={`h-[720px] border rounded-lg bg-white w-full mx-auto ${mobile?'max-w-[390px]':''}`}/></> : <p>Your property needs a website address. <Link href="/website" className="underline">Set up your website</Link>.</p>}</main></div>;
}
