'use client';

import * as React from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

export function ContactForm({ propertyName }: { propertyName: string }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [sent, setSent] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="p-6 rounded-lg bg-emerald-50 border border-emerald-200 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
        <h3 className="font-serif text-base text-emerald-900 font-medium">Message Delivered</h3>
        <p className="text-xs text-emerald-700">
          Thank you, {name}. The management at {propertyName} has received your inquiry and will follow up shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div>
        <label className="block text-[#191816] font-medium mb-1">Your Name *</label>
        <input
          type="text"
          required
          value={name}
          placeholder="e.g. Bukola Williams"
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
        />
      </div>

      <div>
        <label className="block text-[#191816] font-medium mb-1">Email Address *</label>
        <input
          type="email"
          required
          value={email}
          placeholder="bukola@example.com"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
        />
      </div>

      <div>
        <label className="block text-[#191816] font-medium mb-1">Your Message or Stay Inquiries</label>
        <textarea
          rows={4}
          required
          value={message}
          placeholder="How can we assist your upcoming stay?"
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded text-white text-xs font-semibold bg-[#71382D] hover:bg-[#5A2C23] shadow-xs flex items-center justify-center gap-2 transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Send Message</span>
      </button>
    </form>
  );
}
