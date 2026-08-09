import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Zeem Marketplace database...')

  // 1. Delete existing data (clean slate)
  // NOTE (fix): children first — the provided list missed several tables and
  // would fail on foreign-key constraints.
  await prisma.deliveryLocationUpdate.deleteMany()
  await prisma.pointsTransaction.deleteMany()
  await prisma.loyaltyPoints.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.review.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.shipment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.store.deleteMany()
  await prisma.shippingRate.deleteMany()
  await prisma.commune.deleteMany()
  await prisma.wilaya.deleteMany()
  await prisma.profile.deleteMany()

  // 2. Seed 58 Wilayas with their Communes
  const wilayasData = [
    { code: 1, name: 'Adrar', communes: ['Adrar', 'Tamest', 'Reggane'] },
    { code: 2, name: 'Chlef', communes: ['Chlef', 'Ténès', 'Oued Fodda'] },
    { code: 3, name: 'Laghouat', communes: ['Laghouat', 'Aflou', 'Kheneg'] },
    { code: 4, name: 'Oum El Bouaghi', communes: ['Oum El Bouaghi', "Aïn M'lila", 'Khenchela'] },
    { code: 5, name: 'Batna', communes: ['Batna', 'Barika', "N'Gaous"] },
    { code: 6, name: 'Béjaïa', communes: ['Béjaïa', 'Akbou', 'El Kseur'] },
    { code: 7, name: 'Biskra', communes: ['Biskra', 'Tolga', 'Sidi Okba'] },
    { code: 8, name: 'Béchar', communes: ['Béchar', 'Kenadsa', 'El Ouata'] },
    { code: 9, name: 'Blida', communes: ['Blida', 'Ouled Yaïch', 'Boufarik'] },
    { code: 10, name: 'Bouira', communes: ['Bouira', 'Aïn El Hadjar', 'Lakhdaria'] },
    { code: 11, name: 'Tamanrasset', communes: ['Tamanrasset', 'In Salah', 'In Guezzam'] },
    { code: 12, name: 'Tébessa', communes: ['Tébessa', 'Bir El Ater', 'El Ogla'] },
    { code: 13, name: 'Tlemcen', communes: ['Tlemcen', 'Maghnia', 'Mansourah'] },
    { code: 14, name: 'Tiaret', communes: ['Tiaret', 'Sougueur', 'Aïn Deheb'] },
    { code: 15, name: 'Tizi Ouzou', communes: ['Tizi Ouzou', 'Draâ Ben Khedda', 'Boghni'] },
    { code: 16, name: 'Alger', communes: ['Alger Centre', 'Bab Ezzouar', 'Dar El Beïda', 'Hussein Dey', 'Kouba', 'Birkhadem', 'Dely Ibrahim'] },
    { code: 17, name: 'Djelfa', communes: ['Djelfa', 'Aïn Oussera', 'Messaad'] },
    { code: 18, name: 'Jijel', communes: ['Jijel', 'El Milia', 'Chekfa'] },
    { code: 19, name: 'Sétif', communes: ['Sétif', 'El Eulma', 'Aïn Arnat'] },
    { code: 20, name: 'Saïda', communes: ['Saïda', 'Aïn El Hadjar', 'Sidi Boubekeur'] },
    { code: 21, name: 'Skikda', communes: ['Skikda', 'El Harrouch', 'Azzaba'] },
    { code: 22, name: 'Sidi Bel Abbès', communes: ['Sidi Bel Abbès', 'Ténira', 'El Haçaiba'] },
    { code: 23, name: 'Annaba', communes: ['Annaba', 'El Hadjar', 'Berrahal'] },
    { code: 24, name: 'Guelma', communes: ['Guelma', 'Bou Hamdane', 'Héliopolis'] },
    { code: 25, name: 'Constantine', communes: ['Constantine', 'El Khroub', 'Aïn Abid'] },
    { code: 26, name: 'Médéa', communes: ['Médéa', 'Berrouaghia', 'Khemis El Khechna'] },
    { code: 27, name: 'Mostaganem', communes: ['Mostaganem', 'Aïn Sefra', 'Sidi Lakhdar'] },
    { code: 28, name: "M'Sila", communes: ["M'Sila", 'Bou Saâda', 'Khoubana'] },
    { code: 29, name: 'Mascara', communes: ['Mascara', 'Sig', 'Tizi'] },
    { code: 30, name: 'Ouargla', communes: ['Ouargla', 'Rouissat', "N'Goussa"] },
    { code: 31, name: 'Oran', communes: ['Oran', 'Es Sénia', 'Bir El Djir', 'Arzew'] },
    { code: 32, name: 'El Bayadh', communes: ['El Bayadh', 'Brézina', 'Rogassa'] },
    { code: 33, name: 'Illizi', communes: ['Illizi', 'Debdeb', 'In Amenas'] },
    { code: 34, name: 'Bordj Bou Arreridj', communes: ['Bordj Bou Arreridj', "M'sila", 'El Anceur'] },
    { code: 35, name: 'Boumerdès', communes: ['Boumerdès', 'Boudouaou', 'Dellys'] },
    { code: 36, name: 'El Tarf', communes: ['El Tarf', 'Bouhadjar', "Ben M'hidi"] },
    { code: 37, name: 'Tindouf', communes: ['Tindouf'] },
    { code: 38, name: 'Tissemsilt', communes: ['Tissemsilt', 'Bougara', 'Lardjem'] },
    { code: 39, name: 'El Oued', communes: ['El Oued', 'Debila', 'Guerba'] },
    { code: 40, name: 'Khenchela', communes: ['Khenchela', 'Chetma', 'Ouled Rechache'] },
    { code: 41, name: 'Souk Ahras', communes: ['Souk Ahras', "M'daourouch", 'Taoura'] },
    { code: 42, name: 'Tipaza', communes: ['Tipaza', 'Cherchell', 'Koléa'] },
    { code: 43, name: 'Mila', communes: ['Mila', 'Chelghoum Laïd', 'Aïn Beïda'] },
    { code: 44, name: 'Aïn Defla', communes: ['Aïn Defla', 'Miliana', 'El Attaf'] },
    { code: 45, name: 'Naâma', communes: ['Naâma', 'Mécheria', 'Aïn Séfra'] },
    { code: 46, name: 'Aïn Témouchent', communes: ['Aïn Témouchent', 'El Malah', 'Hammam Bou Hadjar'] },
    { code: 47, name: 'Ghardaïa', communes: ['Ghardaïa', 'Berriane', 'El Ménia'] },
    { code: 48, name: 'Relizane', communes: ['Relizane', 'Mazouna', 'Oued Rhiou'] },
    { code: 49, name: 'Timimoun', communes: ['Timimoun', 'Charouine', 'Ouled Saïd'] },
    { code: 50, name: 'Bordj Badji Mokhtar', communes: ['Bordj Badji Mokhtar'] },
    { code: 51, name: 'Ouled Djellal', communes: ['Ouled Djellal', 'Sidi Khaled'] },
    { code: 52, name: 'Béni Abbès', communes: ['Béni Abbès', 'Kéris'] },
    { code: 53, name: 'In Salah', communes: ['In Salah'] },
    { code: 54, name: 'In Guezzam', communes: ['In Guezzam'] },
    { code: 55, name: 'Touggourt', communes: ['Touggourt', 'Témacine'] },
    { code: 56, name: 'Djanet', communes: ['Djanet'] },
    { code: 57, name: 'El Menia', communes: ['El Menia'] },
    { code: 58, name: "El M'Ghair", communes: ["El M'Ghair", 'Djamaa'] },
  ]

  for (const w of wilayasData) {
    await prisma.wilaya.create({
      data: {
        code: w.code,
        name: w.name,
        communes: {
          create: w.communes.map((c) => ({ name: c })),
        },
      },
    })
    console.log(`✅ Created Wilaya ${w.code}: ${w.name} (${w.communes.length} communes)`)
  }

  // 3. Create Default Admin User
  // NOTE (fix): the provided seed hashed the password but never stored it,
  // which would make admin login impossible. It is stored in passwordHash.
  const adminPassword = await bcrypt.hash('ZeemAdmin123', 10)
  await prisma.profile.create({
    data: {
      userId: 'admin-zeem-default',
      email: 'admin@zeem.dz',
      phone: '+21300000000',
      passwordHash: adminPassword,
      fullName: 'Super Admin',
      role: 'ADMIN',
      isVerified: true,
    },
  })
  console.log(`✅ Created Admin user: admin@zeem.dz`)

  // 3b. Demo accounts, one per role, so every dashboard is reachable
  //     immediately after seeding. Delete this block for a production install.
  const demoPassword = await bcrypt.hash('ZeemDemo123', 10)
  const demoStaff: {
    email: string
    phone: string
    fullName: string
    role: 'WILAYA_MANAGER' | 'SELLER' | 'ACCOUNTANT' | 'AGENT' | 'ERP_MANAGER' | 'LOGISTICS_MANAGER' | 'SUPPORT' | 'BUYER'
    wilayaCode?: number
  }[] = [
    { email: 'manager@zeem.dz', phone: '+21355000001', fullName: 'Amine Manager', role: 'WILAYA_MANAGER', wilayaCode: 16 },
    { email: 'seller@zeem.dz', phone: '+21355000002', fullName: 'Karim Vendeur', role: 'SELLER' },
    { email: 'agent@zeem.dz', phone: '+21355000003', fullName: 'Yacine Livreur', role: 'AGENT', wilayaCode: 16 },
    { email: 'accountant@zeem.dz', phone: '+21355000004', fullName: 'Salima Comptable', role: 'ACCOUNTANT' },
    { email: 'erp@zeem.dz', phone: '+21355000005', fullName: 'Nadia Catalogue', role: 'ERP_MANAGER' },
    { email: 'logistics@zeem.dz', phone: '+21355000006', fullName: 'Sofiane Logistique', role: 'LOGISTICS_MANAGER' },
    { email: 'support@zeem.dz', phone: '+21355000007', fullName: 'Lina Support', role: 'SUPPORT' },
    { email: 'buyer@zeem.dz', phone: '+21355000008', fullName: 'Nour Acheteuse', role: 'BUYER' },
  ]

  const created: Record<string, string> = {}
  for (const d of demoStaff) {
    const profile = await prisma.profile.create({
      data: {
        userId: `demo-${d.role.toLowerCase()}`,
        email: d.email,
        phone: d.phone,
        passwordHash: demoPassword,
        fullName: d.fullName,
        role: d.role,
        wilayaCode: d.wilayaCode,
        isVerified: true,
      },
    })
    created[d.role] = profile.id
  }
  console.log(`✅ Created ${demoStaff.length} demo users (mot de passe : ZeemDemo123)`)

  // 3c. An approved demo store with products, so the storefront is not empty
  //     and the whole order → delivery → commission flow can be exercised.
  const store = await prisma.store.create({
    data: {
      userId: created.SELLER,
      name: 'Boutique El Djazaïr',
      slug: 'boutique-el-djazair',
      description: 'Produits locaux de qualité, livrés dans les 58 wilayas.',
      wilayaCode: 16,
      address: 'Rue Didouche Mourad, Alger Centre',
      isActive: true,
      approvedBy: created.WILAYA_MANAGER,
      rib: '00799999000123456789',
      commissionRate: 10,
    },
  })

  const demoProducts = [
    {
      name: 'Djellaba traditionnelle',
      slug: 'djellaba-traditionnelle',
      category: 'Mode',
      description: 'Djellaba artisanale en coton, confectionnée à la main.',
      variants: [
        { sku: 'DJL-M-BLC', size: 'M', color: 'Blanc', price: 4500, stock: 20 },
        { sku: 'DJL-L-BLC', size: 'L', color: 'Blanc', price: 4500, stock: 15 },
        { sku: 'DJL-M-BLE', size: 'M', color: 'Bleu', price: 4800, stock: 10 },
      ],
    },
    {
      name: 'Écouteurs sans fil Pro',
      slug: 'ecouteurs-sans-fil-pro',
      category: 'Électronique',
      description: 'Bluetooth 5.3, autonomie 30h, réduction de bruit active.',
      variants: [
        { sku: 'ECT-NOIR', size: null, color: 'Noir', price: 6500, stock: 40 },
        { sku: 'ECT-BLANC', size: null, color: 'Blanc', price: 6500, stock: 35 },
      ],
    },
    {
      name: "Huile d'argan pure 100 ml",
      slug: 'huile-argan-pure-100ml',
      category: 'Beauté',
      description: "Huile d'argan 100% naturelle, pressée à froid.",
      variants: [{ sku: 'ARG-100', size: '100 ml', color: null, price: 1800, stock: 60 }],
    },
    {
      name: 'Service à café en céramique',
      slug: 'service-cafe-ceramique',
      category: 'Maison',
      description: 'Service 12 pièces, motif traditionnel algérien.',
      variants: [{ sku: 'CAF-12P', size: '12 pièces', color: null, price: 3200, stock: 25 }],
    },
  ]

  for (const p of demoProducts) {
    await prisma.product.create({
      data: {
        storeId: store.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        isPublished: true,
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku,
            attributes: { size: v.size, color: v.color },
            price: v.price,
            stockQuantity: v.stock,
            lowStockThreshold: 5,
          })),
        },
      },
    })
  }
  console.log(`✅ Created demo store + ${demoProducts.length} products`)

  // 4. Create Default Shipping Rates for ALL Wilayas
  const couriers = ['YALIDINE', 'ZR_EXPRESS', 'POSTE']
  const allWilayas = await prisma.wilaya.findMany()

  for (const wilaya of allWilayas) {
    for (const courier of couriers) {
      let basePrice = 250
      let pricePerKg = 50

      // Remote/Desert Wilayas cost more
      if ([11, 33, 37, 49, 50, 53, 54, 56, 57].includes(wilaya.code)) {
        basePrice = 1200
        pricePerKg = 100
      } else if ([1, 2, 3, 4, 8, 17, 26, 30, 39, 40, 44].includes(wilaya.code)) {
        basePrice = 400
        pricePerKg = 60
      }

      await prisma.shippingRate.create({
        data: {
          wilayaCode: wilaya.code,
          courierType: courier,
          basePrice: basePrice,
          pricePerKg: pricePerKg,
          estimatedDays: basePrice > 1000 ? '5-7' : '2-3',
        },
      })
    }
  }
  console.log(`✅ Created default shipping rates for ${allWilayas.length} wilayas x ${couriers.length} couriers`)

  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
