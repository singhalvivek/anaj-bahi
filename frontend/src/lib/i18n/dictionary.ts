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

  // ---- Phase 2 ----

  // payments
  'payment.title': 'Payments',
  'payment.add': '+ Add payment',
  'payment.amount': 'Amount (₹)',
  'payment.date': 'Payment date',
  'payment.note': 'Note (optional)',
  'payment.paid': 'Paid',
  'payment.outstanding': 'Outstanding',
  'payment.fullyPaid': 'Fully paid',
  'payment.advance': 'Advance',
  'payment.none': 'No payments yet',
  'payment.save': 'Save payment',

  // due date + list
  'dueDate.label': 'Due date',
  'due.title': 'Due',
  'due.overdue': 'Overdue',
  'due.soon': 'Due soon',
  'due.none': 'Nothing due',
  'due.due': 'Due',
  'due.outstanding': 'Outstanding',

  // edit-lock
  'lock.locked': "Locked — a payment was recorded; purchase details can't be changed",
  'lock.badge': 'Locked',

  // search
  'search.placeholder': 'Search by name or place',
  'search.grain': 'Grain',
  'search.date': 'Date',
  'search.all': 'All',
  'search.clear': 'Clear',
  'search.noResults': 'No bills match your search',

  // ---- Phase 3 ----

  // settings — business profile
  'settings.title': 'Settings',
  'settings.business': 'Business profile',
  'settings.businessHint': 'This appears as the header on shared receipts.',
  'settings.shopName': 'Shop name',
  'settings.traderName': 'Trader name',
  'settings.phone': 'Phone',
  'settings.address': 'Address (optional)',
  'settings.save': 'Save',
  'settings.saved': 'Saved',

  // receipt
  'receipt.title': 'Receipt',
  'receipt.billNo': 'Bill No.',
  'receipt.date': 'Date',
  'receipt.farmer': 'Farmer',
  'receipt.place': 'Place',
  'receipt.phone': 'Phone',
  'receipt.grain': 'Grain',
  'receipt.price': 'Price',
  'receipt.perQuintal': 'per quintal',
  'receipt.sacks': 'Sacks',
  'receipt.sack': 'Sack',
  'receipt.gross': 'Gross',
  'receipt.deduction': 'Deduction',
  'receipt.net': 'Net',
  'receipt.amount': 'Amount',
  'receipt.lineTotal': 'Line total',
  'receipt.total': 'Total',
  'receipt.kg': 'kg',
  'receipt.thanks': 'Thank you',

  // share as image
  'share.button': 'Share',
  'share.preview': 'Preview',
  'share.generating': 'Generating image…',
  'share.download': 'Download',
  'share.unsupported': 'Sharing not supported — use Download',
  'share.error': 'Could not create the image',
  'share.close': 'Close',

  // ---- Phase 4 — cloud sync ----
  'sync.title': 'Cloud backup',
  'sync.baseUrl': 'Backend URL',
  'sync.token': 'Device token',
  'sync.saveConfig': 'Save connection',
  'sync.configSaved': 'Connection saved',
  'sync.now': 'Back up now',
  'sync.syncing': 'Backing up…',
  'sync.lastSynced': 'Last backed up',
  'sync.never': 'Never',
  'sync.pending': 'Waiting to back up',
  'sync.restore': 'Restore from cloud',
  'sync.restoring': 'Restoring…',
  'sync.restored': 'Restore complete',
  'sync.restoreConfirm': 'Restore will merge cloud data into this device. Continue?',
  'sync.error.auth': 'Wrong device token — check it and try again',
  'sync.error.network': 'Backend unreachable — your data is safe on this phone',
  'sync.error.config': 'Add the backend URL and device token first',
  'sync.synced': 'Backed up',
  'sync.offlineOk': 'Works offline — backup runs when you are online',

  // ---- Phase 5 — quick-entry (summary) bills ----

  // new-bill chooser (/bills/choose)
  'choice.title': 'New Bill',
  'choice.fresh.title': 'Fresh bill',
  'choice.fresh.hint': 'Enter each sack weight',
  'choice.quick.title': 'Quick entry',
  'choice.quick.hint': 'From a bill already written on paper',

  // quick-entry summary form (/bills/quick)
  'quick.title': 'Quick Entry',
  'quick.totalWeight': 'Total weight (kg)',
  'quick.amount': 'Amount (₹)',
  'quick.sackCount': 'Total sacks',
  'quick.deductionKg': 'Deduction (kg)',
  'quick.amountHint': 'Amount as written on the paper bill',

  // quick-entry validation (in addition to the shared farmer/price rules)
  'validation.totalWeightRequired': 'Enter a total weight greater than 0',
  'validation.amountRequired': 'Enter an amount greater than 0',
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

  // ---- Phase 2 ----

  // payments
  'payment.title': 'भुगतान',
  'payment.add': '+ भुगतान जोड़ें',
  'payment.amount': 'राशि (₹)',
  'payment.date': 'भुगतान की तारीख',
  'payment.note': 'टिप्पणी (वैकल्पिक)',
  'payment.paid': 'चुकाया',
  'payment.outstanding': 'बकाया',
  'payment.fullyPaid': 'पूरा चुकता',
  'payment.advance': 'अग्रिम',
  'payment.none': 'अभी कोई भुगतान नहीं',
  'payment.save': 'भुगतान सहेजें',

  // due date + list
  'dueDate.label': 'देय तारीख',
  'due.title': 'बकाया',
  'due.overdue': 'समय बीता',
  'due.soon': 'जल्द देय',
  'due.none': 'कोई बकाया नहीं',
  'due.due': 'देय',
  'due.outstanding': 'बकाया',

  // edit-lock
  'lock.locked': 'बंद — भुगतान दर्ज हो चुका है; खरीद का विवरण नहीं बदला जा सकता',
  'lock.badge': 'बंद',

  // search
  'search.placeholder': 'नाम या जगह से खोजें',
  'search.grain': 'अनाज',
  'search.date': 'तारीख',
  'search.all': 'सभी',
  'search.clear': 'साफ़ करें',
  'search.noResults': 'आपकी खोज से कोई बही मेल नहीं खाती',

  // ---- Phase 3 ----

  // settings — business profile
  'settings.title': 'सेटिंग',
  'settings.business': 'व्यापार की जानकारी',
  'settings.businessHint': 'यह साझा की गई रसीद के शीर्ष पर दिखेगी।',
  'settings.shopName': 'दुकान का नाम',
  'settings.traderName': 'व्यापारी का नाम',
  'settings.phone': 'फ़ोन',
  'settings.address': 'पता (वैकल्पिक)',
  'settings.save': 'सहेजें',
  'settings.saved': 'सहेजा गया',

  // receipt
  'receipt.title': 'रसीद',
  'receipt.billNo': 'बही नंबर',
  'receipt.date': 'तारीख',
  'receipt.farmer': 'किसान',
  'receipt.place': 'जगह',
  'receipt.phone': 'फ़ोन',
  'receipt.grain': 'अनाज',
  'receipt.price': 'भाव',
  'receipt.perQuintal': 'प्रति क्विंटल',
  'receipt.sacks': 'बोरे',
  'receipt.sack': 'बोरा',
  'receipt.gross': 'कुल वज़न',
  'receipt.deduction': 'कटौती',
  'receipt.net': 'शुद्ध वज़न',
  'receipt.amount': 'राशि',
  'receipt.lineTotal': 'राशि',
  'receipt.total': 'कुल राशि',
  'receipt.kg': 'कि.ग्रा.',
  'receipt.thanks': 'धन्यवाद',

  // share as image
  'share.button': 'साझा करें',
  'share.preview': 'पूर्वावलोकन',
  'share.generating': 'तस्वीर बन रही है…',
  'share.download': 'डाउनलोड',
  'share.unsupported': 'साझा करना उपलब्ध नहीं — डाउनलोड करें',
  'share.error': 'तस्वीर नहीं बन सकी',
  'share.close': 'बंद करें',

  // ---- Phase 4 — cloud sync ----
  'sync.title': 'क्लाउड बैकअप',
  'sync.baseUrl': 'बैकएंड यूआरएल',
  'sync.token': 'डिवाइस टोकन',
  'sync.saveConfig': 'कनेक्शन सहेजें',
  'sync.configSaved': 'कनेक्शन सहेजा गया',
  'sync.now': 'अभी बैकअप लें',
  'sync.syncing': 'बैकअप हो रहा है…',
  'sync.lastSynced': 'पिछला बैकअप',
  'sync.never': 'कभी नहीं',
  'sync.pending': 'बैकअप बाकी',
  'sync.restore': 'क्लाउड से वापस लाएँ',
  'sync.restoring': 'वापस लाया जा रहा है…',
  'sync.restored': 'वापस लाना पूरा हुआ',
  'sync.restoreConfirm': 'वापस लाने पर क्लाउड डेटा इस डिवाइस में मिल जाएगा। जारी रखें?',
  'sync.error.auth': 'ग़लत डिवाइस टोकन — जाँचें और दोबारा कोशिश करें',
  'sync.error.network': 'बैकएंड नहीं मिला — आपका डेटा इस फ़ोन पर सुरक्षित है',
  'sync.error.config': 'पहले बैकएंड यूआरएल और डिवाइस टोकन भरें',
  'sync.synced': 'बैकअप हो गया',
  'sync.offlineOk': 'ऑफ़लाइन काम करता है — ऑनलाइन होने पर बैकअप होता है',

  // ---- Phase 5 — quick-entry (summary) bills ----

  // new-bill chooser (/bills/choose)
  'choice.title': 'नई बही',
  'choice.fresh.title': 'पूरी बही',
  'choice.fresh.hint': 'हर बोरे का वज़न भरें',
  'choice.quick.title': 'झटपट प्रविष्टि',
  'choice.quick.hint': 'काग़ज़ पर लिखी बही से',

  // quick-entry summary form (/bills/quick)
  'quick.title': 'झटपट बही',
  'quick.totalWeight': 'कुल वज़न (कि.ग्रा.)',
  'quick.amount': 'राशि (₹)',
  'quick.sackCount': 'कुल बोरे',
  'quick.deductionKg': 'कटौती (कि.ग्रा.)',
  'quick.amountHint': 'काग़ज़ की बही में लिखी राशि',

  // quick-entry validation (in addition to the shared farmer/price rules)
  'validation.totalWeightRequired': '0 से बड़ा कुल वज़न भरें',
  'validation.amountRequired': '0 से बड़ी राशि भरें',
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
