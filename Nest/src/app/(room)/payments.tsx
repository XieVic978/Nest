// Payments is the in-room entry point for the shared-expenses experience.
// Keeping the screen implementation in ../expenses also preserves its direct
// /expenses route for development and review.
import Expenses from "../expenses";

export default function PaymentsScreen() {
  return <Expenses />;
}
