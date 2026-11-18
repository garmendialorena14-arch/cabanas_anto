import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cabañas Anto · Complejo Turístico en Mar Azul, Buenos Aires',
  description: 'Complejo de cabañas en el bosque y a pasos del mar en Mar Azul, Buenos Aires. Unidades accesibles, piscina climatizada y atención 24/7 en Telegram.',
  icons: {
    icon: '/images/branding/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-amber-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
