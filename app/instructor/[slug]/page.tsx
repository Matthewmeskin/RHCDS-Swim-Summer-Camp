import { Suspense } from "react";
import InstructorView from "./InstructorView";
import CampLoader from "@/components/CampLoader";

export default function InstructorPage() {
  return (
    <Suspense fallback={<CampLoader />}>
      <InstructorView />
    </Suspense>
  );
}
