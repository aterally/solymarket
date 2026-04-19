import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Solymarket',
  description: 'Prediction markets',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
