import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">GuestHQ</h1>
        <p className="text-sm text-stone-600">Planner sign in</p>
      </div>
      {sent ? (
        <p className="rounded-lg bg-emerald-50 p-4 text-emerald-900">Check your email for a sign-in link.</p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            className="rounded-lg border border-stone-300 px-3 py-3 text-base" />
          <button className="rounded-lg bg-stone-900 px-4 py-3 font-medium text-white">Email me a link</button>
        </form>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </main>
  );
}
