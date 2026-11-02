import { products as catalog } from '../data/products';

export const messages = {
  en: {
    nav: { home: 'Home', shop: 'Shop', collections: 'Collections', about: 'About', contact: 'Contact', main: 'Main navigation', logo: 'NOIR PERFUMES home' },
    search: 'Search', favorites: 'Favorites', cart: 'Cart', close: 'Close', add: 'Add to Cart', added: 'Added to cart', addDescription: 'The fragrance is in your bag.', viewProduct: 'View', productBottleAlt: 'perfume bottle',
    remove: 'Remove', removedFromCart: 'Removed from cart', removedFavorite: 'Removed from favorites', addedFavorite: 'Added to favorites', addFavorite: 'Add to favorites', removeFavorite: 'Remove from favorites', orderConfirmed: 'Order confirmed',
    emptyCart: 'Your bag is waiting for a signature scent.', emptyFavorites: 'No saved fragrances yet.', startShopping: 'Start shopping',
    subtotal: 'Subtotal', checkout: 'Checkout', name: 'Full name', phone: 'Phone number', address: 'Address', payment: 'Payment method',
    submitOrder: 'Place order', orderSuccess: 'Your order is confirmed. Thank you for choosing NOIR.', noResults: 'No fragrance found. Try another name or note.',
    switchToEnglish: 'Switch language to English', switchToArabic: 'Switch language to Arabic', switchToLight: 'Switch to light theme', switchToDark: 'Switch to dark theme',
    hero: { aria: 'NOIR PERFUMES new collection', collection: 'New collection', headline: 'Wear the', accent: 'Mystery.', description: 'A quiet signature. Impossible to forget.', shop: 'Shop now', explore: 'Explore collections', shipping: 'Free shipping', authentic: 'Authentic', gift: 'Gift wrapping', discover: 'Discover', discoverAria: 'Discover the fragrances' },
    products: { kicker: 'Find your signature', title: 'Scents with', accent: 'a story.', intro: 'Distinctive compositions, made to linger long after the moment.', filter: 'Filter fragrances', sort: 'Sort by', featured: 'Featured', low: 'Price: low to high', high: 'Price: high to low', none: 'No fragrances in this selection.', quickView: 'Quick view', bottleSize: 'Bottle size', quantity: 'Quantity', decrease: 'Decrease quantity', increase: 'Increase quantity', notes: { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' } },
    filters: { all: 'All', forHim: 'For Him', forHer: 'For Her', unisex: 'Unisex', oud: 'Oud', fresh: 'Fresh' },
    collections: { kicker: 'Explore by mood', title: 'The art of', accent: 'the accord.', intro: 'Three olfactive worlds. Each with its own point of view.', oud: 'Oud & Amber', floral: 'Floral', fresh: 'Fresh & Night', cards: [{ title: 'Oud & Amber', caption: 'Warmth, made unforgettable.' }, { title: 'Floral', caption: 'A softer kind of presence.' }, { title: 'Fresh & Night', caption: 'Light that lingers into dusk.' }] },
    promises: { aria: 'The Noir promise', items: [{ title: 'Long-lasting', copy: 'A signature that stays.' }, { title: 'Authentic', copy: 'Always the real thing.' }, { title: 'Fast delivery', copy: 'At your door, promptly.' }, { title: 'Gift packaging', copy: 'Ready for their moment.' }] },
    about: { kicker: 'The Noir point of view', title: 'Fragrance is a memory', accent: 'you choose to wear.', copy: 'At NOIR, we bring considered craft into the everyday. Each composition is a personal signature; each lingering trace, a story worth telling.' },
    mobile: { open: 'Open menu', close: 'Close menu', preferences: 'Your preferences', signoff: 'A trace that stays.' },
    quick: { searchTitle: 'Find your fragrance', searchDescription: 'Search by fragrance name or an olfactive note.', placeholder: 'Try oud, rose, musk…', cartDescription: 'Your shopping bag contents', savedDescription: 'Saved fragrances', deliveryTitle: 'Delivery details', deliveryDescription: 'Complete your order. Your details are not saved.', continue: 'Continue shopping', confirmation: 'A beautiful choice.' },
    paymentOptions: { card: 'Card', knet: 'KNET', cash: 'Cash on delivery' },
    footer: {
      line: 'A foundation for what lingers.',
      description: 'Considered fragrances, composed to become part of your story.',
      quickLinks: 'Explore NOIR',
      location: 'Visit us',
      openMaps: 'Open in Maps',
      phone: 'Call the boutique',
      whatsapp: 'Chat on WhatsApp',
      social: 'Follow the story',
      instagram: 'Instagram',
      contact: 'Write to us',
      contactDescription: 'Questions or a note for our team? We would love to hear from you.',
      name: 'Your name',
      email: 'Email address',
      message: 'Your message',
      send: 'Send message',
      success: 'Thank you. Your message is ready for our team.',
      hours: 'Working hours',
      payments: 'Payment methods',
      rights: 'All rights reserved.',
    },
  },
  ar: {
    nav: { home: 'الرئيسية', shop: 'تسوّق', collections: 'المجموعات', about: 'عنّا', contact: 'تواصل', main: 'التنقل الرئيسي', logo: 'الصفحة الرئيسية لعطور نوار' },
    search: 'بحث', favorites: 'المفضلة', cart: 'السلة', close: 'إغلاق', add: 'أضف إلى السلة', added: 'أضيف إلى السلة', addDescription: 'تمت إضافة العطر إلى حقيبتك.', viewProduct: 'عرض', productBottleAlt: 'زجاجة عطر',
    remove: 'إزالة', removedFromCart: 'أزيل العطر من السلة', removedFavorite: 'أزيل من المفضلة', addedFavorite: 'أضيف إلى المفضلة', addFavorite: 'أضف إلى المفضلة', removeFavorite: 'إزالة من المفضلة', orderConfirmed: 'تم تأكيد الطلب',
    emptyCart: 'سلتك بانتظار عطرك المفضل.', emptyFavorites: 'لم تحفظ أي عطر بعد.', startShopping: 'ابدأ التسوق',
    subtotal: 'المجموع', checkout: 'إتمام الطلب', name: 'الاسم الكامل', phone: 'رقم الهاتف', address: 'العنوان', payment: 'طريقة الدفع',
    submitOrder: 'تأكيد الطلب', orderSuccess: 'تم تأكيد طلبك. شكراً لاختيارك نوار.', noResults: 'لم نعثر على عطر بهذه الكلمات. جرّب اسماً أو نوتة أخرى.',
    switchToEnglish: 'تغيير اللغة إلى الإنجليزية', switchToArabic: 'تغيير اللغة إلى العربية', switchToLight: 'تفعيل المظهر الفاتح', switchToDark: 'تفعيل المظهر الداكن',
    hero: { aria: 'مجموعة عطور نوار الجديدة', collection: 'مجموعة جديدة', headline: 'ارتدِ', accent: 'الغموض.', description: 'عطرٌ يترك أثره، دون أن يطلب الانتباه.', shop: 'تسوّق الآن', explore: 'اكتشف المجموعات', shipping: 'شحن مجاني', authentic: 'أصلي', gift: 'تغليف هدايا', discover: 'اكتشف', discoverAria: 'اكتشف العطور' },
    products: { kicker: 'اكتشف توقيعك', title: 'عطور تُروى كحكاية.', accent: '', intro: 'تركيبات استثنائية، صُممت لتبقى في الذاكرة.', filter: 'تصفية العطور', sort: 'ترتيب حسب', featured: 'مميزة', low: 'السعر: الأقل أولاً', high: 'السعر: الأعلى أولاً', none: 'لا توجد عطور ضمن هذا الاختيار.', quickView: 'نظرة سريعة', bottleSize: 'حجم العبوة', quantity: 'الكمية', decrease: 'تقليل الكمية', increase: 'زيادة الكمية', notes: { top: 'المقدمة', heart: 'القلب', base: 'القاعدة' } },
    filters: { all: 'الكل', forHim: 'للرجال', forHer: 'للنساء', unisex: 'للجنسين', oud: 'عود', fresh: 'منعش' },
    collections: { kicker: 'عائلات عطرية', title: 'اختَر الأثر.', accent: '', intro: 'ثلاثة عوالم، لكل منها حكاية مختلفة.', oud: 'عود وعنبر', floral: 'زهري', fresh: 'منعش وليلي', cards: [{ title: 'عود وعنبر', caption: 'دفء لا يُنسى.' }, { title: 'زهري', caption: 'حضور أكثر رقة.' }, { title: 'منعش وليلي', caption: 'انتعاش يمتد حتى المساء.' }] },
    promises: { aria: 'مزايا نوار', items: [{ title: 'ثبات يدوم', copy: 'أثر يبقى معك.' }, { title: 'أصلي', copy: 'أصالة في كل تفصيل.' }, { title: 'توصيل سريع', copy: 'حتى بابك بكل سرعة.' }, { title: 'تغليف الهدايا', copy: 'جاهز ليُهدى.' }] },
    about: { kicker: 'عن نوار', title: 'نؤمن أن العطر', accent: 'هو ذاكرة تُرتدى.', copy: 'في نوار، نصنع عطوراً توازن بين الحرفية الرفيعة والروح المعاصرة. كل تركيبة توقيع شخصي، وكل أثر حكاية تستحق أن تُروى.' },
    mobile: { open: 'فتح القائمة', close: 'إغلاق القائمة', preferences: 'تفضيلاتك', signoff: 'أثر يبقى معك.' },
    quick: { searchTitle: 'ابحث عن عطرك', searchDescription: 'ابحث بالاسم أو بالنوتات العطرية.', placeholder: 'مثال: عود، ورد، مسك', cartDescription: 'محتويات حقيبة التسوق', savedDescription: 'العطور المحفوظة', deliveryTitle: 'تفاصيل التوصيل', deliveryDescription: 'أدخل بياناتك لإتمام الطلب. لن يتم حفظها.', continue: 'متابعة التسوق', confirmation: 'اختيار جميل.' },
    paymentOptions: { card: 'بطاقة', knet: 'كي نت', cash: 'الدفع عند الاستلام' },
    footer: {
      line: 'أساس لما يبقى في الذاكرة.',
      description: 'عطور مدروسة التكوين، لتصبح جزءاً من حكايتك.',
      quickLinks: 'اكتشف نوار',
      location: 'زورونا',
      openMaps: 'افتح الخريطة',
      phone: 'اتصل بالمتجر',
      whatsapp: 'تواصل عبر واتساب',
      social: 'تابع الحكاية',
      instagram: 'إنستغرام',
      contact: 'راسلنا',
      contactDescription: 'هل لديك سؤال أو رسالة لفريقنا؟ يسعدنا التواصل معك.',
      name: 'اسمك',
      email: 'البريد الإلكتروني',
      message: 'رسالتك',
      send: 'إرسال الرسالة',
      success: 'شكراً لك. تم تجهيز رسالتك لفريقنا.',
      hours: 'ساعات العمل',
      payments: 'طرق الدفع',
      rights: 'جميع الحقوق محفوظة.',
    },
  },
} as const;

type ProductCopy = {
  name: string;
  concentration: string;
  description: string;
  notes: Record<'top' | 'heart' | 'base', string[]>;
  noteHighlights: string[];
  badge: string | null;
};
export const productMessages = Object.fromEntries(catalog.map((product) => [
  product.id,
  {
    en: {
      name: product.name.en, concentration: product.concentration.en, description: product.description.en,
      notes: { top: product.notes.top.en, heart: product.notes.heart.en, base: product.notes.base.en },
      noteHighlights: product.noteHighlights.en, badge: product.badge?.en ?? null,
    },
    ar: {
      name: product.name.ar, concentration: product.concentration.ar, description: product.description.ar,
      notes: { top: product.notes.top.ar, heart: product.notes.heart.ar, base: product.notes.base.ar },
      noteHighlights: product.noteHighlights.ar, badge: product.badge?.ar ?? null,
    },
  },
])) as Record<string, Record<'en' | 'ar', ProductCopy>>;
