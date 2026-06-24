export type WhatsAppWebhookPayload = {
  object: string;
  entry?: WhatsAppEntry[];
};

export type WhatsAppEntry = {
  id: string;
  changes: WhatsAppChange[];
};

export type WhatsAppChange = {
  field: string;
  value: WhatsAppChangeValue;
};

export type WhatsAppChangeValue = {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppStatusUpdate[];
};

export type WhatsAppContact = {
  profile?: { name?: string };
  wa_id: string;
};

export type WhatsAppIncomingMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

export type WhatsAppStatusUpdate = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
};

export type IncomingTextMessage = {
  from: string;
  messageId: string;
  text: string;
  contactName?: string;
};
