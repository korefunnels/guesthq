import Link from "next/link";
import { requirePlanner } from "@/lib/planner";

export default async function PlannerLayout({ children }: LayoutProps<"/app">) {
  const { planner } = await requirePlanner();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            {planner.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={planner.logo_url} alt="" className="h-7 w-auto" />
            ) : (
              <span className="inline-block h-6 w-6 rounded" style={{ background: planner.brand_colour }} />
            )}
            <span>{planner.business_name || "GuestHQ"}</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-stone-600 hover:text-stone-900">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
