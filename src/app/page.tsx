import { getSessionUser } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    redirect("/app");
  }

  return <LandingPage />;
}
