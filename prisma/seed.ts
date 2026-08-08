import { PrismaClient, ShippingProvider } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// All 58 Algerian wilayas. zone drives shipping pricing (1 north … 4 deep south)
// ---------------------------------------------------------------------------
const WILAYAS: { code: number; nameFr: string; nameAr: string; zone: number }[] = [
  { code: 1, nameFr: "Adrar", nameAr: "أدرار", zone: 4 },
  { code: 2, nameFr: "Chlef", nameAr: "الشلف", zone: 1 },
  { code: 3, nameFr: "Laghouat", nameAr: "الأغواط", zone: 3 },
  { code: 4, nameFr: "Oum El Bouaghi", nameAr: "أم البواقي", zone: 2 },
  { code: 5, nameFr: "Batna", nameAr: "باتنة", zone: 2 },
  { code: 6, nameFr: "Béjaïa", nameAr: "بجاية", zone: 1 },
  { code: 7, nameFr: "Biskra", nameAr: "بسكرة", zone: 3 },
  { code: 8, nameFr: "Béchar", nameAr: "بشار", zone: 4 },
  { code: 9, nameFr: "Blida", nameAr: "البليدة", zone: 1 },
  { code: 10, nameFr: "Bouira", nameAr: "البويرة", zone: 1 },
  { code: 11, nameFr: "Tamanrasset", nameAr: "تمنراست", zone: 4 },
  { code: 12, nameFr: "Tébessa", nameAr: "تبسة", zone: 2 },
  { code: 13, nameFr: "Tlemcen", nameAr: "تلمسان", zone: 1 },
  { code: 14, nameFr: "Tiaret", nameAr: "تيارت", zone: 2 },
  { code: 15, nameFr: "Tizi Ouzou", nameAr: "تيزي وزو", zone: 1 },
  { code: 16, nameFr: "Alger", nameAr: "الجزائر", zone: 1 },
  { code: 17, nameFr: "Djelfa", nameAr: "الجلفة", zone: 3 },
  { code: 18, nameFr: "Jijel", nameAr: "جيجل", zone: 1 },
  { code: 19, nameFr: "Sétif", nameAr: "سطيف", zone: 2 },
  { code: 20, nameFr: "Saïda", nameAr: "سعيدة", zone: 2 },
  { code: 21, nameFr: "Skikda", nameAr: "سكيكدة", zone: 1 },
  { code: 22, nameFr: "Sidi Bel Abbès", nameAr: "سيدي بلعباس", zone: 2 },
  { code: 23, nameFr: "Annaba", nameAr: "عنابة", zone: 1 },
  { code: 24, nameFr: "Guelma", nameAr: "قالمة", zone: 2 },
  { code: 25, nameFr: "Constantine", nameAr: "قسنطينة", zone: 2 },
  { code: 26, nameFr: "Médéa", nameAr: "المدية", zone: 2 },
  { code: 27, nameFr: "Mostaganem", nameAr: "مستغانم", zone: 1 },
  { code: 28, nameFr: "M'Sila", nameAr: "المسيلة", zone: 2 },
  { code: 29, nameFr: "Mascara", nameAr: "معسكر", zone: 2 },
  { code: 30, nameFr: "Ouargla", nameAr: "ورقلة", zone: 3 },
  { code: 31, nameFr: "Oran", nameAr: "وهران", zone: 1 },
  { code: 32, nameFr: "El Bayadh", nameAr: "البيض", zone: 3 },
  { code: 33, nameFr: "Illizi", nameAr: "إليزي", zone: 4 },
  { code: 34, nameFr: "Bordj Bou Arreridj", nameAr: "برج بوعريريج", zone: 2 },
  { code: 35, nameFr: "Boumerdès", nameAr: "بومرداس", zone: 1 },
  { code: 36, nameFr: "El Tarf", nameAr: "الطارف", zone: 1 },
  { code: 37, nameFr: "Tindouf", nameAr: "تندوف", zone: 4 },
  { code: 38, nameFr: "Tissemsilt", nameAr: "تيسمسيلت", zone: 2 },
  { code: 39, nameFr: "El Oued", nameAr: "الوادي", zone: 3 },
  { code: 40, nameFr: "Khenchela", nameAr: "خنشلة", zone: 2 },
  { code: 41, nameFr: "Souk Ahras", nameAr: "سوق أهراس", zone: 2 },
  { code: 42, nameFr: "Tipaza", nameAr: "تيبازة", zone: 1 },
  { code: 43, nameFr: "Mila", nameAr: "ميلة", zone: 2 },
  { code: 44, nameFr: "Aïn Defla", nameAr: "عين الدفلى", zone: 2 },
  { code: 45, nameFr: "Naâma", nameAr: "النعامة", zone: 3 },
  { code: 46, nameFr: "Aïn Témouchent", nameAr: "عين تموشنت", zone: 1 },
  { code: 47, nameFr: "Ghardaïa", nameAr: "غرداية", zone: 3 },
  { code: 48, nameFr: "Relizane", nameAr: "غليزان", zone: 2 },
  { code: 49, nameFr: "Timimoun", nameAr: "تيميمون", zone: 4 },
  { code: 50, nameFr: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار", zone: 4 },
  { code: 51, nameFr: "Ouled Djellal", nameAr: "أولاد جلال", zone: 3 },
  { code: 52, nameFr: "Béni Abbès", nameAr: "بني عباس", zone: 4 },
  { code: 53, nameFr: "In Salah", nameAr: "عين صالح", zone: 4 },
  { code: 54, nameFr: "In Guezzam", nameAr: "عين قزام", zone: 4 },
  { code: 55, nameFr: "Touggourt", nameAr: "تقرت", zone: 3 },
  { code: 56, nameFr: "Djanet", nameAr: "جانت", zone: 4 },
  { code: 57, nameFr: "El M'Ghair", nameAr: "المغير", zone: 3 },
  { code: 58, nameFr: "El Meniaa", nameAr: "المنيعة", zone: 4 },
];

// Major communes for the biggest wilayas; every other wilaya gets its capital.
const EXTRA_COMMUNES: Record<number, string[]> = {
  16: ["Alger Centre", "Bab El Oued", "Hydra", "Kouba", "El Harrach", "Bab Ezzouar", "Dar El Beïda", "Birkhadem"],
  31: ["Oran", "Es Senia", "Bir El Djir", "Aïn El Turk", "Arzew"],
  25: ["Constantine", "El Khroub", "Hamma Bouziane", "Aïn Smara"],
  9: ["Blida", "Boufarik", "Ouled Yaïch", "Beni Mered"],
  19: ["Sétif", "El Eulma", "Aïn Oulmene"],
  23: ["Annaba", "El Bouni", "Sidi Amar"],
  6: ["Béjaïa", "Akbou", "El Kseur"],
  15: ["Tizi Ouzou", "Draâ Ben Khedda", "Azazga"],
  13: ["Tlemcen", "Mansourah", "Chetouane"],
  5: ["Batna", "Barika", "Aïn Touta"],
};

// Zone-based shipping pricing (DZD): [home delivery, stop desk, days]
const ZONE_PRICING: Record<number, [number, number, number]> = {
  1: [500, 300, 2],
  2: [600, 400, 3],
  3: [800, 500, 5],
  4: [1200, 800, 7],
};

const PROVIDERS: { provider: ShippingProvider; homeDelta: number; deskDelta: number }[] = [
  { provider: "YALIDINE", homeDelta: 0, deskDelta: 0 },
  { provider: "ZR_EXPRESS", homeDelta: 50, deskDelta: 50 },
  { provider: "POSTE", homeDelta: -100, deskDelta: -50 },
];

async function seedGeography() {
  for (const w of WILAYAS) {
    await prisma.wilaya.upsert({
      where: { code: w.code },
      update: { nameFr: w.nameFr, nameAr: w.nameAr, zone: w.zone },
      create: w,
    });
  }
  console.log(`✓ ${WILAYAS.length} wilayas`);

  for (const w of WILAYAS) {
    const names = EXTRA_COMMUNES[w.code] ?? [w.nameFr];
    for (const name of names) {
      await prisma.commune.upsert({
        where: { wilayaCode_name: { wilayaCode: w.code, name } },
        update: {},
        create: { wilayaCode: w.code, name },
      });
    }
  }
  console.log("✓ communes");
}

async function seedShippingRates() {
  for (const w of WILAYAS) {
    const [home, desk, days] = ZONE_PRICING[w.zone];
    for (const p of PROVIDERS) {
      await prisma.shippingRate.upsert({
        where: { provider_wilayaCode: { provider: p.provider, wilayaCode: w.code } },
        update: {},
        create: {
          provider: p.provider,
          wilayaCode: w.code,
          homeDeliveryPrice: Math.max(home + p.homeDelta, 200),
          stopDeskPrice: Math.max(desk + p.deskDelta, 150),
          returnPrice: 200,
          estimatedDays: days,
        },
      });
    }
  }
  console.log(`✓ shipping rates (${PROVIDERS.length} providers × ${WILAYAS.length} wilayas)`);
}

async function upsertUser(opts: {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "seller" | "wilaya_manager" | "accountant" | "agent" | "buyer";
  phone?: string;
  wilayaCode?: number;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  return prisma.profile.upsert({
    where: { email: opts.email },
    update: { role: opts.role, wilayaCode: opts.wilayaCode },
    create: {
      email: opts.email,
      phone: opts.phone,
      passwordHash,
      fullName: opts.fullName,
      role: opts.role,
      wilayaCode: opts.wilayaCode,
    },
  });
}

async function seedUsersAndDemo() {
  // Default admin required by the spec.
  const admin = await upsertUser({
    email: "admin@zeem.dz",
    password: "ZeemAdmin123",
    fullName: "Zeem Admin",
    role: "admin",
    phone: "0550000000",
  });
  console.log("✓ admin (admin@zeem.dz / ZeemAdmin123)");

  // Demo accounts for every role so the whole flow is testable immediately.
  const seller = await upsertUser({
    email: "seller@zeem.dz",
    password: "ZeemDemo123",
    fullName: "Karim Vendeur",
    role: "seller",
    phone: "0551111111",
  });
  const manager = await upsertUser({
    email: "manager@zeem.dz",
    password: "ZeemDemo123",
    fullName: "Amine Manager",
    role: "wilaya_manager",
    phone: "0552222222",
    wilayaCode: 16,
  });
  await upsertUser({
    email: "accountant@zeem.dz",
    password: "ZeemDemo123",
    fullName: "Salima Comptable",
    role: "accountant",
    phone: "0553333333",
  });
  await upsertUser({
    email: "agent@zeem.dz",
    password: "ZeemDemo123",
    fullName: "Yacine Livreur",
    role: "agent",
    phone: "0554444444",
    wilayaCode: 16,
  });
  await upsertUser({
    email: "buyer@zeem.dz",
    password: "ZeemDemo123",
    fullName: "Nour Acheteuse",
    role: "buyer",
    phone: "0555555555",
  });
  console.log("✓ demo users (…@zeem.dz / ZeemDemo123)");

  // One approved demo store with products so the storefront is not empty.
  const store = await prisma.store.upsert({
    where: { slug: "boutique-el-djazair" },
    update: { status: "ACTIVE" },
    create: {
      name: "Boutique El Djazaïr",
      slug: "boutique-el-djazair",
      description: "Produits locaux de qualité, livrés dans les 58 wilayas.",
      ownerId: seller.id,
      wilayaCode: 16,
      status: "ACTIVE",
      commissionRate: 5,
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });

  const demoProducts: {
    name: string;
    slug: string;
    description: string;
    category: string;
    basePrice: number;
    variants: { sku: string; name: string; size?: string; color?: string; price: number; stockQuantity: number }[];
  }[] = [
    {
      name: "Djellaba traditionnelle",
      slug: "djellaba-traditionnelle",
      description: "Djellaba artisanale en coton, confectionnée à la main.",
      category: "Mode",
      basePrice: 4500,
      variants: [
        { sku: "DJL-M-BLC", name: "M / Blanc", size: "M", color: "Blanc", price: 4500, stockQuantity: 20 },
        { sku: "DJL-L-BLC", name: "L / Blanc", size: "L", color: "Blanc", price: 4500, stockQuantity: 15 },
        { sku: "DJL-M-BLE", name: "M / Bleu", size: "M", color: "Bleu", price: 4800, stockQuantity: 10 },
      ],
    },
    {
      name: "Écouteurs sans fil Pro",
      slug: "ecouteurs-sans-fil-pro",
      description: "Écouteurs Bluetooth 5.3, autonomie 30h, réduction de bruit.",
      category: "Électronique",
      basePrice: 6500,
      variants: [
        { sku: "ECT-NOIR", name: "Noir", color: "Noir", price: 6500, stockQuantity: 40 },
        { sku: "ECT-BLANC", name: "Blanc", color: "Blanc", price: 6500, stockQuantity: 35 },
      ],
    },
    {
      name: "Service à café en céramique",
      slug: "service-cafe-ceramique",
      description: "Service à café 12 pièces, motif traditionnel algérien.",
      category: "Maison",
      basePrice: 3200,
      variants: [
        { sku: "CAF-12P", name: "12 pièces", price: 3200, stockQuantity: 25 },
      ],
    },
    {
      name: "Huile d'argan pure 100 ml",
      slug: "huile-argan-pure-100ml",
      description: "Huile d'argan 100% naturelle, pressée à froid.",
      category: "Beauté",
      basePrice: 1800,
      variants: [
        { sku: "ARG-100", name: "100 ml", price: 1800, stockQuantity: 60 },
      ],
    },
    {
      name: "Ballon de football Pro",
      slug: "ballon-football-pro",
      description: "Ballon taille 5, cousu machine, usage intensif.",
      category: "Sport",
      basePrice: 2500,
      variants: [
        { sku: "BAL-T5", name: "Taille 5", price: 2500, stockQuantity: 30 },
      ],
    },
  ];

  for (const p of demoProducts) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        storeId: store.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        basePrice: p.basePrice,
        variants: { create: p.variants },
      },
    });
  }
  console.log(`✓ demo store + ${demoProducts.length} products`);

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "DATABASE_SEEDED",
      entityType: "System",
      entityId: "seed",
      after: { wilayas: WILAYAS.length },
    },
  });
}

async function main() {
  console.log("🌱 Seeding Zeem Marketplace…");
  await seedGeography();
  await seedShippingRates();
  await seedUsersAndDemo();
  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
