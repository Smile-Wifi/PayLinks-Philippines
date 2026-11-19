import { PrismaClient } from "@prisma/client";
import { generateApiKey, generateWebhookSecret } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.merchant.findFirst({
    where: { name: "Magic Music Events" },
  });

  if (existing) {
    console.log("Demo merchant already exists:");
    console.log("  API Key:", existing.apiKey);
    return;
  }

  const merchant = await prisma.merchant.create({
    data: {
      name: "Magic Music Events",
      apiKey: generateApiKey("pm_test"),
      webhookSecret: generateWebhookSecret(),
      brandName: "Magic Music Events",
      brandEmoji: "🎵",
      brandColor: "#0b6bff",
      brandFooter: "Thank you for your payment!",
    },
  });

  console.log("✅ Demo merchant created");
  console.log("   Name:     ", merchant.name);
  console.log("   API Key:  ", merchant.apiKey);
  console.log("   Webhook Secret:", merchant.webhookSecret);
  console.log("");
  console.log("Use this header in API calls:");
  console.log(`  Authorization: Bearer ${merchant.apiKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
