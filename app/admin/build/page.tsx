import { redirect } from "next/navigation";

// The schedule builder has been merged into the Master Schedule (build mode),
// which now has Auto-fill, Copy-week, the "needs a spot" pool, and drag-and-drop.
export default function BuildRedirect() {
  redirect("/admin/master");
}
