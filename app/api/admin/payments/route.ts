import { NextRequest } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/auth";
import { listPayments } from "@/lib/db/admin";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const payments = await listPayments(200);
  const paid = payments.filter((p) => p.status === "paid");
  const totalInr = paid.reduce((sum, p) => sum + p.amountInr, 0);

  return Response.json({
    payments,
    stats: {
      total: payments.length,
      paidCount: paid.length,
      totalInr,
    },
  });
}
