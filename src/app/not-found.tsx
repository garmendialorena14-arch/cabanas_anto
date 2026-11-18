import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-200 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-6xl font-serif font-bold text-amber-400 mb-2">404</h1>
      <h2 className="text-xl font-semibold mb-4 text-stone-100">Página no encontrada</h2>
      <p className="text-sm text-stone-400 max-w-md mb-6">
        La ruta a la que estás intentando acceder no existe o fue trasladada.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-900/30"
      >
        <Home className="w-4 h-4" />
        Volver al Inicio
      </Link>
    </div>
  );
}
