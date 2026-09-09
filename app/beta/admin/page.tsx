import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BetaAdminIndexPage() {
  redirect("/beta/admin/conquest");
}
