import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { ResetPasswordForm } from "../components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/chats");
  }

  return (
    <div className="admin-shell flex items-center justify-center bg-[#111b21] px-4">
      <Suspense
        fallback={
          <p className="text-sm text-[#8696a0]">Loading reset form…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
