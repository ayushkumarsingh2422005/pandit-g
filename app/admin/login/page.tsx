import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { AdminLoginForm } from "../components/AdminLoginForm";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/chats");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <AdminLoginForm />
    </div>
  );
}
