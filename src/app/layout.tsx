import './globals.css';
import 'leaflet/dist/leaflet.css'; // Wajib ada untuk peta

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}