import MobileClockClient from "./mobile-client";

export default function MobileClockPage({ params }: { params: { eventToken: string } }) {
  return <MobileClockClient eventToken={params.eventToken} />;
}
