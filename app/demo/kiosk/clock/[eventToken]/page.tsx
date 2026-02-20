import KioskClockClient from "./kiosk-client";

export const metadata = { title: 'Kiosk Clock' };

export default async function KioskClockPage({
  params,
}: {
  params: Promise<{ eventToken: string }>;
}) {
  const { eventToken } = await params;
  return <KioskClockClient eventToken={eventToken} />;
}
