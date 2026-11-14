// app/contact/actions.ts
"use server";

import { headers } from "next/headers";
import { createFormsHelpers, visitorIpFromRequest } from "@kanorio/sdk";

export async function submitContact(formId: string, answers: Record<string, unknown>, protection: Record<string, unknown>) {
  const forms = createFormsHelpers({
    siteUrl: process.env.NEXT_PUBLIC_KANORIO_SITE_URL!,
    serverKey: process.env.KANORIO_SERVER_KEY,
    visitorIp: visitorIpFromRequest({ headers: await headers() }),
  });
  return forms.submit(formId, { answers, consent: "checked", protection });
}
