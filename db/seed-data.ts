/**
 * Placeholder seed data transcribed from docs/data/demo-seed-data.xlsx.
 * DO NOT use for real sales — replace with real owner data before launch.
 */

// ---------- Staff ----------
export const seedStaff = [{ name: "Owner", role: "owner" as const, pin: "1111" }] as const;

// ---------- Categories ----------
export const seedCategories = [
  { nameAr: "بابل تي", nameEn: "Bubble Tea", sortOrder: 1 },
  { nameAr: "شاي فواكه", nameEn: "Fruit Tea", sortOrder: 2 },
  { nameAr: "شاي كريمة الجبن", nameEn: "Cheese Foam Tea", sortOrder: 3 },
  { nameAr: "بان كيك ياباني", nameEn: "Japanese Soufflé Pancakes", sortOrder: 4 },
  { nameAr: "بينجسو كوري", nameEn: "Korean Bingsu", sortOrder: 5 },
  { nameAr: "كروفل كوري", nameEn: "Korean Croffle", sortOrder: 6 },
  { nameAr: "حلويات آسيوية", nameEn: "Asian Desserts", sortOrder: 7 },
] as const;

// ---------- Products ----------
export const seedProducts = [
  {
    nameAr: "ميلك تي كلاسيك",
    nameEn: "Classic Milk Tea",
    categoryEn: "Bubble Tea",
    basePrice: 15,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "ميلك تي بالسكر البني",
    nameEn: "Brown Sugar Milk Tea",
    categoryEn: "Bubble Tea",
    basePrice: 18,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "ميلك تي التارو",
    nameEn: "Taro Milk Tea",
    categoryEn: "Bubble Tea",
    basePrice: 17,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "ميلك تي الماتشا",
    nameEn: "Matcha Milk Tea",
    categoryEn: "Bubble Tea",
    basePrice: 18,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "شاي فاكهة الآلام",
    nameEn: "Passion Fruit Tea",
    categoryEn: "Fruit Tea",
    basePrice: 16,
    image: "icon-fruittea.svg",
  },
  {
    nameAr: "شاي الفراولة",
    nameEn: "Strawberry Fruit Tea",
    categoryEn: "Fruit Tea",
    basePrice: 16,
    image: "icon-fruittea.svg",
  },
  {
    nameAr: "شاي المانجو",
    nameEn: "Mango Fruit Tea",
    categoryEn: "Fruit Tea",
    basePrice: 16,
    image: "icon-fruittea.svg",
  },
  {
    nameAr: "شاي ياسمين بكريمة الجبن",
    nameEn: "Cheese Foam Jasmine Tea",
    categoryEn: "Cheese Foam Tea",
    basePrice: 19,
    image: "icon-cheesefoam.svg",
  },
  {
    nameAr: "ماتشا بكريمة الجبن",
    nameEn: "Cheese Foam Matcha",
    categoryEn: "Cheese Foam Tea",
    basePrice: 20,
    image: "icon-cheesefoam.svg",
  },
  {
    nameAr: "بان كيك سوفليه كلاسيك",
    nameEn: "Classic Soufflé Pancake",
    categoryEn: "Japanese Soufflé Pancakes",
    basePrice: 22,
    image: "icon-souffle.svg",
  },
  {
    nameAr: "بان كيك سوفليه فراولة",
    nameEn: "Strawberry Soufflé Pancake",
    categoryEn: "Japanese Soufflé Pancakes",
    basePrice: 26,
    image: "icon-souffle.svg",
  },
  {
    nameAr: "بان كيك سوفليه نوتيلا",
    nameEn: "Nutella Soufflé Pancake",
    categoryEn: "Japanese Soufflé Pancakes",
    basePrice: 26,
    image: "icon-souffle.svg",
  },
  {
    nameAr: "بينجسو المانجو",
    nameEn: "Mango Bingsu",
    categoryEn: "Korean Bingsu",
    basePrice: 28,
    image: "icon-bingsu.svg",
  },
  {
    nameAr: "بينجسو إنجولمي",
    nameEn: "Injeolmi Bingsu",
    categoryEn: "Korean Bingsu",
    basePrice: 26,
    image: "icon-bingsu.svg",
  },
  {
    nameAr: "بينجسو الشوكولاتة",
    nameEn: "Chocolate Bingsu",
    categoryEn: "Korean Bingsu",
    basePrice: 28,
    image: "icon-bingsu.svg",
  },
  {
    nameAr: "كروفل أصلي",
    nameEn: "Original Croffle",
    categoryEn: "Korean Croffle",
    basePrice: 20,
    image: "icon-croffle.svg",
  },
  {
    nameAr: "كروفل بالآيسكريم",
    nameEn: "Ice Cream Croffle",
    categoryEn: "Korean Croffle",
    basePrice: 24,
    image: "icon-croffle.svg",
  },

  // ── Spec six (C4) — featured products for the digital menu ──
  {
    nameAr: "براون شوغر بابل تي",
    nameEn: "Brown Sugar Bubble Tea",
    categoryEn: "Bubble Tea",
    basePrice: 18,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "تارو كلاسيك",
    nameEn: "Taro Classic",
    categoryEn: "Bubble Tea",
    basePrice: 17,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "ماتشا لاتيه",
    nameEn: "Matcha Latte",
    categoryEn: "Bubble Tea",
    basePrice: 18,
    image: "icon-bubbletea.svg",
  },
  {
    nameAr: "شاي التوت الفوّار",
    nameEn: "Sparkling Berry Tea",
    categoryEn: "Fruit Tea",
    basePrice: 16,
    image: "icon-fruittea.svg",
  },
  {
    nameAr: "قطع الموتشي",
    nameEn: "Mochi Bites",
    categoryEn: "Asian Desserts",
    basePrice: 15,
    image: "icon-souffle.svg",
  },
  {
    nameAr: "ميني وافل نوتيلا",
    nameEn: "Mini Nutella Waffle",
    categoryEn: "Asian Desserts",
    basePrice: 18,
    image: "icon-croffle.svg",
  },
] as const;

