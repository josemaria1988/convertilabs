import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="page-shell flex min-h-[calc(100vh-6rem)] items-center justify-center">
      <div className="panel grid w-full max-w-5xl gap-0 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-[color:var(--color-foreground)] px-8 py-10 text-white">
          <span className="eyebrow border-white/15 bg-white/10 text-white before:bg-white">
            Auth
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.06em]">
            Acceso al workspace privado
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
            Este login es la puerta de entrada a los modulos `auth` y
            `organizations`. La implementacion real puede salir con Supabase
            Auth y evolucionar luego sin cambiar la estructura del repo.
          </p>
        </div>

        <div className="px-8 py-10">
          <div className="mb-8 space-y-2">
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Placeholder UI
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em]">
              Inicia sesion
            </h2>
          </div>

          <form className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                placeholder="equipo@convertilabs.com"
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Password</span>
              <input
                type="password"
                placeholder="........"
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
              />
            </label>

            <button
              type="button"
              className="w-full rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-medium text-white"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
