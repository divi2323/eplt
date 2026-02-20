import "./globals.css";
import RouteTheme from "./_components/RouteTheme";

export const metadata = {
  title: { default: 'EPLT', template: 'EPLT - %s' },
  icons: {
    icon: "/assets/poker_chip_club.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RouteTheme />
        <div className="bgWrap" />
	<div className="bgVignette" />
        {children}
      </body>
    </html>
  );
}
