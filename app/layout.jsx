import './globals.css';

export const metadata = {
  title: 'STOW AS Report',
  description: 'SKLC3 AutoStore STOW analýza',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
