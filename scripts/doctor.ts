/**
 * Setup diagnostic: `npm run db:check`
 *
 * Pinpoints why a fresh install cannot log in. Checks, in the order they
 * actually fail: the two env files agreeing, the database being reachable,
 * migrations applied, seed data present, and finally whether the admin
 * password genuinely validates against the stored hash.
 *
 * Reads .env.local (what Next.js uses) so it tests the same database the app
 * will query — not the one the Prisma CLI happens to be pointed at.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const ROOT = process.cwd();

function readEnvVar(file: string, key: string): string | null {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) return null;
  for (const line of readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== key) continue;
    return trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return null;
}

/** Hides the password when printing a connection string. */
function redact(url: string): string {
  return url.replace(/:\/\/([^:@/]+):([^@]*)@/, "://$1:****@");
}

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m: string) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const fix = (m: string) => console.log(`    → ${m}`);

async function main() {
  console.log("\nZeem Marketplace — vérification de l'installation\n");
  let fatal = false;

  // 1. Environment files ----------------------------------------------------
  console.log("1. Fichiers d'environnement");
  const envDb = readEnvVar(".env", "DATABASE_URL");
  const localDb = readEnvVar(".env.local", "DATABASE_URL");

  if (!envDb) {
    bad(".env est absent ou ne contient pas DATABASE_URL");
    fix("Le CLI Prisma (migrate, db seed) lit ce fichier.");
    fatal = true;
  } else {
    ok(`.env        → ${redact(envDb)}`);
  }

  if (!localDb) {
    bad(".env.local est absent ou ne contient pas DATABASE_URL");
    fix("L'application Next.js lit ce fichier.");
    fatal = true;
  } else {
    ok(`.env.local  → ${redact(localDb)}`);
  }

  if (envDb && localDb && envDb !== localDb) {
    bad("Les deux DATABASE_URL DIFFÈRENT — c'est la cause la plus fréquente");
    fix("Le seed a écrit dans une base, l'application en lit une autre.");
    fix("Rendez-les identiques, puis relancez : npm run db:seed");
    fatal = true;
  } else if (envDb && localDb) {
    ok("Les deux fichiers pointent vers la même base");
  }

  // DIRECT_URL is what `prisma migrate` uses. It only has to differ from
  // DATABASE_URL on a pooled host such as Neon or Supabase.
  const directUrl = readEnvVar(".env", "DIRECT_URL");
  if (!directUrl) {
    bad(".env ne contient pas DIRECT_URL");
    fix("Les migrations en ont besoin. En local, copiez la valeur de DATABASE_URL.");
    fatal = true;
  } else {
    const pooled = /-pooler\./.test(envDb ?? "");
    const directIsPooled = /-pooler\./.test(directUrl);
    if (directIsPooled) {
      bad("DIRECT_URL pointe vers le pooler (-pooler) — les migrations échoueront");
      fix("Utilisez la chaîne « unpooled / direct » fournie par votre hébergeur.");
      fatal = true;
    } else if (pooled) {
      ok("DATABASE_URL est poolée, DIRECT_URL est directe — configuration correcte");
    } else {
      ok("DIRECT_URL est défini");
    }
  }

  const secret = readEnvVar(".env.local", "NEXTAUTH_SECRET");
  if (!secret) {
    bad("NEXTAUTH_SECRET est absent de .env.local");
    fix("Générez-le : openssl rand -base64 32");
    fatal = true;
  } else if (secret === "your-nextauth-secret-key-change-this") {
    warn("NEXTAUTH_SECRET est encore la valeur d'exemple");
    fix("Remplacez-le : openssl rand -base64 32");
  } else {
    ok("NEXTAUTH_SECRET est défini");
  }

  if (fatal) {
    console.log("\nCorrigez les points ci-dessus avant de continuer.\n");
    process.exit(1);
  }

  // 2. Connection — against the URL the APP uses ----------------------------
  console.log("\n2. Connexion à la base (celle que lit l'application)");
  const prisma = new PrismaClient({
    datasources: { db: { url: localDb! } },
    log: [],
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    ok("Connexion réussie");
  } catch (err) {
    bad(`Connexion impossible : ${err instanceof Error ? err.message.split("\n")[0] : err}`);
    // Naming the port that was tried makes a non-default port obvious.
    const target = /@([^/:]+):(\d+)\//.exec(localDb!);
    if (target) {
      fix(`L'application a essayé ${target[1]} sur le port ${target[2]}.`);
      fix(`Vérifiez le port réel : psql -c "SHOW port;"`);
      fix("S'il diffère, corrigez-le dans .env ET .env.local.");
    }
    fix("PostgreSQL est-il démarré ? (brew services start postgresql@16)");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 3. Migrations -----------------------------------------------------------
  console.log("\n3. Migrations");
  try {
    await prisma.profile.count();
    ok("Les tables existent");
  } catch {
    bad("La table « profiles » est absente — migrations non appliquées");
    fix("Lancez : npx prisma migrate deploy");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 4. Seed data ------------------------------------------------------------
  console.log("\n4. Données du seed");
  const [wilayas, communes, rates, profiles] = await Promise.all([
    prisma.wilaya.count(),
    prisma.commune.count(),
    prisma.shippingRate.count(),
    prisma.profile.count(),
  ]);

  if (wilayas === 0 && profiles === 0) {
    bad("La base est vide — le seed n'a jamais tourné sur CETTE base");
    fix("Lancez : npm run db:seed");
    await prisma.$disconnect();
    process.exit(1);
  }
  ok(`${wilayas} wilayas, ${communes} communes, ${rates} tarifs de livraison`);

  // 5. Accounts and password verification -----------------------------------
  console.log("\n5. Comptes");
  const accounts = await prisma.profile.findMany({
    select: { email: true, phone: true, role: true, passwordHash: true },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    bad("Aucun compte — relancez : npm run db:seed");
    await prisma.$disconnect();
    process.exit(1);
  }

  for (const a of accounts) {
    const label = `${a.email ?? a.phone} (${a.role})`;
    if (!a.passwordHash) {
      warn(`${label} — aucun mot de passe (compte Google uniquement)`);
    } else {
      ok(label);
    }
  }

  const admin = accounts.find((a) => a.email === "admin@zeem.dz");
  if (!admin) {
    bad("admin@zeem.dz est introuvable dans cette base");
    fix("Lancez : npm run db:seed");
  } else if (!admin.passwordHash) {
    bad("admin@zeem.dz n'a pas de mot de passe enregistré");
    fix("Lancez : npm run db:seed");
  } else {
    // The decisive test: does the documented password actually validate?
    const valid = await bcrypt.compare("ZeemAdmin123", admin.passwordHash);
    if (valid) {
      console.log("\n\x1b[32mConnexion possible :\x1b[0m admin@zeem.dz / ZeemAdmin123");
      console.log(
        "Si le formulaire refuse quand même, redémarrez le serveur (Ctrl+C puis npm run dev) :"
      );
      console.log("Next.js ne relit les variables d'environnement qu'au démarrage.\n");
    } else {
      bad("Le mot de passe « ZeemAdmin123 » ne correspond PAS au hash enregistré");
      fix("Le compte a été modifié. Relancez : npm run db:seed");
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\nLa vérification a échoué :", err);
  process.exit(1);
});
