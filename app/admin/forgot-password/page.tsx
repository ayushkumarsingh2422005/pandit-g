import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/chats");
  }

  return (
    <div className="admin-shell flex items-center justify-center bg-[#111b21] px-4">
      <ForgotPasswordForm />
    </div>
  );
}
