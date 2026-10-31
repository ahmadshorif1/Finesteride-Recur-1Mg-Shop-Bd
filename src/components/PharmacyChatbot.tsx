import {
  Bot,
  ChevronDown,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export function PharmacyChatbot() {
  const { lang, t } = useLanguage();
  const { catalogProducts, siteSettings } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize welcoming message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          role: 'model',
          text:
            lang === 'en'
              ? 'Hello! I am your AI Health Assistant. Ask me about products, generic names, prices, delivery charges, or prescription requirements!'
              : 'হ্যালো! আমি Finesteride Recur 1Mg Shop Bd এর স্বাস্থ্য সেবা এআই সহকারী। যেকোনো ঔষধ, ডেলিভারি চার্জ, সার্ভিস বা প্রেসক্রিপশন জমা দেওয়ার নিয়ম জানতে আমাকে প্রশ্ন করুন!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [lang]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (customQuery?: string) => {
    const textToSend = (customQuery || inputText).trim();
    if (!textToSend || isTyping) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customQuery) setInputText('');
    setIsTyping(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          language: lang,
          siteInfo: {
            brandName: siteSettings.brandName,
            supportPhone: siteSettings.supportPhone,
            supportEmail: siteSettings.supportEmail,
            supportHours: siteSettings.supportHours,
            insideDhakaFee: siteSettings.insideDhakaFee,
            outsideDhakaFee: siteSettings.outsideDhakaFee,
            freeDeliveryThreshold: siteSettings.freeDeliveryThreshold,
          },
          catalogProducts: catalogProducts.slice(0, 35).map((p) => ({
            name: p.name,
            nameBn: p.nameBn,
            brand: p.brand,
            genericName: p.genericName,
            price: p.price,
            stockQuantity: p.stockQuantity,
            requiresPrescription: p.requiresPrescription,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI response');
      }

      const data = await response.json();
      const botReply = data.text || t('দুঃখিত, বর্তমানে কোনো উত্তর পাওয়া যায়নি।', 'Sorry, no response received.');

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setErrorMsg(
        t('উত্তর পেতে সমস্যা হয়েছে। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।', 'Error connecting to AI service. Please try again.')
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text:
          lang === 'en'
            ? 'Conversation reset. How can I help you today?'
            : 'চ্যাট হিস্ট্রি রিসেট করা হয়েছে। আমি আপনাকে কিভাবে সাহায্য করতে পারি?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setErrorMsg(null);
  };

  const quickQuestions = lang === 'en'
    ? [
        'Finasteride 1mg price & stock?',
        'Delivery charges & timelines?',
        'How to upload prescription?',
        'Payment options (COD/bKash)?',
      ]
    : [
        'ফিনাস্টারাইড এর মূল্য ও কাজ কি?',
        'ডেলিভারি চার্জ ও সময় কত?',
        'প্রেসক্রিপশন কিভাবে আপলোড করবো?',
        'পেমেন্ট অপশন কি কি আছে?',
      ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {/* 1. Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#146c43] hover:bg-[#0f5435] text-white shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer active:scale-95"
          aria-label="Open AI Health Assistant Chatbot"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-6 h-6 animate-pulse text-emerald-200" />
            <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1 -right-1" />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-tight">
            {t('স্বাস্থ্য এআই সহায়ক', 'AI Health Assistant')}
          </span>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
        </button>
      )}

      {/* 2. Chat Modal / Drawer */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[380px] h-[520px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-[#0f5435] text-white p-3.5 flex items-center justify-between border-b border-emerald-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-800/80 border border-emerald-600/50 relative">
                <Bot className="w-5 h-5 text-emerald-200" />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0f5435]" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">
                  {t('স্বাস্থ্য সেবা এআই সহকারী', 'Health Care AI Assistant')}
                </h3>
                <p className="text-[11px] text-emerald-200/90 font-medium">
                  {t('২৪/৭ লাইভ উত্তর প্রদানকারী', '24/7 Live Pharmacy Bot')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title={t('নতুন চ্যাট শুরু করুন', 'Reset Chat')}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={t('বন্ধ করুন', 'Close')}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#f8faf9]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 text-xs ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'model' && (
                  <div className="w-7 h-7 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#146c43] text-white rounded-br-none shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none shadow-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`block text-[10px] mt-1 text-right ${
                      msg.role === 'user' ? 'text-emerald-200/80' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-7 h-7 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl rounded-bl-none flex items-center gap-1.5 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#146c43]" />
                  <span>{t('উত্তর তৈরি করা হচ্ছে...', 'AI is thinking...')}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
                <p>{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  className="mt-1.5 px-3 py-1 bg-red-600 text-white rounded-md text-[11px] font-bold hover:bg-red-700 transition-colors cursor-pointer"
                >
                  {t('পুনরায় চেষ্টা করুন', 'Retry')}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 overflow-x-auto whitespace-nowrap flex gap-1.5 scrollbar-none">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSend(q)}
                disabled={isTyping}
                className="px-2.5 py-1 rounded-full bg-[#edf6f1] hover:bg-[#d8ece0] text-[#0f5435] text-[11px] font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              placeholder={t('এখানে আপনার প্রশ্ন লিখুন...', 'Ask a question here...')}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#146c43] focus:bg-white text-slate-900 placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputText.trim() || isTyping}
              aria-label="Send message"
              className="p-2 rounded-xl bg-[#146c43] hover:bg-[#0f5435] disabled:bg-slate-300 text-white transition-colors cursor-pointer shrink-0"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
