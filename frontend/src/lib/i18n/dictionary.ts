// Typed EN + HI string dictionary for all Phase-1 UI. Devanagari for Hindi.
// Numbers, ₹, kg and dates are locale-neutral (Western digits) in both languages —
// only labels translate. Components must read every user-facing string via t(key).

export type Lang = 'hi' | 'en'

// Every Phase-1 UI key. Both languages MUST define each key (enforced by the
// Record<TKey, string> typing below) so no missing-key fallback ever shows.
export const EN = {
  // app + nav
  'app.title': 'Anaj Bahi',
  'nav.bills': 'Bills',
  'nav.due': 'Due',
  'nav.settings': 'Settings',
  'nav.share': 'Share',

  // language toggle
  'lang.hi': 'हिं',
  'lang.en': 'EN',
  'lang.toggle': 'Language',

  // bill list / home
  'bills.title': 'Bills',
  'bills.new': '+ New Bill',
  'bills.empty': 'No bills yet — tap + New Bill',
  'bills.total': 'Total',
  'bills.card.date': 'Date',

  // new bill — farmer
  'newbill.title': 'New Bill',
  'farmer.label': 'Farmer',
  'farmer.name': 'Farmer name',
  'farmer.place': 'Place / Village',
  'farmer.phone': 'Phone (optional)',
  'farmer.add': 'Add farmer',
  'farmer.new': 'New farmer',
  'farmer.searchHint': 'Type a farmer name',

  // new bill — date & id
  'purchaseDate.label': 'Purchase date',
  'billId.label': 'Bill ID',

  // grain line
  'grain.type': 'Grain type',
  'grain.addCustom': 'Add custom grain',
  'grain.price': 'Price per quintal (₹)',
  'grain.line': 'Grain',
  'grain.addAnother': '+ Add another grain',

  // sack entry
  'sack.summary': 'Sacks',
  'sack.total': 'Total',
  'sack.input': 'Sack weight (kg)',
  'sack.add': 'Add',
  'sack.count': 'Count',
  'sack.remove': 'Remove',

  // deductions
  'deduction.label': 'Deductions',
  'deduction.add': '+ Add deduction',
  'deduction.value': 'Value',
  'deduction.remove': 'Remove',
  'deduction.basis.per_sack_kg': 'kg per sack',
  'deduction.basis.per_quintal_kg': 'kg per quintal',
  'deduction.basis.percent_gross': '% of gross',
  'deduction.basis.flat_kg': 'flat kg',

  // totals
  'totals.gross': 'Gross weight',
  'totals.deduction': 'Deduction',
  'totals.net': 'Net weight',
  'totals.lineAmount': 'Line amount',
  'totals.billTotal': 'Bill total',

  // actions
  'action.save': 'Save',
  'action.saving': 'Saving…',
  'action.edit': 'Edit',
  'action.back': 'Back',

  // detail
  'detail.title': 'Bill',
  'detail.farmer': 'Farmer',
  'detail.phone': 'Phone',

  // validation
  'validation.farmerRequired': 'Choose or add a farmer',
  'validation.lineRequired': 'Add at least one grain line',
  'validation.sackRequired': 'Add at least one sack',
  'validation.priceRequired': 'Enter a price greater than 0',

  // stubs — coming soon
  'stub.comingSoon': 'Coming soon',
  'stub.payments': 'Payments',
  'stub.due': 'Due',
  'stub.share': 'Share as image',
  'stub.sync': 'Cloud sync',
  'stub.search': 'Search / Filter',

  // errors / storage
  'error.storage': 'Storage unavailable — enable site data',
  'error.generic': 'Something went wrong',
} as const

export type TKey = keyof typeof EN

