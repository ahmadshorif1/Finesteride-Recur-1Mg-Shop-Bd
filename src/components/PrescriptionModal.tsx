import { FileCheck2, ShieldAlert, Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { isValidBangladeshPhone } from '../lib/validation';
import {
  submitPrescriptionReview,
  uploadPrivatePrescriptionFile,
} from '../services/pharmacyService';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  productIds: string[];
  productNames: string[];
  defaultCustomerName?: string;
  defaultPhone?: string;
  onSubmitted: (prescriptionId: string) => void;
}

export function PrescriptionModal({
  isOpen,
  onClose,
  productIds,
  productNames,
  defaultCustomerName = '',
  defaultPhone = '',
  onSubmitted,
}: PrescriptionModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [phone, setPhone] = useState(defaultPhone);
  const [doctorName, setDoctorName] = useState('');
  const [clinicOrHospital, setClinicOrHospital] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg(
        t(
          'প্রেসক্রিপশন জমা দিতে অনুগ্রহ করে একাউন্টে লগইন করুন।',
          'Please sign in to your account to submit a prescription.'
        )
      );
      return;
    }

    if (!isValidBangladeshPhone(phone)) {
      setErrorMsg(
        t(
          'সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।',
          'Please enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX).'
        )
      );
      return;
    }

    if (doctorName.trim().length < 2 || clinicOrHospital.trim().length < 2) {
      setErrorMsg(
        t(
          'চিকিৎসকের নাম এবং হাসপাতাল/চেম্বারের নাম উল্লেখ করুন।',
          'Please specify the prescribing doctor name and hospital/clinic.'
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      let storagePath = '';
      if (selectedFile) {
        const uploaded = await uploadPrivatePrescriptionFile(user.uid, selectedFile);
        storagePath = uploaded.storagePath;
      }

      const rxId = await submitPrescriptionReview({
        uid: user.uid,
        customerName: customerName || user.displayName || 'Customer',
        phone,
        productIds,
        doctorName,
        clinicOrHospital,
        prescriptionDate,
        storageFilePath: storagePath,
        notes,
      });

      onSubmitted(rxId);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('প্রেসক্রিপশন জমা দিতে সমস্যা হয়েছে।', 'Could not submit prescription.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 bg-[#0f5435] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-200" />
            <h3 className="text-base font-bold">
              {t('নিরাপদ প্রেসক্রিপশন জমা দিন', 'Submit Prescription Securely')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t('গোপনীয়তা ও ফার্মেসি নিরাপত্তা:', 'Privacy & Pharmacy Safeguard:')}
              </p>
              <p className="mt-0.5">
                {t(
                  'আপনার প্রেসক্রিপশন শুধুমাত্র অনুমোদিত ফার্মাসিস্ট/অ্যাডমিন যাচাই করবেন এবং কখনোই পাবলিকলি প্রদর্শিত হবে না।',
                  'Your prescription is reviewed exclusively by authorized pharmacists/admins and is never publicly accessible.'
                )}
              </p>
              {productNames.length > 0 && (
                <p className="mt-1 font-medium text-amber-800">
                  {t('Rx পণ্য:', 'Rx Items:')} {productNames.join(', ')}
                </p>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('রোগী / গ্রাহকের নাম *', 'Patient / Customer Name *')}
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('পূর্ণ নাম', 'Full name')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('মোবাইল নম্বর *', 'Mobile Number *')}
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('চিকিৎসকের নাম (BMDC নিবন্ধিত) *', 'Doctor Name (BMDC Registered) *')}
              </label>
              <input
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder={t('ডা. নাম...', 'Dr. Name...')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('হাসপাতাল / চেম্বার *', 'Hospital / Clinic *')}
              </label>
              <input
                type="text"
                required
                value={clinicOrHospital}
                onChange={(e) => setClinicOrHospital(e.target.value)}
                placeholder={t('হাসপাতাল বা ক্লিনিকের নাম', 'Hospital or chamber name')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('প্রেসক্রিপশনের তারিখ *', 'Prescription Date *')}
            </label>
            <input
              type="date"
              required
              value={prescriptionDate}
              onChange={(e) => setPrescriptionDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t(
                'প্রেসক্রিপশন ছবি বা PDF (সর্বোচ্চ ৮MB)',
                'Prescription Image or PDF (Max 8MB)'
              )}
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-[#f2f8f5] hover:border-[#146c43] cursor-pointer transition-colors text-xs text-slate-600">
              <Upload className="w-4 h-4 text-[#146c43]" />
              <span className="truncate">
                {selectedFile
                  ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`
                  : t('ছবি (JPG/PNG) বা PDF নির্বাচন করুন', 'Select Image (JPG/PNG) or PDF')}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('অতিরিক্ত তথ্য / প্রেসক্রিপশন নোট', 'Additional Info / Prescription Notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                'চিকিৎসকের রেজিস্ট্রেশন নম্বর বা বিশেষ নির্দেশনা থাকলে লিখুন...',
                'Include BMDC registration number or special notes if any...'
              )}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#146c43]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t('বাতিল', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting
                ? t('জমা হচ্ছে...', 'Submitting...')
                : t('প্রেসক্রিপশন জমা দিন', 'Submit Prescription')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
