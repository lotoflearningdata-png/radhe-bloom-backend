// Add these products to your existing seed.js file
// Or run separately to add new category products

const newProducts = [
  // ── GIFT SETS ──────────────────────────────────────────
  {
    name: 'Kamal Cow Set',
    description: 'A divine combination of sacred cow and lotus — symbolizing prosperity and purity. Perfect for home mandir gifting and housewarming ceremonies.',
    price: 499, originalPrice: 699, category: 'gift-sets',
    colour: 'Multicolour', material: 'Wood', weight: '200 Gm', stock: 40, featured: true,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Kamal+Cow+Set'],
  },
  {
    name: 'Krishna Kamal Set',
    description: 'Lord Krishna with lotus in an exquisite wooden set — a blessed gifting choice for all occasions including birthdays, weddings and festivals.',
    price: 549, originalPrice: 799, category: 'gift-sets',
    colour: 'Multicolour', material: 'Wood', weight: '200 Gm', stock: 35, featured: true,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Krishna+Kamal+Set'],
  },
  {
    name: 'Rasoi Leela Set',
    description: 'Lord Krishna\'s iconic kitchen leela beautifully crafted in wood. A unique and thoughtful gift that captures the playful essence of Bal Krishna.',
    price: 599, originalPrice: 849, category: 'gift-sets',
    colour: 'Multicolour', material: 'Wood', weight: '250 Gm', stock: 30, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Rasoi+Leela+Set'],
  },
  {
    name: 'Vivha Khel Set',
    description: 'A beautiful wooden wedding play set — ideal for decoration at weddings, engagement ceremonies and gifting to newlyweds. Crafted with intricate detailing.',
    price: 649, originalPrice: 899, category: 'gift-sets',
    colour: 'Multicolour', material: 'Wood', weight: '300 Gm', stock: 25, featured: true,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Vivha+Khel+Set'],
  },

  // ── SUMMER COLLECTION ──────────────────────────────────
  {
    name: 'Kash Bangla',
    description: 'Natural kash grass decorative piece bringing fresh summer vibes to your sacred spaces. Unique, eco-friendly and beautiful for home décor.',
    price: 299, originalPrice: 449, category: 'summer',
    colour: 'Natural', material: 'Kash', weight: '150 Gm', stock: 50, featured: true, badge: 'Summer Special',
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Kash+Bangla'],
  },
  {
    name: 'Lotus Fountain',
    description: 'A beautiful lotus-shaped fountain for home and garden — creates a serene, divine atmosphere. Perfect for balcony, garden or meditation spaces.',
    price: 799, originalPrice: 1199, category: 'summer',
    colour: 'Multicolour', material: 'Plastic', dimensions: '30L x 30W x 20H CM', weight: '500 Gm', stock: 20, featured: true, badge: 'New Arrival',
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Lotus+Fountain'],
  },
  {
    name: 'Phool Petika',
    description: 'An elegant wooden flower basket — perfect summer décor for your home, office or sacred space. Handcrafted with intricate floral detailing.',
    price: 349, originalPrice: 499, category: 'summer',
    colour: 'Multicolour', material: 'Wood', weight: '200 Gm', stock: 40, featured: false, badge: 'Summer Pick',
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Phool+Petika'],
  },

  // ── CANDLES & FRAGRANCE ────────────────────────────────
  {
    name: 'Scented Pillar Candle',
    description: 'A classic pillar candle with divine fragrance — fills your home with calming aromas during puja, meditation or evening relaxation.',
    price: 199, originalPrice: 299, category: 'candles',
    colour: 'Cream', material: 'Wax', weight: '200 Gm', stock: 80, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Pillar+Candle'],
  },
  {
    name: 'Ladoo Candle',
    description: 'A playful ladoo-shaped scented candle — perfect for gifting at festivals, birthdays and pujas. Makes every occasion sweeter and more divine.',
    price: 149, originalPrice: 249, category: 'candles',
    colour: 'Multicolour', material: 'Wax', weight: '150 Gm', stock: 100, featured: true,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Ladoo+Candle'],
  },
  {
    name: 'Sunflower Scented Candle',
    description: 'A cheerful sunflower shaped candle with natural fragrance — brightens any space and makes a wonderful gifting choice for all occasions.',
    price: 179, originalPrice: 279, category: 'candles',
    colour: 'Yellow', material: 'Wax', weight: '180 Gm', stock: 90, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Sunflower+Candle'],
  },
  {
    name: 'Rose Attar Car Bottle',
    description: 'Premium rose fragrance attar in a beautiful car bottle — keeps your car, room or wardrobe smelling divine all day long.',
    price: 129, originalPrice: 199, category: 'candles',
    colour: 'Red', material: 'Glass', weight: '50 Gm', stock: 120, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Rose+Attar'],
  },
  {
    name: 'Guggal Incense Sticks',
    description: 'Premium Guggal fragrance incense sticks — used in temples and homes for centuries. Creates a spiritually uplifting atmosphere during puja and meditation.',
    price: 99, originalPrice: 149, category: 'candles',
    colour: 'Brown', material: 'Natural', weight: '100 Gm', stock: 200, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Incense+Sticks'],
  },
  {
    name: 'Attar Diffuser with Reed Sticks',
    description: 'A premium glass diffuser with natural attar fragrance — perfect for continuous fragrance in your home, office or sacred spaces.',
    price: 349, originalPrice: 499, category: 'candles',
    colour: 'Clear', material: 'Glass', weight: '200 Gm', stock: 50, featured: true,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Attar+Diffuser'],
  },
  {
    name: 'LED Candle Set',
    description: 'Safe, flameless LED candles perfect for decoration. Battery operated with realistic flame effect — ideal for homes with children and during festivals.',
    price: 249, originalPrice: 399, category: 'candles',
    colour: 'Cream', material: 'Plastic', weight: '200 Gm', stock: 60, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=LED+Candle'],
  },

  // ── RANGOLI & DÉCOR ────────────────────────────────────
  {
    name: 'Haldi Mehndi Shaadi Rangoli Mat',
    description: 'Readymade rangoli mat perfect for Haldi, Mehndi and wedding ceremonies. Beautiful floral design brings traditional charm to any festive occasion.',
    price: 249, originalPrice: 399, category: 'rangoli',
    colour: 'Multicolour', material: 'Metal', dimensions: '20L x 20W x 1H CM', weight: '200 Gm', stock: 45, featured: true,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Rangoli+Mat'],
  },
  {
    name: 'Radhe Radhe Wall Sticker (3 Pcs)',
    description: 'Beautiful handcrafted Radhe Radhe sticker set with Krishna and Radha in sequence. Decorate your doors, walls, pooja room for festivals and special occasions.',
    price: 99, originalPrice: 179, category: 'rangoli',
    colour: 'Multicolour', material: 'Sticker', dimensions: '2 CM', weight: '90 Gm', stock: 200, featured: false,
    images: ['https://placehold.co/600x600/f9f3e7/c9860a?text=Wall+Stickers'],
  },
]

module.exports = newProducts