import { redirect } from "next/navigation";

export default function Page() {
  // Registration lives inside the Run workflow for the demo.
  redirect("/demo/run/DEMO");
}
