export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">ENDURIA · Admin</div>
        <a className="underline text-sm opacity-80" href="/dashboard">
          Ir a Dashboard
        </a>
      </div>

      <div className="flex gap-3 flex-wrap">
        <a className="border rounded px-3 py-2" href="/admin">
          Atletas
        </a>
        <a className="border rounded px-3 py-2" href="/admin/templates">
          Plantillas
        </a>
        <a className="border rounded px-3 py-2" href="/admin/templates/new">
          ➕ Nueva plantilla
        </a>
      </div>

      {children}
    </div>
  )
}
