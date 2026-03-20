import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const insurers = [
  { slug: 'sura', name: 'Seguros SURA', website: 'https://www.sura.com', authType: 'cookie', description: 'Suramericana S.A. - Líder en seguros de vida, autos, hogar y empresariales' },
  { slug: 'bolivar', name: 'Seguros Bolívar', website: 'https://www.segurosbolivar.com', authType: 'cookie', description: 'Seguros Bolívar - Seguros generales, vida, autos y hogar' },
  { slug: 'allianz', name: 'Allianz Seguros', website: 'https://www.allianz.co', authType: 'cookie', description: 'Allianz Colombia - Seguros de vida, autos, hogar y empresariales' },
  { slug: 'mapfre', name: 'MAPFRE Seguros', website: 'https://www.mapfre.com.co', authType: 'cookie', description: 'MAPFRE Colombia - Seguros generales y de vida' },
  { slug: 'liberty', name: 'Liberty Seguros', website: 'https://www.libertyseguros.co', authType: 'cookie', description: 'Liberty Seguros Colombia - Seguros de autos, hogar y empresariales' },
  { slug: 'colpatria', name: 'AXA Colpatria', website: 'https://www.axacolpatria.co', authType: 'cookie', description: 'AXA Colpatria Seguros - Vida, autos, hogar, salud' },
  { slug: 'previsora', name: 'La Previsora', website: 'https://www.previsora.gov.co', authType: 'cookie', description: 'La Previsora S.A. - Compañía de seguros estatal' },
  { slug: 'hdi', name: 'HDI Seguros', website: 'https://www.hdi.com.co', authType: 'cookie', description: 'HDI Seguros Colombia - Seguros de autos y generales' },
  { slug: 'mundial', name: 'Mundial de Seguros', website: 'https://www.mundial.com.co', authType: 'cookie', description: 'Mundial de Seguros - Seguros generales' },
  { slug: 'estado', name: 'Seguros del Estado', website: 'https://www.segurosdelestado.com', authType: 'cookie', description: 'Seguros del Estado - Seguros generales y de vida' },
  { slug: 'equidad', name: 'La Equidad Seguros', website: 'https://www.laequidadseguros.coop', authType: 'cookie', description: 'La Equidad Seguros - Cooperativa de seguros' },
  { slug: 'solidaria', name: 'Solidaria de Seguros', website: 'https://www.solidaria.com.co', authType: 'cookie', description: 'Solidaria de Seguros - Seguros cooperativos' },
  { slug: 'sbs', name: 'SBS Seguros', website: 'https://www.sbs.com.co', authType: 'cookie', description: 'SBS Seguros Colombia' },
  { slug: 'zurich', name: 'Zurich Seguros', website: 'https://www.zurich.com.co', authType: 'cookie', description: 'Zurich Seguros Colombia - Seguros generales y vida' },
  { slug: 'chubb', name: 'Chubb Seguros', website: 'https://www.chubb.com/co', authType: 'cookie', description: 'Chubb Seguros Colombia - Seguros especializados' },
  { slug: 'berkley', name: 'Berkley Seguros', website: 'https://www.berkleyseguros.com.co', authType: 'cookie', description: 'Berkley Seguros Colombia' },
  { slug: 'positive', name: 'Positiva', website: 'https://www.positiva.gov.co', authType: 'cookie', description: 'Positiva Compañía de Seguros - ARL estatal' },
  { slug: 'cardinal', name: 'Cardinal Seguros', website: 'https://www.cardinal.com.co', authType: 'cookie', description: 'Cardinal Compañía de Seguros' },
  { slug: 'coface', name: 'Coface Seguros', website: 'https://www.coface.com.co', authType: 'cookie', description: 'Coface Colombia - Seguro de crédito' },
  { slug: 'softseguros', name: 'SoftSeguros', website: 'https://app.softseguros.com', authType: 'token', description: 'SoftSeguros - Software de gestión para intermediarios (API oficial)' },
];

async function main() {
  console.log('🌱 Seeding insurers...');

  for (const insurer of insurers) {
    await prisma.insurer.upsert({
      where: { slug: insurer.slug },
      update: { name: insurer.name, website: insurer.website, description: insurer.description },
      create: {
        slug: insurer.slug,
        name: insurer.name,
        website: insurer.website,
        authType: insurer.authType,
        description: insurer.description,
        isActive: insurer.slug === 'sura', // Only SURA connector is active for now
      },
    });
    console.log(`  ✓ ${insurer.name} (${insurer.slug})`);
  }

  console.log(`\n✅ Seeded ${insurers.length} insurers`);

  // Create default agency and admin user
  console.log('\n👤 Creating admin user...');
  const agency = await prisma.agency.upsert({
    where: { email: 'juanriverarq@gmail.com' },
    update: {},
    create: {
      name: 'Agencia Juan Rivera',
      email: 'juanriverarq@gmail.com',
    },
  });

  await prisma.user.upsert({
    where: { email: 'juanriverarq@gmail.com' },
    update: {},
    create: {
      agencyId: agency.id,
      email: 'juanriverarq@gmail.com',
      passwordHash: hashSync('Jua88riv25.', 12),
      fullName: 'Juan Rivera',
      role: 'ADMIN',
    },
  });
  console.log('  ✓ Admin: juanriverarq@gmail.com');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
