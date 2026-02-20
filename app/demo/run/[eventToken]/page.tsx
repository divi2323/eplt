import RunEventClient from "./run-client";

export const metadata = { title: 'Run Event' };

type Ctx = { params: Promise<{ eventToken: string }> };

export default async function Page(context: Ctx) {
  const { eventToken } = await context.params;
  return <RunEventClient eventToken={eventToken} />;
}
