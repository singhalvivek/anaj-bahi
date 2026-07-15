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

  // attribution (Phase 8)
  'attribution.createdBy': 'Created by',

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

  // ---- Phase 6 — phone auth, onboarding, gated home ----

  // login (phone + OTP)
  'auth.login.title': 'Sign in',
  'auth.phone.label': 'Phone number',
  'auth.phone.placeholder': '98765 43210',
  'auth.sendCode': 'Send code',
  'auth.sending': 'Sending code…',
  'auth.changeNumber': 'Change number',
  'auth.otp.label': 'Enter the code',
  'auth.otp.placeholder': '6-digit code',
  'auth.verify': 'Verify',
  'auth.verifying': 'Verifying…',

  // auth errors (mapped from Firebase error codes)
  'auth.error.invalidPhone': 'Enter a valid phone number with country code',
  'auth.error.invalidOtp': 'Wrong code — check it and try again',
  'auth.error.tooManyRequests': 'Too many attempts — wait a while and try again',
  'auth.error.network': 'No connection — check your internet and retry',
  'auth.error.generic': 'Could not sign in — please try again',

  // onboarding — name prompt
  'onboarding.name.title': 'What is your name?',
  'onboarding.name.label': 'Your name',
  'onboarding.name.continue': 'Continue',
  'onboarding.name.required': 'Please enter your name',

  // onboarding — role-free path chooser (New business / Business already registered)
  'onboarding.role.title': 'How will you use Anaj Bahi?',
  'onboarding.path.newBusiness': 'New business',
  'onboarding.path.existingBusiness': 'Business already registered',

  // onboarding — create business (owner)
  'onboarding.createBusiness.title': 'Create your business',
  'onboarding.createBusiness.shopName': 'Shop name',
  'onboarding.createBusiness.traderName': 'Trader name',
  'onboarding.createBusiness.phone': 'Business phone (optional)',
  'onboarding.createBusiness.address': 'Address (optional)',
  'onboarding.createBusiness.create': 'Create',
  'onboarding.createBusiness.creating': 'Creating…',
  'onboarding.createBusiness.shopRequired': 'Enter a shop name',

  // onboarding — employee not yet added ("ask your owner")
  'onboarding.askOwner.title': 'Ask your owner to add you',
  'onboarding.askOwner.explain':
    'Your owner needs to add your phone number to their business before you can join. Share the number below with them, then sign in again.',
  'onboarding.askOwner.yourPhone': 'Your phone number',
  'onboarding.askOwner.signOut': 'Sign out',

  // gated home header (name + business + sign out — NO role badge)
  'home.greeting': 'Namaste',
  'home.signOut': 'Sign out',

  // "shared cloud & roles — coming soon" banner
  'home.comingSoon.title': 'Shared cloud & roles — coming soon',
  'home.comingSoon.body':
    'Your bills are still saved on this phone for now. Sharing the ledger with your team across devices arrives in the next update.',

  // ---- Phase 6 slice-a — frozen key set consumed by the auth/onboarding UI (slices b/c) ----
  // ('auth.login.title' is defined above and intentionally not repeated.)

  // login screen
  'auth.login.phoneLabel': 'Phone number',
  'auth.login.phonePlaceholder': '98765 43210',
  'auth.login.sendCode': 'Send code',
  'auth.login.otpLabel': 'Enter the code',
  'auth.login.verify': 'Verify',
  'auth.login.sending': 'Sending code…',
  'auth.login.verifying': 'Verifying…',
  'auth.login.error': 'Could not sign in — please try again',

  // onboarding — name + role chooser
  'auth.onboarding.nameTitle': 'What is your name?',
  'auth.onboarding.nameLabel': 'Your name',
  'auth.onboarding.continue': 'Continue',
  'auth.onboarding.roleTitle': 'How will you use Anaj Bahi?',
  'auth.role.owner': 'I am an Owner',
  'auth.role.employee': 'I am an Employee',
  'auth.role.ownerHint': 'Create and run your own business ledger',
  'auth.role.employeeHint': 'Join a business your owner added you to',

  // onboarding — owner creates a business
  'auth.createBiz.title': 'Create your business',
  'auth.createBiz.shopLabel': 'Shop name',
  'auth.createBiz.create': 'Create',

  // onboarding — employee not yet added
  'auth.askOwner.title': 'Ask your owner to add you',
  'auth.askOwner.body':
    'Your owner needs to add your phone number to their business before you can join. Share your number with them, then sign in again.',

  // gated home — role badge + sign out + coming-soon banner + splash
  'auth.gated.role.owner': 'Owner',
  'auth.gated.role.employee': 'Employee',
  'auth.signOut': 'Sign out',
  'auth.comingSoon.cloud': 'Shared cloud & roles — coming soon',
  'auth.splash': 'Anaj Bahi',

  // ---- Phase 7 — local-first sync status (Firestore offline persistence) ----
  'syncStatus.title': 'Sync',
  'syncStatus.hint': 'Your ledger is saved on this phone and syncs automatically when you are online.',
  'syncStatus.online': 'Online',
  'syncStatus.offline': 'Offline',
  'syncStatus.pending': 'Saving your changes…',
  'syncStatus.synced': 'All changes saved',
  'syncStatus.syncNow': 'Sync now',
  'syncStatus.syncing': 'Syncing…',
  'syncStatus.syncedNow': 'Synced',

  // ---- Phase 8 — employee management (owner-only Employees screen) ----
  'employees.title': 'Members',
  'employees.addTitle': 'Add a member',
  'employees.phoneLabel': 'Phone number',
  'employees.nameLabel': 'Name',
  'employees.add': 'Add',
  'employees.adding': 'Adding…',
  'employees.existsError': 'That phone number already belongs to a business',
  'employees.rosterTitle': 'Members',
  'employees.empty': 'No employees yet — add one above',
  'employees.remove': 'Remove',
  'employees.removing': 'Removing…',
  'employees.ownerOnly': 'Only an owner or partner can manage members',
  'employees.roleOwner': 'Owner',
  'employees.rolePartner': 'Partner',
  'employees.roleEmployee': 'Employee',
  'employees.roleSelectLabel': 'Role',
  'employees.optionEmployee': 'Employee',
  'employees.optionPartner': 'Partner',
  'employees.back': 'Back',
  'employees.invited': 'Invited',
  'employees.active': 'Active',

  // ---- Phase 8 slice-c — personal profile + settings split ----
  'personal.title': 'Your profile',
  'personal.nameLabel': 'Your name',
  'personal.phoneLabel': 'Phone',
  'personal.save': 'Save name',
  'personal.saving': 'Saving…',
  'personal.saved': 'Name saved',
  'settings.employeesEntry': 'Manage members',
  'settings.businessReadonly': 'Only owners can edit the business profile',
  'settings.activityComingSoon': 'Activity log — coming soon',

  // ---- Phase 9 — owner-only activity log ----
  'activity.title': 'Activity log',
  'activity.empty': 'No activity yet',
  'activity.ownerOnly': 'Only an owner or partner can view the activity log',
  'activity.back': 'Back',
  'activity.action.billCreate': 'Created a bill',
  'activity.action.payment': 'Recorded a payment',
  'activity.action.billEdit': 'Edited a bill',
  'settings.activityEntry': 'Activity log',
  'settings.updateApp': 'Update app',
  'settings.updateAppHint': 'Get the latest version. Your saved bills stay safe.',
  'settings.updating': 'Updating…',
  'settings.version': 'Version',

  // ---- Phase 10 — paldari (labor charge) ----
  'paldari.label': 'Paldari (labour charge)',
  'paldari.short': 'Paldari',
  'paldari.hint': 'Loading/unloading charge borne by the farmer — reduces the bill total',
  'totals.subtotal': 'Subtotal',
  'quick.amountAuto': 'Auto-calculated — edit or cross-check',
  'receipt.subtotal': 'Subtotal',
  'receipt.paldari': 'Paldari',

  // ---- Google sign-in redesign — login + onboarding + invites + personal profile ----

  // login — Continue with Google
  'auth.google.button': 'Continue with Google',
  'auth.google.signingIn': 'Signing in…',
  'auth.error.popupClosed': 'Sign-in was cancelled — tap Continue with Google to try again',
  'auth.error.unauthorizedDomain': 'This site is not authorized for sign-in — contact support',

  // onboarding — name (prefilled from Google)
  'onboarding.name.fromGoogleHint': 'From your Google account — edit if you like',

  // onboarding — create business (owner): name + mobile
  'onboarding.createBusiness.nameLabel': 'Your name',
  'onboarding.createBusiness.nameRequired': 'Please enter your name',
  'onboarding.createBusiness.mobile': 'Mobile number',
  'onboarding.createBusiness.mobileRequired': 'Enter your mobile number',

  // onboarding — join by code (employee)
  'onboarding.join.title': 'Join your business',
  'onboarding.join.codeLabel': 'Invite code',
  'onboarding.join.codePlaceholder': '6-character code',
  'onboarding.join.codeHint': 'Ask your owner for the invite code they generated for you',
  'onboarding.join.next': 'Next',
  'onboarding.join.mobileLabel': 'Your mobile number',
  'onboarding.join.mobileHint': 'The same number your owner used on the invite',
  'onboarding.join.nameLabel': 'Your name',
  'onboarding.join.submit': 'Join',
  'onboarding.join.verifying': 'Checking…',
  'onboarding.join.joining': 'Joining…',
  'onboarding.join.notFound': 'Invalid or already-used code — check it and try again',
  'onboarding.join.phoneMismatch': "This number doesn't match the invite — check it with your owner",
  'onboarding.join.back': 'Back',
  'onboarding.join.signOut': 'Sign out',

  // employees — generate invite code + pending invites
  'employees.generateCode': 'Generate invite code',
  'employees.generating': 'Generating…',
  'employees.codeTitle': 'Share this invite code',
  'employees.codeShareHint': 'Share this code and the mobile number with your employee. They enter both to join.',
  'employees.copyCode': 'Copy code',
  'employees.copied': 'Copied',
  'employees.inviteMobile': 'Mobile number',
  'employees.pendingTitle': 'Pending invites',
  'employees.pendingEmpty': 'No pending invites',
  'employees.pendingAwaiting': 'Waiting for them to join',
  'employees.cancelInvite': 'Cancel',
  'employees.cancelling': 'Cancelling…',

  // personal profile — mobile + email
  'personal.mobileLabel': 'Mobile number',
  'personal.mobileHint': 'Profile information — not used to sign in',
  'personal.emailLabel': 'Email',
  'personal.emailReadonly': 'Your Google account — used to sign in',
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

  // attribution (Phase 8)
  'attribution.createdBy': 'द्वारा बनाया गया',

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

  // ---- Phase 6 — phone auth, onboarding, gated home ----

  // login (phone + OTP)
  'auth.login.title': 'साइन इन करें',
  'auth.phone.label': 'फ़ोन नंबर',
  'auth.phone.placeholder': '98765 43210',
  'auth.sendCode': 'कोड भेजें',
  'auth.sending': 'कोड भेजा जा रहा है…',
  'auth.changeNumber': 'नंबर बदलें',
  'auth.otp.label': 'कोड भरें',
  'auth.otp.placeholder': '6 अंकों का कोड',
  'auth.verify': 'पुष्टि करें',
  'auth.verifying': 'पुष्टि हो रही है…',

  // auth errors (mapped from Firebase error codes)
  'auth.error.invalidPhone': 'देश कोड के साथ सही फ़ोन नंबर भरें',
  'auth.error.invalidOtp': 'ग़लत कोड — जाँचें और दोबारा कोशिश करें',
  'auth.error.tooManyRequests': 'बहुत बार कोशिश — कुछ देर बाद फिर कोशिश करें',
  'auth.error.network': 'कनेक्शन नहीं — इंटरनेट जाँचें और दोबारा कोशिश करें',
  'auth.error.generic': 'साइन इन नहीं हो सका — फिर कोशिश करें',

  // onboarding — name prompt
  'onboarding.name.title': 'आपका नाम क्या है?',
  'onboarding.name.label': 'आपका नाम',
  'onboarding.name.continue': 'आगे बढ़ें',
  'onboarding.name.required': 'कृपया अपना नाम भरें',

  // onboarding — role chooser
  'onboarding.role.title': 'आप अनाज बही कैसे इस्तेमाल करेंगे?',
  'onboarding.path.newBusiness': 'व्यापार नया है',
  'onboarding.path.existingBusiness': 'व्यापार पहले से पंजीकृत है',

  // onboarding — create business (owner)
  'onboarding.createBusiness.title': 'अपना व्यापार बनाएँ',
  'onboarding.createBusiness.shopName': 'दुकान का नाम',
  'onboarding.createBusiness.traderName': 'व्यापारी का नाम',
  'onboarding.createBusiness.phone': 'व्यापार का फ़ोन (वैकल्पिक)',
  'onboarding.createBusiness.address': 'पता (वैकल्पिक)',
  'onboarding.createBusiness.create': 'बनाएँ',
  'onboarding.createBusiness.creating': 'बन रहा है…',
  'onboarding.createBusiness.shopRequired': 'दुकान का नाम भरें',

  // onboarding — employee not yet added ("ask your owner")
  'onboarding.askOwner.title': 'अपने मालिक से जोड़ने को कहें',
  'onboarding.askOwner.explain':
    'जुड़ने से पहले आपके मालिक को उनके व्यापार में आपका फ़ोन नंबर जोड़ना होगा। नीचे दिया नंबर उन्हें बताएँ, फिर दोबारा साइन इन करें।',
  'onboarding.askOwner.yourPhone': 'आपका फ़ोन नंबर',
  'onboarding.askOwner.signOut': 'साइन आउट',

  // gated home header (name + business + role + sign out)
  'home.greeting': 'नमस्ते',
  'home.signOut': 'साइन आउट',

  // "shared cloud & roles — coming soon" banner
  'home.comingSoon.title': 'साझा क्लाउड और भूमिकाएँ — जल्द आ रहा है',
  'home.comingSoon.body':
    'अभी आपकी बहियाँ इसी फ़ोन पर सुरक्षित हैं। कई डिवाइस पर अपनी टीम के साथ बही साझा करना अगले अपडेट में आएगा।',

  // ---- Phase 6 slice-a — frozen key set consumed by the auth/onboarding UI (slices b/c) ----

  // login screen
  'auth.login.phoneLabel': 'फ़ोन नंबर',
  'auth.login.phonePlaceholder': '98765 43210',
  'auth.login.sendCode': 'कोड भेजें',
  'auth.login.otpLabel': 'कोड भरें',
  'auth.login.verify': 'पुष्टि करें',
  'auth.login.sending': 'कोड भेजा जा रहा है…',
  'auth.login.verifying': 'पुष्टि हो रही है…',
  'auth.login.error': 'साइन इन नहीं हो सका — फिर कोशिश करें',

  // onboarding — name + role chooser
  'auth.onboarding.nameTitle': 'आपका नाम क्या है?',
  'auth.onboarding.nameLabel': 'आपका नाम',
  'auth.onboarding.continue': 'आगे बढ़ें',
  'auth.onboarding.roleTitle': 'आप अनाज बही कैसे इस्तेमाल करेंगे?',
  'auth.role.owner': 'मैं मालिक हूँ',
  'auth.role.employee': 'मैं कर्मचारी हूँ',
  'auth.role.ownerHint': 'अपनी बही बनाएँ और चलाएँ',
  'auth.role.employeeHint': 'जिस व्यापार में मालिक ने जोड़ा है उसमें शामिल हों',

  // onboarding — owner creates a business
  'auth.createBiz.title': 'अपना व्यापार बनाएँ',
  'auth.createBiz.shopLabel': 'दुकान का नाम',
  'auth.createBiz.create': 'बनाएँ',

  // onboarding — employee not yet added
  'auth.askOwner.title': 'अपने मालिक से जोड़ने को कहें',
  'auth.askOwner.body':
    'जुड़ने से पहले आपके मालिक को उनके व्यापार में आपका फ़ोन नंबर जोड़ना होगा। अपना नंबर उन्हें बताएँ, फिर दोबारा साइन इन करें।',

  // gated home — role badge + sign out + coming-soon banner + splash
  'auth.gated.role.owner': 'मालिक',
  'auth.gated.role.employee': 'कर्मचारी',
  'auth.signOut': 'साइन आउट',
  'auth.comingSoon.cloud': 'साझा क्लाउड और भूमिकाएँ — जल्द आ रहा है',
  'auth.splash': 'अनाज बही',

  // ---- Phase 7 — local-first sync status (Firestore offline persistence) ----
  'syncStatus.title': 'सिंक',
  'syncStatus.hint': 'आपकी बही इसी फ़ोन पर सुरक्षित है और ऑनलाइन होने पर अपने-आप सिंक होती है।',
  'syncStatus.online': 'ऑनलाइन',
  'syncStatus.offline': 'ऑफ़लाइन',
  'syncStatus.pending': 'आपके बदलाव सहेजे जा रहे हैं…',
  'syncStatus.synced': 'सभी बदलाव सहेजे गए',
  'syncStatus.syncNow': 'अभी सिंक करें',
  'syncStatus.syncing': 'सिंक हो रहा है…',
  'syncStatus.syncedNow': 'सिंक हो गया',

  // ---- Phase 8 — employee management (owner-only Employees screen) ----
  'employees.title': 'सदस्य',
  'employees.addTitle': 'सदस्य जोड़ें',
  'employees.phoneLabel': 'फ़ोन नंबर',
  'employees.nameLabel': 'नाम',
  'employees.add': 'जोड़ें',
  'employees.adding': 'जोड़ा जा रहा है…',
  'employees.existsError': 'यह फ़ोन नंबर पहले से किसी व्यापार से जुड़ा है',
  'employees.rosterTitle': 'सदस्य',
  'employees.empty': 'अभी कोई कर्मचारी नहीं — ऊपर से जोड़ें',
  'employees.remove': 'हटाएँ',
  'employees.removing': 'हटाया जा रहा है…',
  'employees.ownerOnly': 'केवल मालिक या साझेदार ही सदस्य प्रबंधित कर सकते हैं',
  'employees.roleOwner': 'मालिक',
  'employees.rolePartner': 'साझेदार',
  'employees.roleEmployee': 'कर्मचारी',
  'employees.roleSelectLabel': 'भूमिका',
  'employees.optionEmployee': 'कर्मचारी',
  'employees.optionPartner': 'साझेदार',
  'employees.back': 'वापस',
  'employees.invited': 'आमंत्रित',
  'employees.active': 'सक्रिय',

  // ---- Phase 8 slice-c — personal profile + settings split ----
  'personal.title': 'आपकी जानकारी',
  'personal.nameLabel': 'आपका नाम',
  'personal.phoneLabel': 'फ़ोन',
  'personal.save': 'नाम सहेजें',
  'personal.saving': 'सहेजा जा रहा है…',
  'personal.saved': 'नाम सहेजा गया',
  'settings.employeesEntry': 'सदस्य प्रबंधित करें',
  'settings.businessReadonly': 'केवल मालिक ही व्यापार की जानकारी बदल सकते हैं',
  'settings.activityComingSoon': 'गतिविधि लॉग — जल्द आ रहा है',

  // ---- Phase 9 — owner-only activity log ----
  'activity.title': 'गतिविधि लॉग',
  'activity.empty': 'अभी कोई गतिविधि नहीं',
  'activity.ownerOnly': 'केवल मालिक या साझेदार ही गतिविधि लॉग देख सकते हैं',
  'activity.back': 'वापस',
  'activity.action.billCreate': 'बही बनाई',
  'activity.action.payment': 'भुगतान दर्ज किया',
  'activity.action.billEdit': 'बही बदली',
  'settings.activityEntry': 'गतिविधि लॉग',
  'settings.updateApp': 'ऐप अपडेट करें',
  'settings.updateAppHint': 'नवीनतम संस्करण पाएँ। आपकी सहेजी बहियाँ सुरक्षित रहेंगी।',
  'settings.updating': 'अपडेट हो रहा है…',
  'settings.version': 'संस्करण',

  // ---- Phase 10 — paldari (labor charge) ----
  'paldari.label': 'पल्लेदारी (मज़दूरी)',
  'paldari.short': 'पल्लेदारी',
  'paldari.hint': 'किसान द्वारा वहन की गई चढ़ाई-उतराई मज़दूरी — बिल की राशि से घटती है',
  'totals.subtotal': 'उप-योग',
  'quick.amountAuto': 'अपने-आप जुड़ा — जाँचें या बदलें',
  'receipt.subtotal': 'उप-योग',
  'receipt.paldari': 'पल्लेदारी',

  // ---- Google sign-in redesign — login + onboarding + invites + personal profile ----

  // login — Continue with Google
  'auth.google.button': 'Google से जारी रखें',
  'auth.google.signingIn': 'साइन इन हो रहा है…',
  'auth.error.popupClosed': 'साइन इन रद्द हुआ — दोबारा कोशिश के लिए Google से जारी रखें दबाएँ',
  'auth.error.unauthorizedDomain': 'यह साइट साइन इन के लिए अधिकृत नहीं है — सहायता से संपर्क करें',

  // onboarding — name (prefilled from Google)
  'onboarding.name.fromGoogleHint': 'आपके Google खाते से — चाहें तो बदलें',

  // onboarding — create business (owner): name + mobile
  'onboarding.createBusiness.nameLabel': 'आपका नाम',
  'onboarding.createBusiness.nameRequired': 'कृपया अपना नाम भरें',
  'onboarding.createBusiness.mobile': 'मोबाइल नंबर',
  'onboarding.createBusiness.mobileRequired': 'अपना मोबाइल नंबर भरें',

  // onboarding — join by code (employee)
  'onboarding.join.title': 'अपने व्यापार में शामिल हों',
  'onboarding.join.codeLabel': 'आमंत्रण कोड',
  'onboarding.join.codePlaceholder': '6 अक्षरों का कोड',
  'onboarding.join.codeHint': 'अपने मालिक से वह आमंत्रण कोड लें जो उन्होंने आपके लिए बनाया है',
  'onboarding.join.next': 'आगे',
  'onboarding.join.mobileLabel': 'आपका मोबाइल नंबर',
  'onboarding.join.mobileHint': 'वही नंबर जो मालिक ने आमंत्रण पर डाला था',
  'onboarding.join.nameLabel': 'आपका नाम',
  'onboarding.join.submit': 'शामिल हों',
  'onboarding.join.verifying': 'जाँच हो रही है…',
  'onboarding.join.joining': 'शामिल हो रहे हैं…',
  'onboarding.join.notFound': 'ग़लत या पहले से इस्तेमाल हुआ कोड — जाँचें और दोबारा कोशिश करें',
  'onboarding.join.phoneMismatch': 'यह नंबर आमंत्रण से मेल नहीं खाता — अपने मालिक से जाँचें',
  'onboarding.join.back': 'वापस',
  'onboarding.join.signOut': 'साइन आउट',

  // employees — generate invite code + pending invites
  'employees.generateCode': 'आमंत्रण कोड बनाएँ',
  'employees.generating': 'बन रहा है…',
  'employees.codeTitle': 'यह आमंत्रण कोड साझा करें',
  'employees.codeShareHint': 'यह कोड और मोबाइल नंबर अपने कर्मचारी को दें। शामिल होने के लिए वे दोनों भरेंगे।',
  'employees.copyCode': 'कोड कॉपी करें',
  'employees.copied': 'कॉपी हुआ',
  'employees.inviteMobile': 'मोबाइल नंबर',
  'employees.pendingTitle': 'बाकी आमंत्रण',
  'employees.pendingEmpty': 'कोई बाकी आमंत्रण नहीं',
  'employees.pendingAwaiting': 'शामिल होने की प्रतीक्षा',
  'employees.cancelInvite': 'रद्द करें',
  'employees.cancelling': 'रद्द हो रहा है…',

  // personal profile — mobile + email
  'personal.mobileLabel': 'मोबाइल नंबर',
  'personal.mobileHint': 'प्रोफ़ाइल जानकारी — साइन इन के लिए इस्तेमाल नहीं होती',
  'personal.emailLabel': 'ईमेल',
  'personal.emailReadonly': 'आपका Google खाता — साइन इन के लिए इस्तेमाल होता है',
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
