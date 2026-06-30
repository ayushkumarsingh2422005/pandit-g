"use client";

import { useParams } from "next/navigation";
import { ChatDetailPanel } from "../../../components/ChatDetailPanel";

export default function AdminChatDetailPage() {
  const params = useParams();
  const phone = decodeURIComponent(params.phone as string);

  return <ChatDetailPanel phone={phone} />;
}
