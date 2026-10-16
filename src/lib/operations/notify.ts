import "server-only";

import { privilegedDatabase } from "@/lib/data/database";

export async function notifyUnique(input: {
  recipientProfileId: string;
  title: string;
  message: string;
  type: "system" | "task" | "attendance" | "giveaway" | "announcement" | "report" | "onboarding";
  link?: string;
  sourceType: string;
  sourceId: string;
}) {
  const { error } = await privilegedDatabase().from("notifications").insert({
    recipient_profile_id: input.recipientProfileId,
    title: input.title.slice(0, 160),
    message: input.message.slice(0, 500),
    notification_type: input.type,
    link: input.link ?? null,
    source_type: input.sourceType,
    source_id: input.sourceId,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;
}

export async function notifyMany(
  recipientIds: string[],
  payload: Omit<Parameters<typeof notifyUnique>[0], "recipientProfileId">,
) {
  for (const recipientProfileId of recipientIds) {
    await notifyUnique({ ...payload, recipientProfileId });
  }
}
