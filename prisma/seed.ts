// prisma/seed.ts
import { PrismaClient, Role, TrustBadge, ItemCondition, DeliveryOption } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Seed Categories
  const categories = [
    { name: 'Electronics', slug: 'electronics', description: 'Cameras, laptops, gadgets and more', color: '#3B82F6', sortOrder: 1 },
    { name: 'Cameras & Photography', slug: 'cameras-photography', description: 'DSLRs, lenses, tripods', color: '#8B5CF6', sortOrder: 2 },
    { name: 'Dresses & Clothing', slug: 'dresses-clothing', description: 'Party wear, ethnic, formal', color: '#EC4899', sortOrder: 3 },
    { name: 'Audio & Music', slug: 'audio-music', description: 'Speakers, instruments, microphones', color: '#F59E0B', sortOrder: 4 },
    { name: 'Power Tools', slug: 'power-tools', description: 'Drills, saws, and more', color: '#EF4444', sortOrder: 5 },
    { name: 'Sports Equipment', slug: 'sports-equipment', description: 'Bikes, cricket, badminton', color: '#10B981', sortOrder: 6 },
    { name: 'Gaming', slug: 'gaming', description: 'Consoles, VR, accessories', color: '#6366F1', sortOrder: 7 },
    { name: 'Party & Events', slug: 'party-events', description: 'Decorations, lights, furniture', color: '#F97316', sortOrder: 8 },
    { name: 'Books & Education', slug: 'books-education', description: 'Textbooks, study material', color: '#14B8A6', sortOrder: 9 },
    { name: 'Vehicles', slug: 'vehicles', description: 'Cycles, scooters, cars', color: '#64748B', sortOrder: 10 },
    { name: 'Home Appliances', slug: 'home-appliances', description: 'AC, heater, washing machine', color: '#0EA5E9', sortOrder: 11 },
    { name: 'Art & Craft', slug: 'art-craft', description: 'Painting supplies, craft tools', color: '#D946EF', sortOrder: 12 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categories seeded');

  // Seed Admin User
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rentify.in' },
    update: {},
    create: {
      email: 'admin@rentify.in',
      phone: '+919999999999',
      passwordHash: adminPassword,
      firstName: 'Rentify',
      lastName: 'Admin',
      username: 'rentify_admin',
      role: Role.ADMIN,
      isEmailVerified: true,
      isPhoneVerified: true,
      city: 'Bangalore',
      state: 'Karnataka',
      bio: 'Rentify platform administrator',
    },
  });

  await prisma.userTrustScore.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      score: 100,
      badge: TrustBadge.DIAMOND,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  // Seed Demo Lender
  const lenderPassword = await bcrypt.hash('Lender@123', 12);
  const lender = await prisma.user.upsert({
    where: { email: 'lender@rentify.in' },
    update: {},
    create: {
      email: 'lender@rentify.in',
      phone: '+919888888888',
      passwordHash: lenderPassword,
      firstName: 'Arjun',
      lastName: 'Sharma',
      username: 'arjun_lender',
      role: Role.LENDER,
      isEmailVerified: true,
      isPhoneVerified: true,
      city: 'Bangalore',
      state: 'Karnataka',
      latitude: 12.9716,
      longitude: 77.5946,
      bio: 'I rent out my unused gadgets and equipment. Fast responses, reliable service!',
    },
  });

  await prisma.userTrustScore.upsert({
    where: { userId: lender.id },
    update: {},
    create: {
      userId: lender.id,
      score: 87,
      badge: TrustBadge.GOLD,
      completedRentals: 45,
      averageRating: 4.8,
      totalReviews: 42,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  // Seed Demo Renter
  const renterPassword = await bcrypt.hash('Renter@123', 12);
  const renter = await prisma.user.upsert({
    where: { email: 'renter@rentify.in' },
    update: {},
    create: {
      email: 'renter@rentify.in',
      phone: '+919777777777',
      passwordHash: renterPassword,
      firstName: 'Priya',
      lastName: 'Patel',
      username: 'priya_renter',
      role: Role.RENTER,
      isEmailVerified: true,
      isPhoneVerified: true,
      city: 'Bangalore',
      state: 'Karnataka',
      latitude: 12.9352,
      longitude: 77.6245,
      bio: 'Renting is smarter than buying! Love sustainable choices.',
    },
  });

  await prisma.userTrustScore.upsert({
    where: { userId: renter.id },
    update: {},
    create: {
      userId: renter.id,
      score: 72,
      badge: TrustBadge.SILVER,
      completedRentals: 18,
      averageRating: 4.5,
      totalReviews: 15,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  const cameraCategory = await prisma.category.findUnique({ where: { slug: 'cameras-photography' } });
  const electronicsCategory = await prisma.category.findUnique({ where: { slug: 'electronics' } });
  const audioCategory = await prisma.category.findUnique({ where: { slug: 'audio-music' } });
  const partyCategory = await prisma.category.findUnique({ where: { slug: 'party-events' } });

  // Seed Sample Items
  const sampleItems = [
    {
      title: 'Canon EOS 80D DSLR Camera',
      description: 'Professional DSLR perfect for photography enthusiasts. Comes with 18-55mm kit lens. Great for events, portraits, and street photography.',
      slug: 'canon-eos-80d-dslr',
      ownerId: lender.id,
      categoryId: cameraCategory!.id,
      pricePerDay: 500,
      pricePerWeek: 2800,
      securityDeposit: 5000,
      condition: ItemCondition.GOOD,
      deliveryOption: DeliveryOption.BOTH,
      instantBooking: true,
      tags: ['camera', 'dslr', 'canon', 'photography'],
      latitude: 12.9716,
      longitude: 77.5946,
      city: 'Bangalore',
      specifications: { brand: 'Canon', model: 'EOS 80D', megapixels: '24.2 MP', sensor: 'APS-C CMOS' },
    },
    {
      title: 'JBL PartyBox 300 Speaker',
      description: 'Powerful 120W party speaker with light show. Battery-powered, works anywhere. Perfect for outdoor parties and events.',
      slug: 'jbl-partybox-300-speaker',
      ownerId: lender.id,
      categoryId: audioCategory!.id,
      pricePerDay: 800,
      pricePerWeek: 4500,
      securityDeposit: 8000,
      condition: ItemCondition.LIKE_NEW,
      deliveryOption: DeliveryOption.PICKUP_ONLY,
      instantBooking: false,
      tags: ['speaker', 'jbl', 'party', 'audio', 'bluetooth'],
      latitude: 12.9352,
      longitude: 77.6245,
      city: 'Bangalore',
    },
    {
      title: 'MacBook Pro 14" M2',
      description: 'Apple MacBook Pro with M2 chip. 16GB RAM, 512GB SSD. Perfect for video editing, development, and presentations.',
      slug: 'macbook-pro-14-m2',
      ownerId: lender.id,
      categoryId: electronicsCategory!.id,
      pricePerDay: 1200,
      pricePerWeek: 7000,
      securityDeposit: 15000,
      condition: ItemCondition.LIKE_NEW,
      deliveryOption: DeliveryOption.PICKUP_ONLY,
      instantBooking: true,
      tags: ['macbook', 'laptop', 'apple', 'mac', 'computer'],
      latitude: 12.9716,
      longitude: 77.5946,
      city: 'Bangalore',
    },
    {
      title: 'Projector + Screen Combo',
      description: 'Full HD 1080p projector with 100-inch motorized screen. 3500 lumens. Perfect for movie nights, presentations, and events.',
      slug: 'projector-screen-combo',
      ownerId: lender.id,
      categoryId: partyCategory!.id,
      pricePerDay: 1000,
      pricePerWeek: 5500,
      securityDeposit: 10000,
      condition: ItemCondition.GOOD,
      deliveryOption: DeliveryOption.BOTH,
      instantBooking: true,
      tags: ['projector', 'screen', 'presentation', 'movies', 'party'],
      latitude: 12.9716,
      longitude: 77.5946,
      city: 'Bangalore',
    },
  ];

  for (const item of sampleItems) {
    const existing = await prisma.item.findUnique({ where: { slug: item.slug } });
    if (!existing) {
      await prisma.item.create({ data: item });
    }
  }

  console.log('✅ Sample items seeded');
  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Demo Accounts:');
  console.log('  Admin:  admin@rentify.in  / Admin@123');
  console.log('  Lender: lender@rentify.in / Lender@123');
  console.log('  Renter: renter@rentify.in / Renter@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });