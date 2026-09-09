import type { Metadata } from "next";
import { AdminProductPage } from "../admin-product-page";
import "@/app/admin/beta/admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AutoBattle Operations | IDI Studios",
  robots: { index: false, follow: false, nocache: true },
};

export default function AutoBattleAdminPage() {
  return <AdminProductPage product="autobattle" />;
}