// ---------- Modifiers ----------
export const seedModifiers = [
  // Bubble Tea products (all 4 have same modifier structure)
  {
    productEn: "Classic Milk Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Classic Milk Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Classic Milk Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Classic Milk Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  {
    productEn: "Brown Sugar Milk Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Brown Sugar Milk Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Brown Sugar Milk Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Brown Sugar Milk Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  {
    productEn: "Taro Milk Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Taro Milk Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Taro Milk Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Taro Milk Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  {
    productEn: "Matcha Milk Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Matcha Milk Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Matcha Milk Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Matcha Milk Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  // Fruit Tea products
  {
    productEn: "Passion Fruit Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Passion Fruit Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Passion Fruit Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Passion Fruit Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  {
    productEn: "Strawberry Fruit Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Strawberry Fruit Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Strawberry Fruit Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Strawberry Fruit Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  {
    productEn: "Mango Fruit Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Mango Fruit Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Mango Fruit Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Mango Fruit Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  // Cheese Foam Tea
  {
    productEn: "Cheese Foam Jasmine Tea",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Cheese Foam Jasmine Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Cheese Foam Jasmine Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Cheese Foam Jasmine Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  {
    productEn: "Cheese Foam Matcha",
    group: "Size",
    type: "single",
    required: false,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Cheese Foam Matcha",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0%", name: "0%", delta: 0 },
      { nameAr: "25%", name: "25%", delta: 0 },
      { nameAr: "50%", name: "50%", delta: 0 },
      { nameAr: "75%", name: "75%", delta: 0 },
      { nameAr: "100%", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Cheese Foam Matcha",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Cheese Foam Matcha",
    group: "Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  // Desserts — lighter modifier model (extra toppings only, no size/sugar/ice)
  {
    productEn: "Classic Soufflé Pancake",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Strawberry Soufflé Pancake",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Nutella Soufflé Pancake",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Mango Bingsu",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Injeolmi Bingsu",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Chocolate Bingsu",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Original Croffle",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },
  {
    productEn: "Ice Cream Croffle",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    options: [
      { nameAr: "سكوب آيس كريم إضافي", name: "Extra Ice Cream Scoop", delta: 5 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 4 },
      { nameAr: "صوص إضافي", name: "Extra Drizzle", delta: 3 },
    ],
  },

  // ── Spec six (C4) modifier groups with a multi-optional MAX capped group ──

  // Brown Sugar Bubble Tea — full bubble-tea model; Toppings capped at 3.
  {
    productEn: "Brown Sugar Bubble Tea",
    group: "Size",
    type: "single",
    required: true,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Brown Sugar Bubble Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0٪", name: "0%", delta: 0 },
      { nameAr: "25٪", name: "25%", delta: 0 },
      { nameAr: "50٪", name: "50%", delta: 0 },
      { nameAr: "75٪", name: "75%", delta: 0 },
      { nameAr: "100٪", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Brown Sugar Bubble Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Brown Sugar Bubble Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    max: 3,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  // Taro Classic — same model; Toppings capped at 3.
  {
    productEn: "Taro Classic",
    group: "Size",
    type: "single",
    required: true,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Taro Classic",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0٪", name: "0%", delta: 0 },
      { nameAr: "25٪", name: "25%", delta: 0 },
      { nameAr: "50٪", name: "50%", delta: 0 },
      { nameAr: "75٪", name: "75%", delta: 0 },
      { nameAr: "100٪", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Taro Classic",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Taro Classic",
    group: "Toppings",
    type: "multi",
    required: false,
    max: 3,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  // Matcha Latte — same model; Toppings capped at 3.
  {
    productEn: "Matcha Latte",
    group: "Size",
    type: "single",
    required: true,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Matcha Latte",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0٪", name: "0%", delta: 0 },
      { nameAr: "25٪", name: "25%", delta: 0 },
      { nameAr: "50٪", name: "50%", delta: 0 },
      { nameAr: "75٪", name: "75%", delta: 0 },
      { nameAr: "100٪", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Matcha Latte",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Matcha Latte",
    group: "Toppings",
    type: "multi",
    required: false,
    max: 3,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
      { nameAr: "فاصوليا حمراء", name: "Red Bean", delta: 2 },
    ],
  },

  // Sparkling Berry Tea — fruit tea model; Toppings capped at 3.
  {
    productEn: "Sparkling Berry Tea",
    group: "Size",
    type: "single",
    required: true,
    options: [
      { nameAr: "عادي", name: "Regular", delta: 0 },
      { nameAr: "كبير", name: "Large", delta: 3 },
    ],
  },
  {
    productEn: "Sparkling Berry Tea",
    group: "Sugar Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "0٪", name: "0%", delta: 0 },
      { nameAr: "25٪", name: "25%", delta: 0 },
      { nameAr: "50٪", name: "50%", delta: 0 },
      { nameAr: "75٪", name: "75%", delta: 0 },
      { nameAr: "100٪", name: "100%", delta: 0 },
    ],
  },
  {
    productEn: "Sparkling Berry Tea",
    group: "Ice Level",
    type: "single",
    required: false,
    options: [
      { nameAr: "بدون ثلج", name: "No Ice", delta: 0 },
      { nameAr: "ثلج قليل", name: "Less Ice", delta: 0 },
      { nameAr: "ثلج عادي", name: "Regular Ice", delta: 0 },
    ],
  },
  {
    productEn: "Sparkling Berry Tea",
    group: "Toppings",
    type: "multi",
    required: false,
    max: 3,
    options: [
      { nameAr: "لؤلؤ التابيوكا", name: "Tapioca Pearls", delta: 2 },
      { nameAr: "بوبا الفقاعات", name: "Popping Boba", delta: 2 },
      { nameAr: "بودينغ", name: "Pudding", delta: 2 },
      { nameAr: "جيلي العشب", name: "Grass Jelly", delta: 2 },
    ],
  },

  // Mochi Bites — light dessert model; extra toppings capped at 3.
  {
    productEn: "Mochi Bites",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    max: 3,
    options: [
      { nameAr: "صوص الماتشا", name: "Matcha Drizzle", delta: 2 },
      { nameAr: "فواكه إضافية", name: "Extra Fruit", delta: 3 },
      { nameAr: "آيس كريم فانيليا", name: "Vanilla Scoop", delta: 5 },
    ],
  },

  // Mini Nutella Waffle — light dessert model; extra toppings capped at 3.
  {
    productEn: "Mini Nutella Waffle",
    group: "Extra Toppings",
    type: "multi",
    required: false,
    max: 3,
    options: [
      { nameAr: "آيس كريم فانيليا", name: "Vanilla Scoop", delta: 5 },
      { nameAr: "فراولة", name: "Strawberries", delta: 3 },
      { nameAr: "صوص الشوكولاتة", name: "Chocolate Drizzle", delta: 2 },
    ],
  },
] as const;

// ---------- Ingredients ----------
export const seedIngredients = [
  { name: "Black Tea Base", unit: "ml", stock: 5000, reorder: 1000, cost: 0.05 },
  { name: "Jasmine Tea Base", unit: "ml", stock: 4000, reorder: 1000, cost: 0.05 },
  { name: "Fresh Milk", unit: "ml", stock: 8000, reorder: 1500, cost: 0.03 },
  { name: "Brown Sugar Syrup", unit: "ml", stock: 3000, reorder: 500, cost: 0.08 },
  { name: "Taro Powder", unit: "g", stock: 2000, reorder: 400, cost: 0.1 },
  { name: "Matcha Powder", unit: "g", stock: 1500, reorder: 300, cost: 0.25 },
  { name: "Tapioca Pearls (cooked)", unit: "g", stock: 4000, reorder: 800, cost: 0.02 },
  { name: "Popping Boba", unit: "g", stock: 2000, reorder: 400, cost: 0.04 },
  { name: "Pudding", unit: "g", stock: 2000, reorder: 400, cost: 0.03 },
  { name: "Grass Jelly", unit: "g", stock: 1500, reorder: 300, cost: 0.03 },
  { name: "Cheese Foam Mix", unit: "ml", stock: 2000, reorder: 400, cost: 0.12 },
  { name: "Red Bean", unit: "g", stock: 1500, reorder: 300, cost: 0.03 },
  { name: "Passion Fruit Syrup", unit: "ml", stock: 2000, reorder: 400, cost: 0.1 },
  { name: "Strawberry Syrup", unit: "ml", stock: 2000, reorder: 400, cost: 0.1 },
  { name: "Mango Puree", unit: "ml", stock: 3000, reorder: 600, cost: 0.08 },
  { name: "Pancake Batter", unit: "g", stock: 3000, reorder: 600, cost: 0.04 },
  { name: "Nutella", unit: "g", stock: 1500, reorder: 300, cost: 0.15 },
  { name: "Shaved Ice Base", unit: "g", stock: 6000, reorder: 1000, cost: 0.01 },
  { name: "Injeolmi Powder", unit: "g", stock: 800, reorder: 150, cost: 0.2 },
  { name: "Chocolate Sauce", unit: "g", stock: 1500, reorder: 300, cost: 0.06 },
  { name: "Croissant Dough", unit: "piece", stock: 100, reorder: 20, cost: 3.5 },
  { name: "Vanilla Ice Cream", unit: "g", stock: 3000, reorder: 500, cost: 0.08 },
  { name: "Regular Cups", unit: "piece", stock: 500, reorder: 100, cost: 0.6 },
  { name: "Large Cups", unit: "piece", stock: 300, reorder: 60, cost: 0.8 },
  { name: "Straws", unit: "piece", stock: 1000, reorder: 200, cost: 0.1 },
  // ── Spec six ingredients (C4) ──
  { name: "Sparkling Water", unit: "ml", stock: 5000, reorder: 1000, cost: 0.02 },
  { name: "Berry Syrup", unit: "ml", stock: 2000, reorder: 400, cost: 0.12 },
  { name: "Mochi Rice Flour", unit: "g", stock: 2000, reorder: 400, cost: 0.05 },
  { name: "Sugar", unit: "g", stock: 5000, reorder: 1000, cost: 0.01 },
  { name: "Waffle Batter", unit: "g", stock: 3000, reorder: 600, cost: 0.04 },
] as const;

// ---------- Modifier → ingredient links (spec §8.4) ----------
// Topping modifiers that consume tracked stock: keyed by the modifier option's
// English name, mapped to [ingredient name, per-serving quantity].  A linked
// ingredient must appear EITHER in the base recipe OR in a modifier option of
// the product — NEVER both (swappable-ingredient rule; the seed unit test
// `seed-stock-semantics.test.ts` asserts zero overlap for this catalog).
export const MODIFIER_INGREDIENT_LINKS: Record<string, [string, number]> = {
  "Tapioca Pearls": ["Tapioca Pearls (cooked)", 50],
  "Popping Boba": ["Popping Boba", 30],
  Pudding: ["Pudding", 40],
  "Grass Jelly": ["Grass Jelly", 40],
  "Red Bean": ["Red Bean", 30],
};

// ---------- Recipes ----------
export const seedRecipes = [
  { productEn: "Classic Milk Tea", ingredient: "Black Tea Base", qty: 200 },
  { productEn: "Classic Milk Tea", ingredient: "Fresh Milk", qty: 100 },
  { productEn: "Classic Milk Tea", ingredient: "Regular Cups", qty: 1 },
  { productEn: "Classic Milk Tea", ingredient: "Straws", qty: 1 },

  { productEn: "Brown Sugar Milk Tea", ingredient: "Black Tea Base", qty: 180 },
  { productEn: "Brown Sugar Milk Tea", ingredient: "Fresh Milk", qty: 100 },
  { productEn: "Brown Sugar Milk Tea", ingredient: "Brown Sugar Syrup", qty: 30 },

  { productEn: "Taro Milk Tea", ingredient: "Fresh Milk", qty: 150 },
  { productEn: "Taro Milk Tea", ingredient: "Taro Powder", qty: 25 },
  { productEn: "Taro Milk Tea", ingredient: "Regular Cups", qty: 1 },

  { productEn: "Matcha Milk Tea", ingredient: "Fresh Milk", qty: 150 },
  { productEn: "Matcha Milk Tea", ingredient: "Matcha Powder", qty: 8 },
  { productEn: "Matcha Milk Tea", ingredient: "Regular Cups", qty: 1 },

  { productEn: "Passion Fruit Tea", ingredient: "Jasmine Tea Base", qty: 200 },
  { productEn: "Passion Fruit Tea", ingredient: "Passion Fruit Syrup", qty: 30 },

  { productEn: "Strawberry Fruit Tea", ingredient: "Jasmine Tea Base", qty: 200 },
  { productEn: "Strawberry Fruit Tea", ingredient: "Strawberry Syrup", qty: 30 },

  { productEn: "Mango Fruit Tea", ingredient: "Jasmine Tea Base", qty: 200 },
  { productEn: "Mango Fruit Tea", ingredient: "Mango Puree", qty: 40 },

  { productEn: "Cheese Foam Jasmine Tea", ingredient: "Jasmine Tea Base", qty: 180 },
  { productEn: "Cheese Foam Jasmine Tea", ingredient: "Cheese Foam Mix", qty: 40 },

  { productEn: "Cheese Foam Matcha", ingredient: "Matcha Powder", qty: 8 },
  { productEn: "Cheese Foam Matcha", ingredient: "Fresh Milk", qty: 120 },
  { productEn: "Cheese Foam Matcha", ingredient: "Cheese Foam Mix", qty: 40 },

  { productEn: "Classic Soufflé Pancake", ingredient: "Pancake Batter", qty: 200 },
  { productEn: "Strawberry Soufflé Pancake", ingredient: "Pancake Batter", qty: 200 },
  { productEn: "Strawberry Soufflé Pancake", ingredient: "Strawberry Syrup", qty: 20 },
  { productEn: "Nutella Soufflé Pancake", ingredient: "Pancake Batter", qty: 200 },
  { productEn: "Nutella Soufflé Pancake", ingredient: "Nutella", qty: 40 },

  { productEn: "Mango Bingsu", ingredient: "Shaved Ice Base", qty: 300 },
  { productEn: "Mango Bingsu", ingredient: "Mango Puree", qty: 80 },
  { productEn: "Injeolmi Bingsu", ingredient: "Shaved Ice Base", qty: 300 },
  { productEn: "Injeolmi Bingsu", ingredient: "Injeolmi Powder", qty: 30 },
  { productEn: "Chocolate Bingsu", ingredient: "Shaved Ice Base", qty: 300 },
  { productEn: "Chocolate Bingsu", ingredient: "Chocolate Sauce", qty: 50 },

  { productEn: "Original Croffle", ingredient: "Croissant Dough", qty: 1 },
  { productEn: "Ice Cream Croffle", ingredient: "Croissant Dough", qty: 1 },
  { productEn: "Ice Cream Croffle", ingredient: "Vanilla Ice Cream", qty: 60 },

  // ── Spec six recipes (C4) — so the inventory integration test is meaningful ──
  { productEn: "Brown Sugar Bubble Tea", ingredient: "Black Tea Base", qty: 180 },
  { productEn: "Brown Sugar Bubble Tea", ingredient: "Fresh Milk", qty: 100 },
  { productEn: "Brown Sugar Bubble Tea", ingredient: "Brown Sugar Syrup", qty: 30 },
  { productEn: "Brown Sugar Bubble Tea", ingredient: "Regular Cups", qty: 1 },

  { productEn: "Taro Classic", ingredient: "Fresh Milk", qty: 150 },
  { productEn: "Taro Classic", ingredient: "Taro Powder", qty: 25 },
  { productEn: "Taro Classic", ingredient: "Regular Cups", qty: 1 },

  { productEn: "Matcha Latte", ingredient: "Fresh Milk", qty: 150 },
  { productEn: "Matcha Latte", ingredient: "Matcha Powder", qty: 8 },
  { productEn: "Matcha Latte", ingredient: "Regular Cups", qty: 1 },

  { productEn: "Sparkling Berry Tea", ingredient: "Jasmine Tea Base", qty: 100 },
  { productEn: "Sparkling Berry Tea", ingredient: "Sparkling Water", qty: 120 },
  { productEn: "Sparkling Berry Tea", ingredient: "Berry Syrup", qty: 30 },

  { productEn: "Mochi Bites", ingredient: "Mochi Rice Flour", qty: 90 },
  { productEn: "Mochi Bites", ingredient: "Sugar", qty: 20 },

  { productEn: "Mini Nutella Waffle", ingredient: "Waffle Batter", qty: 120 },
  { productEn: "Mini Nutella Waffle", ingredient: "Nutella", qty: 30 },
] as const;

// ---------- Business Settings ----------
export const seedSettings = [
  { key: "currency", value: "ILS" },
  { key: "tax_rate", value: "0" },
  { key: "payment_methods", value: "Cash, Card" },
  { key: "receipt_printer", value: "Not yet confirmed" },
  { key: "operating_hours", value: "12:00 PM – 12:00 AM" },
  { key: "drive_thru_device", value: "Tablet" },
  { key: "receipt_footer", value: "Thank you for visiting Ayasofia Sweet! 🧋 See you again soon" },
  { key: "shop_name", value: "Ayasofia Sweet" },
  { key: "shop_address", value: "Al-Wad Street, next to Al-Murabiteen Mosque, Qalqilya" },
  { key: "shop_phone", value: "+972 56-645-8003" },
  // ── Feature flags (C9) ──
  { key: "feature.digital_menu", value: "1" },
  { key: "feature.wifi_portal", value: "1" },
  // ── Delivery fee rules (C6) ──
  { key: "delivery.fee", value: "5.00" },
  { key: "delivery.free_threshold", value: "50" },
  { key: "delivery.min_order", value: "" },
  // ── Wifi splash copy (WF-06) ──
  { key: "wifi.splash_title", value: "أياسوفيا ترحّب بك" },
  { key: "wifi.splash_subtitle", value: "واي فاي مجاني للضيوف" },
  { key: "wifi.privacy_line", value: "لا نشارك بياناتك مع أي طرف ثالث، ولا نطلب اسمك للاتصال" },
] as const;

// ── Branches (single row today) ──
export const seedBranches = [
  {
    name: "Ayasofia Qalqilya",
    slug: "qalqilya",
    address: "Al-Wad Street, Qalqilya",
    phone: "+972 56-645-8003",
  },
] as const;

// ── Tables (QR codes) ──
export const seedTables = [
  { branchSlug: "qalqilya", code: "T1", active: true },
  { branchSlug: "qalqilya", code: "T2", active: true },
  { branchSlug: "qalqilya", code: "T3", active: true },
  { branchSlug: "qalqilya", code: "T4", active: true },
] as const;

// ── Today's suggestion (shared digital-menu ↔ wifi entity) ──
export const seedSuggestion = {
  productEn: "Brown Sugar Bubble Tea",
  titleAr: "براون شوغر بابل تي",
  descriptionAr: "النجم هذا الأسبوع ✨",
};

// ── Upsell rules (FR-DM-16) ──
export const seedUpsellRules = [
  {
    condition: "cart_below_threshold",
    thresholdAgorot: 4000,
    productEn: "Brown Sugar Bubble Tea",
    priority: 10,
  },
  {
    condition: "cart_has_product_category",
    categoryEn: "Bubble Tea",
    productEn: "Mochi Bites",
    priority: 5,
  },
  {
    condition: "time_of_day",
    bias: "hot",
    productEn: "Mini Nutella Waffle",
    priority: 3,
  },
] as const;
