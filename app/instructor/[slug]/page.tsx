import { Suspense } from "react";
import InstructorView from "./InstructorView";

export default function InstructorPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-brand-text/60">Loading…</p>
      }
    >
      <InstructorView />
    </Suspense>
  );
}
