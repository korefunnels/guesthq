import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold">GuestHQ</h1>
      <p className="text-stone-600">Guest logistics for complex weddings: WhatsApp RSVPs, supplier-ready outputs, one link for the whole journey.</p>
      <Link href="/app" className="w-fit rounded-lg bg-stone-900 px-4 py-3 font-medium text-white">Planner sign in</Link>
    </main>
  );
}