export const HI: Record<TKey, string> = {
  // app + nav
  'app.title': 'अनाज बही',
  'nav.bills': 'बहियाँ',
  'nav.due': 'बकाया',
  'nav.settings': 'सेटिंग',
  'nav.share': 'साझा करें',

  // language toggle
  'lang.hi': 'हिं',
  'lang.en': 'EN',
  'lang.toggle': 'भाषा',

  // bill list / home
  'bills.title': 'बहियाँ',
  'bills.new': '+ नई बही',
  'bills.empty': 'अभी कोई बही नहीं — + नई बही दबाएँ',
  'bills.total': 'कुल',
  'bills.card.date': 'तारीख',

  // new bill — farmer
  'newbill.title': 'नई बही',
  'farmer.label': 'किसान',
  'farmer.name': 'किसान का नाम',
  'farmer.place': 'गाँव / जगह',
  'farmer.phone': 'फ़ोन (वैकल्पिक)',
  'farmer.add': 'किसान जोड़ें',
  'farmer.new': 'नया किसान',
  'farmer.searchHint': 'किसान का नाम लिखें',

  // new bill — date & id
  'purchaseDate.label': 'खरीद तारीख',
  'billId.label': 'बही नंबर',

  // grain line
  'grain.type': 'अनाज',
  'grain.addCustom': 'नया अनाज जोड़ें',
  'grain.price': 'भाव प्रति क्विंटल (₹)',
  'grain.line': 'अनाज',
  'grain.addAnother': '+ और अनाज जोड़ें',

  // sack entry
  'sack.summary': 'बोरे',
  'sack.total': 'कुल',
  'sack.input': 'बोरे का वज़न (कि.ग्रा.)',
  'sack.add': 'जोड़ें',
  'sack.count': 'गिनती',
  'sack.remove': 'हटाएँ',

  // deductions
  'deduction.label': 'कटौती',
  'deduction.add': '+ कटौती जोड़ें',
  'deduction.value': 'मान',
  'deduction.remove': 'हटाएँ',
  'deduction.basis.per_sack_kg': 'कि.ग्रा. प्रति बोरा',
  'deduction.basis.per_quintal_kg': 'कि.ग्रा. प्रति क्विंटल',
  'deduction.basis.percent_gross': 'कुल का %',
  'deduction.basis.flat_kg': 'सीधे कि.ग्रा.',

  // totals
  'totals.gross': 'कुल वज़न',
  'totals.deduction': 'कटौती',
  'totals.net': 'शुद्ध वज़न',
  'totals.lineAmount': 'राशि',
  'totals.billTotal': 'बही की कुल राशि',

  // actions
  'action.save': 'सहेजें',
  'action.saving': 'सहेजा जा रहा है…',
  'action.edit': 'बदलें',
  'action.back': 'वापस',

  // detail
  'detail.title': 'बही',
  'detail.farmer': 'किसान',
  'detail.phone': 'फ़ोन',

  // validation
  'validation.farmerRequired': 'किसान चुनें या जोड़ें',
  'validation.lineRequired': 'कम से कम एक अनाज जोड़ें',
  'validation.sackRequired': 'कम से कम एक बोरा जोड़ें',
  'validation.priceRequired': '0 से बड़ा भाव भरें',

  // stubs — coming soon
  'stub.comingSoon': 'जल्द आ रहा है',
  'stub.payments': 'भुगतान',
  'stub.due': 'बकाया',
  'stub.share': 'तस्वीर के रूप में साझा करें',
  'stub.sync': 'क्लाउड सिंक',
  'stub.search': 'खोज / छाँटें',

  // errors / storage
  'error.storage': 'स्टोरेज उपलब्ध नहीं — साइट डेटा चालू करें',
  'error.generic': 'कुछ गड़बड़ हो गई',
}

export const DICTIONARIES: Record<Lang, Record<TKey, string>> = {
  en: EN,
  hi: HI,
}

/** Translate a key for a language; falls back to the key itself if somehow missing. */
export function translate(lang: Lang, key: string): string {
  const dict = DICTIONARIES[lang]
  return (dict as Record<string, string>)[key] ?? key
}
