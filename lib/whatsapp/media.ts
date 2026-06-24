import { getWhatsAppConfig } from "./config";

export type DownloadedMedia = {
  data: Uint8Array;
  mimeType: string;
};

type MediaMetadataResponse = {
  url?: string;
  mime_type?: string;
  error?: { message?: string };
};

export async function downloadWhatsAppMedia(
  mediaId: string,
): Promise<DownloadedMedia> {
  const { accessToken, apiVersion } = getWhatsAppConfig();

  const metaResponse = await fetch(
    `https://graph.facebook.com/${apiVersion}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const meta = (await metaResponse.json()) as MediaMetadataResponse;

  if (!metaResponse.ok || !meta.url) {
    throw new Error(
      `WhatsApp media metadata failed (${metaResponse.status}): ${meta.error?.message ?? JSON.stringify(meta)}`,
    );
  }

  const mediaResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaResponse.ok) {
    throw new Error(
      `WhatsApp media download failed (${mediaResponse.status})`,
    );
  }

  const buffer = await mediaResponse.arrayBuffer();

  return {
    data: new Uint8Array(buffer),
    mimeType: meta.mime_type ?? "image/jpeg",
  };
}
