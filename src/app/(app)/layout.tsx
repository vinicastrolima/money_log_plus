import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppTutorial } from "@/components/app-tutorial";
import { DataProvider } from "@/components/data-provider";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <DataProvider>
      <div className="min-h-dvh bg-background md:flex">
        <a
          href="#conteudo-principal"
          className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Pular para o conteúdo
        </a>
        <Nav userEmail={user.email} />
        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] outline-none md:pb-0"
        >
          <div className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 sm:py-7 md:px-8 md:py-8 xl:px-10 xl:py-10 2xl:px-12">
            {children}
          </div>
        </main>
        <AppTutorial userKey={user.email} />
      </div>
    </DataProvider>
  );
}
