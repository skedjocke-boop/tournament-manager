/** @type {import('next').NextConfig} */
const nextConfig = {
  // THE BUILD OPTIMIZER:
  // Säger åt Next.js att bygga en minimal, fristående version av appen
  // som är perfekt anpassad för att köras i en liten Docker-container.
  output: 'standalone',

  // THE OVERRIDE:
  // Vi säger uttryckligen till Next.js och Turbopack att INTE försöka
  // bygga in dessa tunga backend-motorer i vår frontend-kod. 
  // De måste tillåtas köra som separata, externa processer på servern.
  serverExternalPackages: ['@prisma/client', 'prisma']
};

export default nextConfig;