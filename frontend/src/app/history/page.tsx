import type { Metadata } from "next";
import HistoryList from "./HistoryList";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <HistoryList />;
}
